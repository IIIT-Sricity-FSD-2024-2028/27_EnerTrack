/**
 * Auto-dispatch: pushes a ticket to ONE ranked technician. Nobody picks a job
 * from a list, and nothing is broadcast.
 *
 * Flow:
 *   ticket created ──► dispatch() ──► work order, assigned, "pending" ack
 *        technician acknowledges ──► done
 *        technician declines (with a reason) or misses the window
 *              ──► same work order moves to the next ranked person
 *        nobody eligible ──► coordinator queue (Critical jumps the load cap)
 *
 * Every method that depends on the time takes `now`, so tests and the
 * periodic sweep use one clock and nothing hides a `new Date()`.
 */
import * as crypto from "crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  AlertStatus,
  DatabaseService,
  FindingStatus,
  DeclineReason,
  ExpenseBillStatus,
  FaultStatus,
  Initiative,
  NotificationTargetType,
  ServiceRequest,
  User,
  UserRole,
  WorkOrder,
  WorkOrderDispatch,
  WorkOrderPriority,
  WorkOrderStatus,
} from "../../core/database/database.service";
import { assertTenantOwns, currentOrgId } from "../../core/tenancy/tenant-context";
import { AREAS, FLOORS, OTHER_ITEM_ID, PARTS, teamLabel, teamWorkLabel } from "../issue-catalogue/issue-catalogue";
import type { AreaId, Size, Team } from "../issue-catalogue/issue-catalogue";
import { Clock } from "./clock";
import { SlaService } from "./sla.service";
import {
  Candidate,
  Job,
  ackWindowMinutes,
  agedPriority,
  criticalFallback,
  levelOrder,
  loadLevel,
  MAX_LOAD,
  rankCandidates,
  teamOfUser,
  faultTeam,
  findingTeam,
  todayKey,
} from "./ranking";

export const DECLINE_REASONS: DeclineReason[] = ["sick", "on_another_job", "no_tools", "other"];
/** Declines per technician per week before the coordinator is told to look. */
export const WEEKLY_DECLINE_FLAG = 3;
const WEEK_MS = 7 * 86_400_000;
const SWEEP_EVERY_MS = 60_000;

const CLOSED_STATUSES = ["closed", "resolved", "completed"];
const isOpenTicket = (t: ServiceRequest) => !CLOSED_STATUSES.includes(String(t.status).toLowerCase());

/** "2027-03-31" → the end of that day, as an ISO time. */
export const endOfDay = (date: string) => new Date(`${date.slice(0, 10)}T23:59:59`).toISOString();

/**
 * "Available today" means today: a switch turned off on an earlier day counts
 * as on again (a switch turned off before this rule, with no date, stays off).
 */
const isSwitchedOn = (u: User, now: Date) =>
  u.available !== false || (!!u.switched_off_on && u.switched_off_on !== todayKey(now));

/** "2027-03-31": a YYYY-MM-DD date that is today or later on the server's calendar. */
const isDateFromToday = (d: unknown, now: Date) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= todayKey(now);

/**
 * The kind of job, for the "Type" column. The coordinator's own form sets
 * emergency / scheduled / preventive; jobs the system raises get the kind of
 * thing that raised them.
 */
export function jobTypeOf(t: ServiceRequest): string {
  if (t.source_initiative) return "initiative";
  if (t.source_wastage) return "wastage";
  if (t.source_finding) return "audit";
  if (t.source_fault_id) return "scheduled";
  return "issue";
}

/** Where one initiative job is, in the officer's words. */
function initiativeStage(t: ServiceRequest, wo: WorkOrder | undefined): string {
  if (!isOpenTicket(t)) return "Closed";
  if (t.dispatch_state === "queued" || !wo?.assigned_to_id) return "Waiting for a person";
  if (wo.status === WorkOrderStatus.REVIEW) return "Being checked";
  if (wo.status === WorkOrderStatus.INPROGRESS || wo.status === WorkOrderStatus.APPROVAL) return "In progress";
  return wo.dispatch?.ack_status === "acknowledged" ? "Accepted" : "Sent";
}

@Injectable()
export class DispatchService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly log = new Logger("Dispatch");

  constructor(
    private database: DatabaseService,
    private clock: Clock,
    private sla: SlaService,
  ) {}

  onModuleInit() {
    // Timeouts must not depend on anyone opening a page. Not run under jest.
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => {
      try {
        this.sweep(this.clock.now());
      } catch (e) {
        this.log.error(`Sweep failed: ${(e as Error).message}`);
      }
    }, SWEEP_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Dispatching ────────────────────────────────────────────────────────

  /**
   * Give a ticket to the best available person, or put it in the
   * coordinator's queue. Safe to call again: a ticket that already has a live
   * work order is left alone.
   */
  dispatch(ticket: ServiceRequest, now = this.clock.now()): void {
    if (this.workOrderFor(ticket)) return;

    // "Other" reports never auto-dispatch: a person decides the team.
    if (ticket.item_id === OTHER_ITEM_ID || !ticket.team) {
      return this.enqueue(ticket, "other_report", now);
    }
    this.assign(ticket, this.createWorkOrder(ticket, now), [], now);
  }

  /**
   * A monitoring fault becomes a job through the same engine as a student
   * report: team from the kind of fault, priority from its severity, one
   * ranked person, an acknowledge window and a deadline. With `assigneeId`
   * the coordinator picks the person instead.
   */
  sendFault(
    faultId: string,
    opts: { kind?: "scheduled" | "immediate"; priority?: string; assigneeId?: string; notes?: string },
    now = this.clock.now(),
  ) {
    const org = currentOrgId();
    const fault = this.database.faults.find((f) => f.fault_id === faultId && (!org || f.organization_id === org));
    if (!fault) throw new NotFoundException(`Fault with ID ${faultId} not found`);
    if (fault.status === FaultStatus.RESOLVED) throw new BadRequestException("This fault is already resolved.");
    const open = this.database.workOrders.find((w) => w.linked_fault_id === faultId && w.status !== WorkOrderStatus.CLOSED);
    if (open) throw new ConflictException("This fault already has an open work order.");

    const severityLevel: Record<string, string> = { critical: "immediate", high: "high", moderate: "medium", low: "low" };
    const level = opts.priority ?? severityLevel[fault.severity] ?? "medium";
    const team = faultTeam(fault.fault_type);
    const ticket: ServiceRequest = {
      service_request_id: crypto.randomUUID(),
      organization_id: fault.organization_id,
      reporter_id: "system",
      assigned_to_id: null,
      category: "Fault",
      issue_type: `${fault.fault_type} – ${fault.asset_name}`,
      status: "open",
      created_at: now.toISOString(),
      description: opts.notes ?? "",
      item_id: "fault",
      part: fault.asset_name,
      team: team ?? undefined,
      size: "M",
      points: 2,
      priority: level,
      priority_system: level,
      priority_override: null,
      priority_reasons: [`Raised from a ${fault.severity} fault`],
      source_fault_id: faultId,
      reporter_ids: [],
      plus_one_ids: [],
    };
    this.database.serviceRequests.push(ticket);

    if (opts.assigneeId) {
      this.manualAssign(ticket.service_request_id, opts.assigneeId, now);
    } else {
      this.dispatch(ticket, now);
    }
    const wo = this.workOrderFor(ticket);
    if (wo) {
      wo.details = {
        type: opts.kind === "immediate" ? "emergency" : "scheduled",
        description: fault.asset_name || "Asset",
        diagnostic_notes: opts.notes ?? "",
      };
    }
    return { ticket_id: ticket.service_request_id, work_order: wo ? this.workOrderView(wo) : null };
  }

  /** The coordinator hand-picks a person (always allowed, any team). */
  manualAssign(ticketId: string, userId: string, now = this.clock.now()) {
    const ticket = this.requireTicket(ticketId);
    if (["closed", "resolved", "completed"].includes(String(ticket.status).toLowerCase()))
      throw new BadRequestException("This issue is already closed.");
    const user = this.requireTechnician(userId, ticket.organization_id);
    // A job with a team goes to that team. A job with no team (an "Other"
    // report) is the coordinator's call, so any technician may take it.
    const userTeam = teamOfUser(user);
    if (ticket.team && userTeam !== ticket.team) {
      throw new BadRequestException(
        `${user.name} ${userTeam ? `is on the ${userTeam} team` : "has no team"}, but this job needs the ${ticket.team} team. Choose someone on the ${ticket.team} team.`,
      );
    }
    const wo = this.workOrderFor(ticket) ?? this.createWorkOrder(ticket, now);
    const d = wo.dispatch!;
    const was = wo.assigned_to_id;
    // A job already being worked keeps its progress: the new person is simply
    // given it, with no acknowledge window that the sweep could act on.
    const started = wo.status !== WorkOrderStatus.NEW;
    wo.assigned_to_id = user.user_id;
    d.assigned_at = now.toISOString();
    d.ack_status = started ? "acknowledged" : "pending";
    d.ack_due_at = started ? null : this.dueAt(wo.priority, now);
    d.acknowledged_at = started ? now.toISOString() : null;
    d.history.push({ at: d.assigned_at, event: "manual", user_id: user.user_id, reason: was ? "reassigned by coordinator" : "assigned by coordinator" });
    this.sla.start(wo, now);
    ticket.assigned_to_id = user.user_id;
    ticket.dispatch_state = "assigned";
    ticket.queued_reason = undefined;
    ticket.queued_at = null;
    if (was && was !== user.user_id) {
      this.notify(was, ticket.organization_id, wo.work_order_id, `"${wo.title}" was given to someone else by the coordinator.`);
    }
    this.notify(user.user_id, ticket.organization_id, wo.work_order_id, `New job from the coordinator: ${wo.title}`);
    return this.workOrderView(wo);
  }

  acknowledge(userId: string, workOrderId: string, now = this.clock.now()) {
    const wo = this.requireDispatched(workOrderId);
    if (wo.assigned_to_id !== userId) throw new ForbiddenException("This job is not assigned to you.");
    const d = wo.dispatch!;
    if (d.ack_status === "acknowledged") return this.workOrderView(wo);
    d.ack_status = "acknowledged";
    d.acknowledged_at = now.toISOString();
    d.ack_due_at = null;
    d.history.push({ at: d.acknowledged_at, event: "acknowledged", user_id: userId });
    return this.workOrderView(wo);
  }

  /**
   * The assignee cannot take the job. It moves to the next person; the
   * reason is recorded and the coordinator can see who declines a lot.
   */
  decline(userId: string, workOrderId: string, reason: DeclineReason, now = this.clock.now()) {
    if (!DECLINE_REASONS.includes(reason)) {
      throw new BadRequestException(`Reason must be one of: ${DECLINE_REASONS.join(", ")}.`);
    }
    const wo = this.requireDispatched(workOrderId);
    if (wo.assigned_to_id !== userId) throw new ForbiddenException("This job is not assigned to you.");
    const d = wo.dispatch!;
    if (d.ack_status === "acknowledged") {
      throw new BadRequestException("You already acknowledged this job. Ask the coordinator to reassign it.");
    }
    d.history.push({ at: now.toISOString(), event: "declined", user_id: userId, reason });
    d.tried.push(userId);
    if (reason === "sick") this.markOffToday(userId, now, "sick");

    const ticket = this.ticketOf(wo);
    this.release(wo);
    if (ticket) this.reassign(ticket, wo, now, "declined");

    if (this.recentDeclines(userId, now) >= WEEKLY_DECLINE_FLAG) {
      this.notifyCoordinators(wo.organization_id, `${this.nameOf(userId)} has declined ${WEEKLY_DECLINE_FLAG} or more jobs this week.`, wo.work_order_id);
    }
    return this.workOrderView(wo);
  }

  /**
   * Technician's "Available today" switch. Off lasts for today only: from
   * tomorrow they are available again without touching it.
   */
  setAvailability(userId: string, available: boolean, now = this.clock.now()) {
    const user = this.requireTechnician(userId, undefined);
    user.available = available;
    user.switched_off_on = available ? null : todayKey(now);
    // A "marked off today" flag (sick, or an unanswered job) stays until the
    // day ends: flipping the switch is not a way to clear it.
    if (available) this.retryQueued(now);
    else this.releaseUnstarted(userId, now);
    return this.availabilityOf(user, now);
  }

  availabilityFor(userId: string, now = this.clock.now()) {
    return this.availabilityOf(this.requireTechnician(userId, undefined), now);
  }

  availabilityOf(user: User, now = this.clock.now()) {
    const c = this.candidateOf(user, now);
    const switchedOn = isSwitchedOn(user, now);
    const offToday = user.unavailable_on === todayKey(now);
    return {
      available: switchedOn && !offToday,
      switched_on: switchedOn,
      off_for_today: offToday,
      /** Why they are off for today: "sick" (declined as unwell) or "missed" (did not answer a job in time). */
      off_reason: offToday ? (user.unavailable_reason ?? null) : null,
      /** Without a team the system never sends them jobs, whatever the switch says. */
      has_team: !!c.team,
      team: c.team,
      open_points: c.openPoints,
      open_jobs: c.openJobs ?? 0,
      load: loadLevel(c.openPoints),
      max_load: MAX_LOAD,
    };
  }

  // ── After assignment: start, finish, close ─────────────────────────────

  /** The technician begins the job. The student's ticket now reads "Visited". */
  start(userId: string, workOrderId: string, now = this.clock.now()) {
    const wo = this.ownAcknowledged(userId, workOrderId);
    if (wo.status !== WorkOrderStatus.NEW) throw new BadRequestException("This job has already been started.");
    wo.status = WorkOrderStatus.INPROGRESS;
    wo.dispatch!.history.push({ at: now.toISOString(), event: "started", user_id: userId });
    this.onStatusChange(wo, now);
    return this.workOrderView(wo);
  }

  /** The technician says the work is done. It goes to the coordinator to verify and close. */
  finish(userId: string, workOrderId: string, notes?: string, now = this.clock.now()) {
    const wo = this.ownAcknowledged(userId, workOrderId);
    if (wo.status !== WorkOrderStatus.INPROGRESS) throw new BadRequestException("Start the job before marking it done.");
    wo.status = WorkOrderStatus.REVIEW;
    const text = (notes ?? "").trim();
    if (text) wo.details = { ...(wo.details ?? {}), resolution_notes: text };
    wo.dispatch!.history.push({ at: now.toISOString(), event: "finished", user_id: userId });
    this.onStatusChange(wo, now);
    this.notifyCoordinators(wo.organization_id, `${this.nameOf(userId)} finished "${wo.title}". Please verify and close it.`, wo.work_order_id);
    return this.workOrderView(wo);
  }

  /**
   * Keep the student's ticket in step with its work order, whichever route
   * changed the status: on its way = Visited, closed = Fixed (and it leaves
   * the open list, so the next report of the same fault is a new ticket).
   */
  onStatusChange(wo: WorkOrder, now = this.clock.now()) {
    const ticket = this.ticketOf(wo);
    if (!ticket || !wo.dispatch) return;
    const open = !["closed", "resolved", "completed"].includes(String(ticket.status).toLowerCase());
    if (!open) return;
    if (wo.status === WorkOrderStatus.CLOSED) {
      ticket.status = "closed";
      ticket.closed_at = now.toISOString();
      ticket.dispatch_state = undefined;
      wo.dispatch.history.push({ at: now.toISOString(), event: "closed", user_id: wo.assigned_to_id });
      this.notifyReporters(ticket, "fixed", `Fixed: ${this.ticketLabel(ticket)}. If it is still broken, tell us in My Reports.`);
      this.resolveFault(ticket);
      this.completeFinding(ticket, now);
      this.initiativeJobClosed(ticket);
    } else if (wo.status === WorkOrderStatus.REVIEW) {
      ticket.status = "checking";
      this.notifyReporters(ticket, "checking", `The work is done and is being checked: ${this.ticketLabel(ticket)}.`);
    } else if ([WorkOrderStatus.INPROGRESS, WorkOrderStatus.APPROVAL].includes(wo.status)) {
      ticket.status = "visited";
      this.notifyReporters(ticket, "started", `Work has started: ${this.ticketLabel(ticket)}.`);
    }
  }

  /**
   * A validated wastage report becomes a job through the same engine: team
   * from the kind of wastage (water to plumbers, energy to electricians; the
   * rest the coordinator places). One job per report.
   */
  sendWastage(report: { wastage_report_id: string; organization_id: string; type: string; details?: Record<string, any> }, now = this.clock.now()) {
    const existing = this.database.serviceRequests.find((t) => t.source_wastage === report.wastage_report_id);
    if (existing) throw new ConflictException("A work order was already raised for this report.");
    // Food work (separate food-waste bins, a weighing scale) is General
    // Maintenance's; Emissions has no team, so a coordinator decides.
    const team: Team | undefined =
      report.type === "Water" ? "plumber" : report.type === "Energy" ? "electrician" : report.type === "Food" ? "general" : undefined;
    const given = String(report.details?.priority ?? "").toLowerCase();
    const level = ["high", "medium", "low"].includes(given) ? given : "medium";
    const where = report.details?.specificData?.location ?? report.details?.location ?? "";
    const ticket: ServiceRequest = {
      service_request_id: crypto.randomUUID(),
      organization_id: report.organization_id,
      reporter_id: "system",
      assigned_to_id: null,
      category: "Wastage",
      issue_type: `Wastage: ${report.type}`,
      status: "open",
      created_at: now.toISOString(),
      description: String(report.details?.specificData?.description ?? report.details?.remedy?.description ?? ""),
      item_id: "wastage",
      part: String(where),
      team,
      size: "M",
      points: 2,
      priority: level,
      priority_system: level,
      priority_override: null,
      priority_reasons: ["Raised from a wastage case"],
      source_wastage: report.wastage_report_id,
      reporter_ids: [],
      plus_one_ids: [],
    };
    this.database.serviceRequests.push(ticket);
    this.dispatch(ticket, now);
    const wo = this.workOrderFor(ticket);
    return { ticket_id: ticket.service_request_id, work_order_id: wo?.work_order_id ?? null, queued: ticket.dispatch_state === "queued" };
  }

  /** Closing a job that carries out an audit recommendation marks the recommendation implemented. */
  private completeFinding(ticket: ServiceRequest, now: Date) {
    if (!ticket.source_finding) return;
    const [auditId, findingId] = ticket.source_finding.split(":");
    const finding = this.database.energyAudits.find((a) => a.audit_id === auditId)?.findings.find((f) => f.finding_id === findingId);
    if (!finding || finding.status === FindingStatus.IMPLEMENTED) return;
    finding.status = FindingStatus.IMPLEMENTED;
    finding.implemented_on = now.toISOString().slice(0, 10);
  }

  /**
   * An accepted audit recommendation becomes a job through the same engine
   * (team from the kind of measure, priority from its severity). Asking again
   * for a finding that already has an open job does nothing.
   */
  sendFinding(
    audit: { audit_id: string; organization_id: string },
    finding: { finding_id: string; title: string; category: string; severity: string; building_ids: string[] },
    now = this.clock.now(),
  ) {
    const key = `${audit.audit_id}:${finding.finding_id}`;
    const existing = this.database.serviceRequests.find(
      (t) => t.source_finding === key && !["closed", "resolved", "completed"].includes(String(t.status).toLowerCase()),
    );
    if (existing) return existing;
    const level: Record<string, string> = { high: "high", moderate: "medium", low: "low" };
    const team = findingTeam(finding.category);
    const ticket: ServiceRequest = {
      service_request_id: crypto.randomUUID(),
      organization_id: audit.organization_id,
      reporter_id: "system",
      assigned_to_id: null,
      category: "Audit recommendation",
      issue_type: finding.title,
      status: "open",
      created_at: now.toISOString(),
      description: `${finding.category}: ${finding.title}`,
      item_id: "finding",
      building_id: finding.building_ids[0],
      part: finding.category,
      team: team ?? undefined,
      size: "L",
      points: 4,
      priority: level[finding.severity] ?? "medium",
      priority_system: level[finding.severity] ?? "medium",
      priority_override: null,
      priority_reasons: ["Accepted audit recommendation"],
      source_finding: key,
      reporter_ids: [],
      plus_one_ids: [],
    };
    this.database.serviceRequests.push(ticket);
    this.dispatch(ticket, now);
    return ticket;
  }

  /** Closing a job raised from a fault also resolves the fault and the alert behind it. */
  private resolveFault(ticket: ServiceRequest) {
    if (!ticket.source_fault_id) return;
    const fault = this.database.faults.find((f) => f.fault_id === ticket.source_fault_id);
    if (!fault) return;
    fault.status = FaultStatus.RESOLVED;
    const alert = fault.alert_id ? this.database.alerts.find((a) => a.alert_id === fault.alert_id) : undefined;
    if (alert) alert.status = AlertStatus.RESOLVED;
  }

  // ── Initiatives with on-site work ──────────────────────────────────────

  /**
   * An initiative that needs technicians on site joins the same engine when
   * the Organization Admin approves it: one job per technician type it needs,
   * all sent now, so they run in parallel and never wait for each other. Each
   * job's finish date is the initiative's target date, not the priority ×
   * size table. A type that already has an open job is skipped, so calling
   * this twice sends nothing new.
   */
  sendInitiative(initiative: Initiative, now = this.clock.now()): ServiceRequest[] {
    const finishBy = endOfDay(initiative.target_date!);
    const sent: ServiceRequest[] = [];
    for (const team of new Set(initiative.teams ?? [])) {
      const open = this.initiativeTickets(initiative.initiative_id).some((t) => t.team === team && isOpenTicket(t));
      if (!open) sent.push(this.sendInitiativeJob(initiative, team, finishBy, null, now));
    }
    return sent;
  }

  /**
   * One technician type's job for an initiative. Its description is that
   * type's task (what the officer said this trade has to do), with the
   * initiative's description underneath for context. `rework` when the
   * coordinator sends a closed job back; `assigneeId` when they choose who.
   */
  sendInitiativeJob(
    initiative: Initiative,
    team: string,
    finishBy: string,
    rework: { of: string; reason: string } | null,
    now = this.clock.now(),
    assigneeId: string | null = null,
  ): ServiceRequest {
    const ids = initiative.building_ids ?? [];
    const names = ids.map((id) => this.database.buildings.find((b) => b.building_id === id)?.name ?? id);
    const task = initiative.team_tasks?.[team]?.trim();
    const description = [
      rework ? `Rework requested: ${rework.reason}` : "",
      task ? `Your task: ${task}` : "",
      initiative.description ? `About the initiative: ${initiative.description}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const ticket: ServiceRequest = {
      service_request_id: crypto.randomUUID(),
      organization_id: initiative.organization_id,
      reporter_id: "system",
      assigned_to_id: null,
      category: "Initiative",
      issue_type: `${rework ? "Rework: " : "Initiative: "}${initiative.title} (${teamWorkLabel(team)})`,
      status: "open",
      created_at: now.toISOString(),
      description,
      item_id: "initiative",
      building_id: ids.length === 1 ? ids[0] : undefined,
      part: ids.length === 1 ? undefined : names.length ? names.join(", ") : "Whole campus",
      team,
      // An installation runs for weeks; at L (4 points) the technician could
      // take almost no repairs for its whole duration.
      size: "M",
      points: 2,
      priority: "medium",
      priority_system: "medium",
      priority_override: null,
      priority_reasons: [rework ? "Initiative work sent back for rework" : "On-site work for an approved initiative"],
      source_initiative: initiative.initiative_id,
      finish_by: finishBy,
      rework_of: rework?.of ?? null,
      rework_reason: rework?.reason ?? null,
      reporter_ids: [],
      plus_one_ids: [],
    };
    this.database.serviceRequests.push(ticket);
    if (assigneeId) this.manualAssign(ticket.service_request_id, assigneeId, now);
    else this.dispatch(ticket, now);
    return ticket;
  }

  /** Every job (open or closed, first try or rework) for an initiative, oldest first. */
  initiativeJobs(initiativeId: string) {
    const initiative = this.database.initiatives.find((i) => i.initiative_id === initiativeId);
    return this.initiativeTickets(initiativeId).map((t) => {
      const wo = this.latestWorkOrder(t);
      const bills = wo ? this.database.expenseBills.filter((b) => b.work_order_id === wo.work_order_id) : [];
      const sum = (status: ExpenseBillStatus) =>
        bills.filter((b) => b.status === status).reduce((n, b) => n + Number(b.amount || 0), 0);
      const r = t.rework_request;
      const reworkTicket = r?.rework_ticket_id ? this.database.serviceRequests.find((x) => x.service_request_id === r.rework_ticket_id) : undefined;
      const reworkWo = reworkTicket ? this.latestWorkOrder(reworkTicket) : undefined;
      return {
        ticket_id: t.service_request_id,
        work_order_id: wo?.work_order_id ?? null,
        team: t.team ?? null,
        team_label: teamLabel(t.team),
        task: initiative?.team_tasks?.[t.team ?? ""] ?? null,
        technician_id: wo?.assigned_to_id ?? null,
        technician_name: wo?.assigned_to_id ? this.nameOf(wo.assigned_to_id) : null,
        stage: initiativeStage(t, wo),
        open: isOpenTicket(t),
        finish_by: wo?.dispatch?.sla?.deadline_at ?? t.finish_by ?? null,
        closed_at: t.closed_at ?? null,
        rework_of: t.rework_of ?? null,
        rework_reason: t.rework_reason ?? null,
        /** Approved expense bills on this job (what it cost), and bills still waiting for Finance. */
        spent: sum(ExpenseBillStatus.APPROVED),
        spend_pending: sum(ExpenseBillStatus.SUBMITTED),
        rework_request: r
          ? {
              status: r.status,
              reason: r.reason,
              requested_at: r.requested_at,
              decided_at: r.decided_at ?? null,
              decided_by_name: r.decided_by ? this.nameOf(r.decided_by) : null,
              note: r.note ?? null,
              rework_technician_name: reworkWo?.assigned_to_id ? this.nameOf(reworkWo.assigned_to_id) : null,
              rework_finish_by: reworkTicket?.finish_by ?? null,
            }
          : null,
      };
    });
  }

  /**
   * The officer checked a closed job and it is not right. They only ask: the
   * coordinator, who runs the technicians, decides who redoes it and by when
   * (or declines). One open request per job.
   */
  requestRework(initiative: Initiative, workOrderId: string, reason: string | undefined, userId: string | undefined, now = this.clock.now()) {
    if (!initiative.onsite_work) throw new BadRequestException("This initiative has no on-site work to redo.");
    if (initiative.status !== "in-progress")
      throw new BadRequestException(`Rework can only be requested while the initiative is in progress (it is ${initiative.status}).`);
    const ticket = this.initiativeTickets(initiative.initiative_id).find((t) => this.latestWorkOrder(t)?.work_order_id === workOrderId);
    if (!ticket) throw new NotFoundException(`This initiative has no job ${workOrderId}.`);
    if (isOpenTicket(ticket)) throw new BadRequestException("That job is still open. Ask for rework once it has been closed.");
    if (ticket.rework_request?.status === "pending")
      throw new ConflictException("Rework was already requested for this job; the coordinator has not decided yet.");
    if (ticket.rework_request?.status === "sent" || this.initiativeTickets(initiative.initiative_id).some((t) => t.rework_of === workOrderId))
      throw new ConflictException("This job was already redone once. If the rework is not right either, request rework on the rework job.");
    const why = (reason ?? "").trim();
    if (why.length < 3) throw new BadRequestException("Say what needs redoing (at least 3 characters).");
    ticket.rework_request = { reason: why, requested_by: userId ?? null, requested_at: now.toISOString(), status: "pending" };
    this.notifyCoordinators(
      initiative.organization_id,
      `Rework requested on "${ticket.issue_type}": ${why}. Decide who redoes it, or decline.`,
      ticket.service_request_id,
      NotificationTargetType.REQUEST,
    );
  }

  /**
   * The coordinator's answer to a rework request: send it to the same
   * technician who did the job, let the system pick, hand-pick someone (all
   * with a finish date), or decline with a note to the officer.
   */
  decideRework(
    ticketId: string,
    dto: { decision: string; assignee_id?: string; finish_by?: string; note?: string },
    userId: string | undefined,
    now = this.clock.now(),
  ) {
    const ticket = assertTenantOwns(this.database.serviceRequests.find((t) => t.service_request_id === ticketId));
    if (!ticket || !ticket.source_initiative) throw new NotFoundException("Rework request not found.");
    const request = ticket.rework_request;
    if (!request || request.status !== "pending") throw new BadRequestException("There is no rework request waiting on this job.");
    const initiative = this.database.initiatives.find((i) => i.initiative_id === ticket.source_initiative);
    if (!initiative || initiative.status !== "in-progress")
      throw new BadRequestException("The initiative is no longer in progress.");
    const original = this.latestWorkOrder(ticket);
    const note = (dto.note ?? "").trim();
    const officers = this.officersOf(initiative);
    const job = `${teamWorkLabel(ticket.team)} work on "${initiative.title}"`;

    if (dto.decision === "decline") {
      if (note.length < 3) throw new BadRequestException("Say why the rework is declined (at least 3 characters); the officer sees it.");
      Object.assign(request, { status: "declined", decided_by: userId ?? null, decided_at: now.toISOString(), note });
      for (const id of officers) this.notify(id, initiative.organization_id, initiative.initiative_id, `Rework on ${job} was declined: ${note}`, NotificationTargetType.INITIATIVE);
      return request;
    }

    if (!["same", "auto", "pick"].includes(dto.decision))
      throw new BadRequestException("decision must be same, auto, pick or decline.");
    if (!isDateFromToday(dto.finish_by, now)) throw new BadRequestException("Give the rework a finish date (YYYY-MM-DD), today or later.");
    let assignee: string | null = null;
    if (dto.decision === "same") {
      assignee = original?.assigned_to_id ?? null;
      if (!assignee) throw new BadRequestException("Nobody is recorded on the original job; pick a technician instead.");
    } else if (dto.decision === "pick") {
      if (!dto.assignee_id) throw new BadRequestException("Choose the technician to send the rework to.");
      assignee = dto.assignee_id;
    }
    if (assignee) this.requireTechnician(assignee, initiative.organization_id);

    const reworkTicket = this.sendInitiativeJob(
      initiative,
      ticket.team!,
      endOfDay(dto.finish_by!),
      { of: original?.work_order_id ?? ticket.service_request_id, reason: request.reason },
      now,
      assignee,
    );
    Object.assign(request, {
      status: "sent",
      decided_by: userId ?? null,
      decided_at: now.toISOString(),
      note: note || null,
      rework_ticket_id: reworkTicket.service_request_id,
    });
    const who = reworkTicket.assigned_to_id ? this.nameOf(reworkTicket.assigned_to_id) : "the next free technician";
    for (const id of officers)
      this.notify(id, initiative.organization_id, initiative.initiative_id, `Rework on ${job} was sent to ${who}, finish by ${dto.finish_by}.`, NotificationTargetType.INITIATIVE);
    return request;
  }

  /** Rework requests waiting for the coordinator, for the "Needs you" strip. */
  pendingReworkRequests(orgId: string | null) {
    return this.database.serviceRequests
      .filter((t) => t.source_initiative && t.rework_request?.status === "pending" && (!orgId || t.organization_id === orgId))
      .map((t) => {
        const initiative = this.database.initiatives.find((i) => i.initiative_id === t.source_initiative);
        const wo = this.latestWorkOrder(t);
        return {
          ticket_id: t.service_request_id,
          initiative_id: t.source_initiative,
          initiative_title: initiative?.title ?? "",
          job_title: t.issue_type,
          team: t.team ?? null,
          team_label: teamLabel(t.team),
          reason: t.rework_request!.reason,
          requested_at: t.rework_request!.requested_at,
          requested_by_name: t.rework_request!.requested_by ? this.nameOf(t.rework_request!.requested_by) : null,
          original_technician_id: wo?.assigned_to_id ?? null,
          original_technician_name: wo?.assigned_to_id ? this.nameOf(wo.assigned_to_id) : null,
          target_date: initiative?.target_date ?? null,
        };
      });
  }

  /**
   * The initiative's target date moved: its open first-try jobs move with it
   * (their technicians are told). Rework jobs keep the date the coordinator
   * gave them.
   */
  retimeInitiative(initiative: Initiative, now = this.clock.now()) {
    const finishBy = endOfDay(initiative.target_date!);
    for (const t of this.initiativeTickets(initiative.initiative_id)) {
      if (!isOpenTicket(t) || t.rework_of) continue;
      t.finish_by = finishBy;
      const wo = this.workOrderFor(t);
      if (!wo?.dispatch) continue;
      wo.dispatch.fixed_deadline_at = finishBy;
      // Already sent to someone: the clock is running, so move its date.
      if (wo.dispatch.sla && wo.dispatch.sla.deadline_at !== finishBy) this.sla.setDeadline(wo.work_order_id, finishBy, now);
    }
  }

  private initiativeTickets(initiativeId: string): ServiceRequest[] {
    return this.database.serviceRequests
      .filter((t) => t.source_initiative === initiativeId)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  /** A ticket's work order, open or closed (the newest, if it was ever re-created). */
  private latestWorkOrder(t: ServiceRequest): WorkOrder | undefined {
    return this.database.workOrders
      .filter((w) => w.source_request_id === t.service_request_id)
      .sort((a, b) => String(b.dispatch?.assigned_at ?? "").localeCompare(String(a.dispatch?.assigned_at ?? "")))[0];
  }

  /** Who hears about an initiative's work: whoever proposed it, and every Sustainability Officer. */
  private officersOf(initiative: Initiative): string[] {
    return [
      ...new Set(
        [
          initiative.created_by_id,
          ...this.database.users
            .filter((u) => u.role === UserRole.SUSTAINABILITY_OFFICER && u.organization_id === initiative.organization_id)
            .map((u) => u.user_id),
        ].filter(Boolean) as string[],
      ),
    ];
  }

  /**
   * A job for an initiative was closed. Tell the officer; when it was the
   * last open one, ask them to check the work and complete the initiative.
   * The initiative itself does not move: the officer decides it is done.
   */
  private initiativeJobClosed(ticket: ServiceRequest) {
    if (!ticket.source_initiative) return;
    const initiative = this.database.initiatives.find((i) => i.initiative_id === ticket.source_initiative);
    if (!initiative) return;
    const stillOpen = this.initiativeTickets(initiative.initiative_id).filter(isOpenTicket);
    const message = stillOpen.length
      ? `${teamWorkLabel(ticket.team)} work for "${initiative.title}" is done. ${stillOpen.length} job${stillOpen.length === 1 ? " is" : "s are"} still open.`
      : `All work for "${initiative.title}" is done. Check it, then mark the initiative completed or request rework.`;
    for (const id of this.officersOf(initiative))
      this.notify(id, initiative.organization_id, initiative.initiative_id, message, NotificationTargetType.INITIATIVE);
  }

  private ticketLabel(t: ServiceRequest) {
    return `${t.issue_type ?? "Issue"}, ${this.locationOf(t)}`;
  }

  /** Tell everyone who reported or +1'd the issue, once per stage. */
  private notifyReporters(ticket: ServiceRequest, stage: string, message: string) {
    if (!ticket.item_id || ticket.source_fault_id || ticket.source_finding || ticket.source_wastage || ticket.source_initiative) return; // only student reports have reporters to tell
    ticket.student_notified ??= [];
    if (ticket.student_notified.includes(stage)) return;
    ticket.student_notified.push(stage);
    const people = new Set([ticket.reporter_id, ...(ticket.reporter_ids ?? []), ...(ticket.plus_one_ids ?? [])]);
    for (const id of people) if (id) this.notify(id, ticket.organization_id, ticket.service_request_id, message);
  }

  /** The ticket was closed by a person: its job is no longer needed. */
  closeForTicket(ticket: ServiceRequest, now = this.clock.now()) {
    ticket.closed_at = ticket.closed_at ?? now.toISOString();
    ticket.dispatch_state = undefined;
    const wo = this.workOrderFor(ticket);
    if (!wo) return;
    const holder = wo.assigned_to_id;
    wo.status = WorkOrderStatus.CLOSED;
    wo.dispatch!.history.push({ at: now.toISOString(), event: "closed_with_ticket", user_id: holder });
    this.notifyReporters(ticket, "fixed", `Fixed: ${this.ticketLabel(ticket)}. If it is still broken, tell us in My Reports.`);
    if (holder) this.notify(holder, wo.organization_id, wo.work_order_id, `"${wo.title}" was closed by the coordinator. You no longer need to do it.`);
    this.initiativeJobClosed(ticket);
  }

  /** Going unavailable gives back jobs not yet started; the next person gets them. */
  private releaseUnstarted(userId: string, now: Date) {
    for (const wo of this.database.workOrders) {
      if (!wo.dispatch || wo.assigned_to_id !== userId || wo.status !== WorkOrderStatus.NEW) continue;
      const ticket = this.ticketOf(wo);
      const hadAccepted = wo.dispatch.ack_status === "acknowledged";
      wo.dispatch.history.push({ at: now.toISOString(), event: "released", user_id: userId, reason: "went unavailable" });
      // Handing back a job they had already accepted counts as a decline, the
      // same as declining it, so switching off is not a way around that.
      if (hadAccepted) wo.dispatch.history.push({ at: now.toISOString(), event: "declined", user_id: userId, reason: "other" });
      wo.dispatch.tried.push(userId);
      this.release(wo);
      if (ticket) this.reassign(ticket, wo, now, "declined");
    }
  }

  /**
   * Gate for the older work-order routes, so they cannot be used to pick a
   * job or skip acknowledgement. Returns the (possibly trimmed) update.
   *   technician: only their own acknowledged job, only status/details;
   *               "reject" (assigned_to_id: null) is a decline
   *   coordinator: changing the assignee goes through the hand-pick path
   *   other staff (finance): status/details only
   */
  guardUpdate<T extends Record<string, any>>(wo: WorkOrder, dto: T, role: string | undefined, userId: string | undefined, now = this.clock.now()): T {
    if (!wo.dispatch) return dto;
    const out: Record<string, any> = { ...dto };
    const COORD = ["Operations Coordinator", "Facility Manager", "Organization Admin", "Super Admin"];

    if (role === "Technician") {
      if (wo.assigned_to_id !== userId) throw new ForbiddenException("This job is not assigned to you.");
      if (out.assigned_to_id === null && wo.status === WorkOrderStatus.NEW && wo.dispatch.ack_status !== "unassigned") {
        this.decline(userId!, wo.work_order_id, "other", now); // the old "reject" button
        return {} as T;
      }
      const allowed = ["status", "details"];
      const extra = Object.keys(out).filter((k) => !allowed.includes(k));
      if (extra.length) throw new ForbiddenException(`The system assigns and prioritises jobs; you cannot change: ${extra.join(", ")}.`);
      if (out.status !== undefined && wo.dispatch.ack_status !== "acknowledged") {
        throw new BadRequestException("Acknowledge the job first.");
      }
      // Only the coordinator verifies and closes. Closing is what marks the student's ticket Fixed.
      const TECH_STATUSES: string[] = [WorkOrderStatus.INPROGRESS, WorkOrderStatus.APPROVAL, WorkOrderStatus.REVIEW];
      if (out.status !== undefined && !TECH_STATUSES.includes(out.status)) {
        throw new ForbiddenException("Only the coordinator can close a job or send it back.");
      }
      this.estimateRules(wo, out, role, userId, now);
      return out as T;
    }

    if (COORD.includes(role ?? "")) {
      if ("assigned_to_id" in out) {
        const target = out.assigned_to_id;
        delete out.assigned_to_id;
        if (target && target !== wo.assigned_to_id && wo.source_request_id) {
          this.manualAssign(wo.source_request_id, target, now);
        } else if (target === null && wo.assigned_to_id) {
          const ticket = this.ticketOf(wo);
          wo.dispatch.tried.push(wo.assigned_to_id);
          this.release(wo);
          if (ticket) this.reassign(ticket, wo, now, "declined");
        }
      }
      this.estimateRules(wo, out, role, userId, now);
      return out as T;
    }

    const extra = Object.keys(out).filter((k) => !["status", "details"].includes(k));
    if (extra.length) throw new ForbiddenException(`You can only change the status of a dispatched job, not: ${extra.join(", ")}.`);
    // Finance approves or sends back a cost estimate; it never closes or completes a job.
    const OTHER_STATUSES: string[] = [WorkOrderStatus.NEW, WorkOrderStatus.INPROGRESS, WorkOrderStatus.APPROVAL];
    if (out.status !== undefined && !OTHER_STATUSES.includes(out.status)) {
      throw new ForbiddenException("Only the coordinator can close or review a job.");
    }
    this.estimateRules(wo, out, role, userId, now);
    return out as T;
  }

  /**
   * The cost-estimate loop between technician and Finance:
   *  - an estimate is the cost of materials, a number of 0 or more, and the
   *    total is worked out here, not taken from the browser;
   *  - while it waits for Finance the technician can neither edit it nor
   *    approve it themselves;
   *  - Finance can only answer an estimate that is waiting (approve = in
   *    progress, send back = new), and never starts other jobs;
   *  - sending an estimate back needs a reason, which the technician sees;
   *  - every answer records who gave it and when.
   */
  private estimateRules(wo: WorkOrder, out: Record<string, any>, role: string | undefined, userId: string | undefined, now: Date) {
    const waiting = wo.status === WorkOrderStatus.APPROVAL;

    if (role === "Technician") {
      if (waiting && ((out.status !== undefined && out.status !== WorkOrderStatus.APPROVAL) || out.details !== undefined)) {
        throw new ForbiddenException("The estimate is waiting for Finance. Only Finance or the coordinator can answer it.");
      }
      // A technician cannot write the decision on their own estimate.
      if (out.details && typeof out.details === "object") {
        const kept = wo.details?.decision;
        out.details = { ...out.details };
        if (kept === undefined) delete out.details.decision;
        else out.details.decision = kept;
      }
    }

    if (role === "Financial Analyst" && out.status !== undefined && out.status !== wo.status) {
      if (!waiting) throw new ForbiddenException("Finance can only answer a cost estimate that is waiting for approval.");
      if (out.status !== WorkOrderStatus.INPROGRESS && out.status !== WorkOrderStatus.NEW)
        throw new ForbiddenException("Finance can approve (in progress) or send the estimate back (new).");
      if (!wo.details?.estimate) throw new BadRequestException("There is no estimate to answer.");
    }

    // Sending an estimate to Finance.
    if (out.status === WorkOrderStatus.APPROVAL && !waiting) {
      const details = { ...(wo.details ?? {}), ...(out.details ?? {}) };
      const est = details.estimate;
      const materials = Number(est?.materials);
      if (!est || est.materials === "" || est.materials === null || !Number.isFinite(materials) || materials < 0)
        throw new BadRequestException("Enter the cost of the materials: a number of 0 or more.");
      const { labor: _ignored, ...rest } = est; // labour is not part of an estimate
      out.details = {
        ...details,
        estimate: { ...rest, materials, total: materials, submitted_by: userId ?? null, submitted_at: now.toISOString() },
        decision: undefined,
      };
      delete out.details.decision;
      delete out.details.decision_reason;
    }

    // Answering one: record who decided, and why when it is sent back.
    if (waiting && out.status !== undefined && out.status !== WorkOrderStatus.APPROVAL) {
      const approved = out.status === WorkOrderStatus.INPROGRESS;
      const reason = String(out.details?.decision_reason ?? "").trim();
      if (!approved && reason.length < 3) {
        throw new BadRequestException("Say why the estimate is sent back, so the technician knows what to change.");
      }
      const details = { ...(wo.details ?? {}), ...(out.details ?? {}) };
      delete details.decision_reason;
      out.details = {
        ...details,
        decision: {
          result: approved ? "approved" : "sent_back",
          by: userId ?? null,
          at: now.toISOString(),
          ...(approved ? {} : { reason: reason.slice(0, 300) }),
        },
      };
    }
  }

  /** Tell Finance when an estimate arrives and the technician when it is answered. */
  estimateNotices(previous: string, wo: WorkOrder) {
    if (!wo.dispatch) return;
    const total = wo.details?.estimate?.total;
    if (previous !== WorkOrderStatus.APPROVAL && wo.status === WorkOrderStatus.APPROVAL) {
      for (const u of this.database.users) {
        if (u.role === UserRole.FINANCIAL_ANALYST && u.organization_id === wo.organization_id) {
          this.notify(u.user_id, wo.organization_id, wo.work_order_id, `Cost estimate to review for "${wo.title}"${total !== undefined ? `: ${total}` : ""}.`, NotificationTargetType.REQUEST);
        }
      }
    } else if (previous === WorkOrderStatus.APPROVAL && wo.status !== WorkOrderStatus.APPROVAL && wo.assigned_to_id) {
      const approved = wo.status === WorkOrderStatus.INPROGRESS;
      this.notify(
        wo.assigned_to_id,
        wo.organization_id,
        wo.work_order_id,
        approved
          ? `Your estimate for "${wo.title}" was approved. You can start the work.`
          : `Your estimate for "${wo.title}" was sent back${wo.details?.decision?.reason ? `: ${wo.details.decision.reason}` : ""}. Please revise it.`,
      );
    }
  }

  private ownAcknowledged(userId: string, workOrderId: string): WorkOrder {
    const wo = this.requireDispatched(workOrderId);
    if (wo.assigned_to_id !== userId) throw new ForbiddenException("This job is not assigned to you.");
    if (wo.dispatch!.ack_status !== "acknowledged") throw new BadRequestException("Acknowledge the job first.");
    return wo;
  }

  // ── Timeouts and the waiting queue ─────────────────────────────────────

  /**
   * Run on a timer and from tests. Moves jobs whose acknowledgement window
   * ran out to the next person (and marks the person off for the day), then
   * retries tickets waiting in the queue.
   */
  sweep(now = this.clock.now()) {
    let missed = 0;
    // Each job and each step is isolated: one bad record is logged and
    // skipped, and everything after it still runs.
    for (const wo of this.database.workOrders) {
      const d = wo.dispatch;
      if (!d || d.ack_status !== "pending" || !d.ack_due_at || !wo.assigned_to_id) continue;
      if (new Date(d.ack_due_at).getTime() > now.getTime()) continue;
      try {
        const slow = wo.assigned_to_id;
        d.history.push({ at: now.toISOString(), event: "missed", user_id: slow, reason: "no response in time" });
        d.tried.push(slow);
        this.markOffToday(slow, now, "missed");
        const ticket = this.ticketOf(wo);
        this.release(wo);
        this.notifyCoordinators(wo.organization_id, `${this.nameOf(slow)} did not respond to "${wo.title}" in time. It was sent on.`, wo.work_order_id);
        if (ticket) this.reassign(ticket, wo, now, "missed");
        missed++;
      } catch (e) {
        this.log.error(`Sweep skipped work order ${wo.work_order_id}: ${(e as Error).message}`);
      }
    }
    let retried = 0;
    try {
      retried = this.retryQueued(now);
    } catch (e) {
      this.log.error(`Retry of queued tickets failed: ${(e as Error).message}`);
    }
    try {
      this.remindQueued(now);
    } catch (e) {
      this.log.error(`Queue reminders failed: ${(e as Error).message}`);
    }
    try {
      this.sla.evaluateAll(now);
    } catch (e) {
      this.log.error(`Deadline check failed: ${(e as Error).message}`);
    }
    return { missed, retried };
  }

  /** Re-offer queued tickets, most urgent (after ageing) first. */
  retryQueued(now = this.clock.now()): number {
    let placed = 0;
    for (const t of this.queuedTickets(now)) {
      if (t.queued_reason === "other_report") continue; // a person must pick the team
      try {
        const wo = this.workOrderFor(t);
        if (!wo) continue;
        this.assign(t, wo, wo.dispatch!.tried, now, true);
        if (t.dispatch_state === "assigned") placed++;
      } catch (e) {
        this.log.error(`Could not place ticket ${t.service_request_id}: ${(e as Error).message}`);
      }
    }
    return placed;
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  /** Jobs given to one technician, with the ticket facts they need. */
  mine(userId: string) {
    this.sla.evaluateAll();
    return this.database.workOrders
      .filter((w) => w.dispatch && w.assigned_to_id === userId && w.status !== WorkOrderStatus.CLOSED)
      .map((w) => this.workOrderView(w));
  }

  /** The coordinator's exception queue and the declines summary. */
  queue(now = this.clock.now()) {
    const org = currentOrgId();
    const queued = this.queuedTickets(now)
      .filter((t) => !org || t.organization_id === org)
      .map((t) => ({
        ticket_id: t.service_request_id,
        summary: t.issue_type,
        location: this.locationOf(t),
        team: t.team ?? null,
        priority: t.priority ?? "low",
        waiting_priority: agedPriority(t.priority ?? "low", t.created_at ?? now.toISOString(), now),
        reason: t.queued_reason ?? "manual",
        queued_at: t.queued_at ?? null,
        waiting_min: t.queued_at ? Math.max(0, Math.round((now.getTime() - new Date(t.queued_at).getTime()) / 60000)) : 0,
        tried: this.workOrderFor(t)?.dispatch?.tried ?? [],
        suggested: this.suggestionFor(t, now),
      }));

    const weekAgo = now.getTime() - WEEK_MS;
    const techs = this.database.users.filter(
      (u) => u.role === UserRole.TECHNICIAN && (!org || u.organization_id === org),
    );
    const declines = techs
      .map((u) => ({
        user_id: u.user_id,
        name: u.name,
        team: teamOfUser(u),
        declines_this_week: this.countEvents(u.user_id, "declined", weekAgo),
        missed_this_week: this.countEvents(u.user_id, "missed", weekAgo),
        available: this.availabilityOf(u, now).available,
        open_points: this.candidateOf(u, now).openPoints,
      }))
      .filter((r) => r.declines_this_week || r.missed_this_week);

    return {
      queued,
      declines,
      team_status: this.teamStatus(org, now),
      rework_requests: this.pendingReworkRequests(org),
      ...this.sla.overview(org, now),
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────

  /**
   * The person the ranking would pick if the job were sent now, for the
   * coordinator's one-click choice. Not for "Other" reports (no team yet).
   * Ignores who already declined: the coordinator may want them back.
   */
  private suggestionFor(t: ServiceRequest, now: Date): { user_id: string; name: string } | null {
    const wo = this.workOrderFor(t);
    if (!t.team || t.queued_reason === "other_report" || !wo?.dispatch) return null;
    const people = this.candidates(t.organization_id);
    const job = this.jobOf(t, wo);
    const pick = rankCandidates(job, people, { now, exclude: [] })[0] ?? (job.priority === "immediate" ? criticalFallback(job, people, { now, exclude: [] }) : null);
    return pick ? { user_id: pick.userId, name: this.nameOf(pick.userId) } : null;
  }

  /**
   * A ticket waiting for a person is easy to forget. Remind the coordinators
   * again every 15 minutes for Critical and every 2 hours for the rest.
   */
  private remindQueued(now: Date) {
    for (const t of this.queuedTickets(now)) {
      const every = (t.priority === "immediate" ? 15 : 120) * 60000;
      const last = new Date(t.queued_reminded_at ?? t.queued_at ?? now.toISOString()).getTime();
      if (now.getTime() - last < every) continue;
      t.queued_reminded_at = now.toISOString();
      this.notifyCoordinators(t.organization_id, `Still waiting for a person: ${t.issue_type}, ${this.locationOf(t)}.`, t.service_request_id, NotificationTargetType.REQUEST);
    }
  }

  private teamStatus(org: string | null, now: Date) {
    return this.database.users
      .filter((u) => u.role === UserRole.TECHNICIAN && (!org || u.organization_id === org))
      .map((u) => ({
        user_id: u.user_id,
        name: u.name,
        team: teamOfUser(u),
        ...this.availabilityOf(u, now),
      }));
  }

  private createWorkOrder(ticket: ServiceRequest, now: Date): WorkOrder {
    const dispatch: WorkOrderDispatch = {
      team: String(ticket.team ?? ""),
      size: (ticket.size ?? "M") as Size,
      points: ticket.points ?? 2,
      building_id: ticket.building_id,
      assigned_at: null,
      ack_status: "unassigned",
      ack_due_at: null,
      acknowledged_at: null,
      tried: [],
      history: [],
      fixed_deadline_at: ticket.finish_by ?? null,
    };
    const wo: WorkOrder = {
      work_order_id: crypto.randomUUID(),
      organization_id: ticket.organization_id,
      assigned_to_id: null,
      linked_fault_id: ticket.source_fault_id ?? null,
      source_request_id: ticket.service_request_id,
      title: ticket.source_fault_id ? `Fault: ${ticket.issue_type}` : `${ticket.issue_type} – ${this.locationOf(ticket)}`,
      priority: (ticket.priority ?? "low") as WorkOrderPriority,
      status: WorkOrderStatus.NEW,
      // The "Type" column: what raised the job (a fault's own type is set by sendFault).
      details: { type: jobTypeOf(ticket) },
      dispatch,
    };
    this.database.workOrders.push(wo);
    return wo;
  }

  /** Pick the best person for an existing work order and hand it over. */
  private assign(ticket: ServiceRequest, wo: WorkOrder, exclude: string[], now: Date, fromQueue = false) {
    const job = this.jobOf(ticket, wo);
    const people = this.candidates(ticket.organization_id);
    const ranked = rankCandidates(job, people, { now, exclude });
    let pick = ranked[0];
    // A "still broken" report goes back first to whoever did the earlier fix,
    // when they can take it under the usual rules. Asked once: after that
    // (they declined, or could not take it) the job is ranked as usual.
    const preferId = ticket.prefer_technician_id;
    if (preferId) {
      ticket.prefer_technician_id = null;
      const preferred = ranked.find((r) => r.userId === preferId);
      if (preferred) pick = preferred;
      else
        this.notifyCoordinators(
          ticket.organization_id,
          `"${wo.title}" came back as still broken. ${this.nameOf(preferId)}, who fixed it before, ${this.whyNotFree(preferId, job.team, job.points, now)}, so it was ranked as usual. Reassign it if you want.`,
          wo.work_order_id,
        );
    }
    let fallback = false;
    if (!pick && job.priority === "immediate") {
      pick = criticalFallback(job, people, { now, exclude }) ?? undefined;
      fallback = !!pick;
    }
    if (!pick) {
      if (!fromQueue) {
        const reason = exclude.length ? "all_declined" : "no_one_available";
        this.enqueue(ticket, reason, now, wo);
      }
      return;
    }

    const d = wo.dispatch!;
    wo.assigned_to_id = pick.userId;
    d.assigned_at = now.toISOString();
    d.ack_status = "pending";
    d.ack_due_at = this.dueAt(wo.priority, now);
    d.history.push({
      at: d.assigned_at,
      event: d.history.some((h) => h.event === "assigned") ? "reassigned" : "assigned",
      user_id: pick.userId,
      reason: fallback ? "critical job, lowest load (over the usual cap)" : undefined,
    });
    this.sla.start(wo, now);
    ticket.assigned_to_id = pick.userId;
    ticket.dispatch_state = "assigned";
    ticket.queued_reason = undefined;
    ticket.queued_at = null;

    const msg =
      wo.priority === "immediate"
        ? `CRITICAL job for you: ${wo.title}. Acknowledge within ${ackWindowMinutes(wo.priority)} minutes.`
        : `New job for you: ${wo.title}. Acknowledge or decline.`;
    this.notify(pick.userId, ticket.organization_id, wo.work_order_id, msg);
    this.notifyReporters(ticket, "assigned", `Your report is with a technician: ${this.ticketLabel(ticket)}.`);
    if (fallback) {
      this.notifyCoordinators(ticket.organization_id, `Critical job "${wo.title}" went to ${this.nameOf(pick.userId)} above the usual load cap, because no one else on the team was free.`, wo.work_order_id);
    }
  }

  /** Why a technician could not be given a job right now, in a few words. */
  private whyNotFree(userId: string, team: string | undefined, points: number, now: Date): string {
    const u = this.database.users.find((x) => x.user_id === userId);
    if (!u || u.role !== UserRole.TECHNICIAN) return "is no longer a technician here";
    const c = this.candidateOf(u, now);
    if (c.team !== team) return `is no longer on the ${teamLabel(team)} team`;
    if (u.unavailable_on === todayKey(now)) return "is off for today";
    if (!isSwitchedOn(u, now)) return "is not available today";
    if (c.openPoints + points > MAX_LOAD) return "is full";
    return "could not take it";
  }

  /** Who did the work on a ticket (the technician on its latest work order). */
  lastTechnicianOf(ticket: ServiceRequest): string | null {
    return this.latestWorkOrder(ticket)?.assigned_to_id ?? null;
  }

  private reassign(ticket: ServiceRequest, wo: WorkOrder, now: Date, why: "declined" | "missed") {
    this.assign(ticket, wo, wo.dispatch!.tried, now);
    if (ticket.dispatch_state !== "assigned") {
      this.notifyCoordinators(ticket.organization_id, `"${wo.title}" needs a person: everyone on the team has ${why === "declined" ? "declined" : "been tried"} or is unavailable.`, wo.work_order_id);
    }
  }

  private enqueue(ticket: ServiceRequest, reason: string, now: Date, wo?: WorkOrder) {
    ticket.dispatch_state = "queued";
    ticket.queued_reason = reason;
    ticket.queued_at = ticket.queued_at ?? now.toISOString();
    ticket.assigned_to_id = null;
    if (wo?.dispatch) {
      wo.dispatch.history.push({ at: now.toISOString(), event: "queued", user_id: null, reason });
    }
    const why: Record<string, string> = {
      other_report: "An \"Other\" report needs a team chosen",
      no_one_available: "No one on the team is free for a job",
      all_declined: "Everyone has declined or is unavailable for a job",
    };
    this.notifyCoordinators(ticket.organization_id, `${why[reason] ?? "A job needs a person"}: ${ticket.issue_type} – ${this.locationOf(ticket)}.`, ticket.service_request_id, NotificationTargetType.REQUEST);
  }

  /** Take the job off the current person. The history keeps who had it. */
  private release(wo: WorkOrder) {
    wo.assigned_to_id = null;
    wo.dispatch!.ack_status = "unassigned";
    wo.dispatch!.ack_due_at = null;
    wo.dispatch!.acknowledged_at = null;
  }

  private queuedTickets(now: Date): ServiceRequest[] {
    return this.database.serviceRequests
      .filter((t) => t.dispatch_state === "queued" && !["closed", "resolved", "completed"].includes(String(t.status).toLowerCase()))
      .sort(
        (a, b) =>
          levelOrder(agedPriority(b.priority ?? "low", b.created_at ?? "", now)) -
            levelOrder(agedPriority(a.priority ?? "low", a.created_at ?? "", now)) ||
          String(a.created_at).localeCompare(String(b.created_at)),
      );
  }

  private candidates(orgId: string): Candidate[] {
    return this.database.users
      .filter((u) => u.role === UserRole.TECHNICIAN && u.organization_id === orgId)
      .map((u) => this.candidateOf(u));
  }

  private candidateOf(u: User, now = this.clock.now()): Candidate {
    const mine = this.database.workOrders.filter((w) => w.dispatch && w.assigned_to_id === u.user_id);
    // Load is work still on the technician's hands. A job waiting for the
    // coordinator's check or for Finance no longer holds them back.
    const open = mine.filter(
      (w) => w.status === WorkOrderStatus.NEW || w.status === WorkOrderStatus.INPROGRESS,
    );
    const history = this.database.workOrders.flatMap((w) =>
      (w.dispatch?.history ?? [])
        .filter((h) => (h.event === "assigned" || h.event === "reassigned" || h.event === "manual") && h.user_id === u.user_id)
        .map((h) => ({ points: w.dispatch!.points, size: w.dispatch!.size, assignedAt: h.at })),
    );
    return {
      userId: u.user_id,
      team: teamOfUser(u),
      available: isSwitchedOn(u, now),
      unavailableOn: u.unavailable_on ?? null,
      openPoints: open.reduce((n, w) => n + w.dispatch!.points, 0),
      openJobs: open.length,
      openBuildings: open.map((w) => w.dispatch!.building_id).filter((b): b is string => !!b),
      past: history,
    };
  }

  private jobOf(ticket: ServiceRequest, wo: WorkOrder): Job {
    return {
      team: ticket.team as Team,
      points: wo.dispatch!.points,
      size: wo.dispatch!.size,
      priority: wo.priority,
      buildingId: ticket.building_id,
    };
  }

  private dueAt(priority: string, now: Date): string {
    return new Date(now.getTime() + ackWindowMinutes(priority) * 60_000).toISOString();
  }

  private markOffToday(userId: string, now: Date, reason: "sick" | "missed") {
    const u = this.database.users.find((x) => x.user_id === userId);
    if (u) {
      u.unavailable_on = todayKey(now);
      u.unavailable_reason = reason;
    }
  }

  /**
   * The coordinator puts a technician back on duty: clears "off for today"
   * (declined as unwell by mistake, or a missed answer) and switches them
   * available. Jobs waiting in the queue are offered again.
   */
  backOnDuty(userId: string, coordinatorId: string | undefined, now = this.clock.now()) {
    const user = this.requireTechnician(userId, currentOrgId());
    user.unavailable_on = null;
    user.unavailable_reason = null;
    user.available = true;
    user.switched_off_on = null;
    this.notify(
      user.user_id,
      user.organization_id,
      user.user_id,
      `${coordinatorId ? this.nameOf(coordinatorId) : "Your coordinator"} put you back on duty. You can be sent new jobs again today.`,
    );
    this.retryQueued(now);
    return { user_id: user.user_id, name: user.name, ...this.availabilityOf(user, now) };
  }

  private countEvents(userId: string, event: string, sinceMs: number): number {
    let n = 0;
    for (const w of this.database.workOrders) {
      for (const h of w.dispatch?.history ?? []) {
        if (h.event === event && h.user_id === userId && new Date(h.at).getTime() >= sinceMs) n++;
      }
    }
    return n;
  }

  private recentDeclines(userId: string, now: Date) {
    return this.countEvents(userId, "declined", now.getTime() - WEEK_MS);
  }

  workOrderFor(ticket: ServiceRequest): WorkOrder | undefined {
    return this.database.workOrders.find(
      (w) => w.dispatch && w.source_request_id === ticket.service_request_id && w.status !== WorkOrderStatus.CLOSED,
    );
  }

  private ticketOf(wo: WorkOrder): ServiceRequest | undefined {
    return this.database.serviceRequests.find((t) => t.service_request_id === wo.source_request_id);
  }

  /** The ticket's level changed (crowd, joined report, coordinator): keep its work order in step. */
  syncPriority(ticket: ServiceRequest) {
    const wo = this.workOrderFor(ticket);
    if (wo && ticket.priority) {
      wo.priority = ticket.priority as WorkOrderPriority;
      this.sla.onPriorityChange(wo);
    }
  }

  private requireTicket(id: string): ServiceRequest {
    const t = assertTenantOwns(this.database.serviceRequests.find((x) => x.service_request_id === id));
    if (!t) throw new NotFoundException(`Service request ${id} not found`);
    return t;
  }

  private requireDispatched(id: string): WorkOrder {
    const wo = assertTenantOwns(this.database.workOrders.find((x) => x.work_order_id === id));
    if (!wo || !wo.dispatch) throw new NotFoundException(`Dispatched work order ${id} not found`);
    return wo;
  }

  private requireTechnician(userId: string, orgId: string | null | undefined): User {
    const u = this.database.users.find((x) => x.user_id === userId);
    if (!u || u.role !== UserRole.TECHNICIAN) throw new BadRequestException("Pick a technician.");
    if (orgId && u.organization_id !== orgId) {
      throw new BadRequestException("That technician belongs to a different organisation.");
    }
    return u;
  }

  private nameOf(userId: string) {
    return this.database.users.find((u) => u.user_id === userId)?.name ?? "A technician";
  }

  /** "Building 1, floor 3, restroom, near lift": the place in words, never raw ids. */
  private locationOf(t: ServiceRequest) {
    const b = this.database.buildings.find((x) => x.building_id === t.building_id)?.name ?? "";
    const floorLabel = FLOORS.find((f) => f.id === t.floor)?.label ?? t.floor;
    const floor =
      !t.floor || t.floor === "whole_building" ? (t.floor ? "whole building" : "") : t.floor === "outside" ? "outside" : `floor ${floorLabel}`;
    const area = t.area && !["whole_building", "outside"].includes(t.area) ? AREAS.find((a) => a.id === t.area)?.label.toLowerCase() : "";
    const part = PARTS[t.area as AreaId]?.find((x) => x.id === t.part)?.label.toLowerCase() ?? t.part;
    return [b, floor, area, part].filter(Boolean).join(", ");
  }

  /** Where the technician's cost estimate stands, so their inbox can say so. */
  private estimateView(wo: WorkOrder) {
    const est = wo.details?.estimate;
    if (!est) return null;
    const sentBack = wo.status === WorkOrderStatus.NEW && wo.details?.decision?.result === "sent_back";
    return {
      total: est.total ?? null,
      state: wo.status === WorkOrderStatus.APPROVAL ? "waiting" : sentBack ? "sent_back" : "approved",
      reason: sentBack ? (wo.details?.decision?.reason ?? "") : "",
    };
  }

  private workOrderView(wo: WorkOrder) {
    const t = this.ticketOf(wo);
    const d = wo.dispatch!;
    return {
      work_order_id: wo.work_order_id,
      title: wo.title,
      priority: wo.priority,
      status: wo.status,
      ack_status: d.ack_status,
      ack_due_at: d.ack_due_at,
      assigned_at: d.assigned_at,
      acknowledged_at: d.acknowledged_at,
      team: d.team,
      size: d.size,
      points: d.points,
      ticket_id: wo.source_request_id,
      location: t ? this.locationOf(t) : "",
      description: t?.description ?? "",
      /** A "still broken" report: the reporter's photo can be fetched from /service-requests/:ticket_id/reopen-photo. */
      has_reopen_photo: !!t?.reopen_photo,
      sla: this.sla.view(wo),
      estimate: this.estimateView(wo),
    };
  }

  private notify(userId: string, orgId: string, targetId: string, message: string, type = NotificationTargetType.REQUEST) {
    this.database.notifications.push({
      notification_id: crypto.randomUUID(),
      organization_id: orgId,
      user_id: userId,
      target_type: type,
      target_id: targetId,
      message,
      is_read: false,
    });
  }

  private notifyCoordinators(orgId: string, message: string, targetId: string, type = NotificationTargetType.REQUEST) {
    for (const u of this.database.users) {
      if (u.role === UserRole.OPERATIONS_COORDINATOR && u.organization_id === orgId) {
        this.notify(u.user_id, orgId, targetId, message, type);
      }
    }
  }
}
