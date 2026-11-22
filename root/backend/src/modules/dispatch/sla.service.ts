/**
 * Deadlines for dispatched jobs.
 *
 * Nothing here relies on a running timer: every deadline is stored as a
 * date, and `evaluate` works out from `now` what has happened (warnings,
 * lateness) and records it once. It runs on the minute sweep AND whenever a
 * screen reads, so a restart never loses a warning.
 *
 * The app measures and reports; it never mentions pay or penalties. What the
 * campus does about a late job happens outside the app.
 */
import * as crypto from "crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DatabaseService,
  NotificationTargetType,
  Sla,
  SlaRequest,
  UserRole,
  WorkOrder,
  WorkOrderStatus,
} from "../../core/database/database.service";
import { assertTenantOwns } from "../../core/tenancy/tenant-context";
import { Clock } from "./clock";
import {
  PARTS_DEFAULT_DAYS,
  PARTS_MAX_DAYS,
  WARN_AT,
  deadlineFrom,
  hoursLeft,
  safeBy,
  usedFraction,
} from "./deadlines";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DONE: string[] = [WorkOrderStatus.REVIEW, WorkOrderStatus.CLOSED];

@Injectable()
export class SlaService {
  constructor(
    private database: DatabaseService,
    private clock: Clock,
  ) {}

  // ── Lifecycle hooks used by dispatch ───────────────────────────────────

  /** The clock starts the first time the job is sent to a person. */
  start(wo: WorkOrder, now = this.clock.now()) {
    const d = wo.dispatch;
    if (!d || d.sla) return;
    const deadline = deadlineFrom(now, wo.priority, d.size).toISOString();
    d.sla = {
      started_at: now.toISOString(),
      deadline_at: deadline,
      original_deadline_at: deadline,
      fixed_by_coordinator: false,
      safe_by: wo.priority === "immediate" ? safeBy(now).toISOString() : null,
      made_safe_at: null,
      paused_since: null,
      expected_back: null,
      paused_ms: 0,
      warned: { half: false, ninety: false, passed: false, unsafe: false },
      late: false,
      request: null,
      requests_log: [],
    };
  }

  /** A higher level only ever tightens the deadline; it never gives time back. */
  onPriorityChange(wo: WorkOrder, now = this.clock.now()) {
    const s = wo.dispatch?.sla;
    if (!s || DONE.includes(wo.status)) return;
    if (wo.priority === "immediate" && !s.safe_by && !s.made_safe_at) {
      s.safe_by = safeBy(now).toISOString();
    }
    if (s.fixed_by_coordinator) return;
    const candidate = deadlineFrom(new Date(s.started_at), wo.priority, wo.dispatch!.size, s.paused_ms);
    if (candidate.getTime() < new Date(s.deadline_at).getTime()) {
      s.deadline_at = candidate.toISOString();
      this.tellAssignee(wo, `The level of "${wo.title}" rose, so its finish date is now ${this.when(s.deadline_at)}.`);
    }
  }

  /** Warnings, pauses ending and lateness. Safe to call any number of times. */
  evaluate(wo: WorkOrder, now = this.clock.now()) {
    const s = wo.dispatch?.sla;
    if (!s || DONE.includes(wo.status)) return;
    const deadline = new Date(s.deadline_at).getTime();

    // An unanswered request is dead once the original date passes.
    if (s.request && now.getTime() >= deadline) {
      s.request.status = "expired";
      s.request.decided_at = now.toISOString();
      s.request = null;
    }
    if (s.paused_since && s.expected_back && now.getTime() >= new Date(s.expected_back).getTime()) {
      this.endPause(wo, new Date(s.expected_back));
      this.tellAssignee(wo, `The parts wait for "${wo.title}" has ended and the clock is running again.`);
    }
    if (s.paused_since) return;

    if (s.safe_by && !s.made_safe_at && !s.warned.unsafe && now.getTime() >= new Date(s.safe_by).getTime()) {
      s.warned.unsafe = true;
      this.tellCoordinators(wo, `Critical job "${wo.title}" has not been marked safe within ${2} hours.`);
    }

    const f = usedFraction(s.started_at, s.deadline_at, now);
    if (f >= WARN_AT[0] && !s.warned.half) {
      s.warned.half = true;
      this.tellAssignee(wo, `Half the time for "${wo.title}" has passed (finish by ${this.when(s.deadline_at)}). Need longer? Request an extension.`);
    }
    if (f >= WARN_AT[1] && !s.warned.ninety) {
      s.warned.ninety = true;
      this.tellAssignee(wo, `"${wo.title}" is almost due (finish by ${this.when(s.deadline_at)}). Request an extension if you need more time.`);
    }
    if (f >= 1 && !s.warned.passed) {
      s.warned.passed = true;
      s.late = true;
      wo.dispatch!.history.push({ at: now.toISOString(), event: "deadline_passed", user_id: wo.assigned_to_id });
      this.tellCoordinators(wo, `"${wo.title}" is past its finish date. It still needs finishing; you can extend the date.`);
    }
  }

  evaluateAll(now = this.clock.now()) {
    for (const wo of this.database.workOrders) this.evaluate(wo, now);
  }

  // ── Technician actions ─────────────────────────────────────────────────

  /** Pause the clock while waiting for parts. Over 5 days goes to the coordinator. */
  needsParts(userId: string, workOrderId: string, days = PARTS_DEFAULT_DAYS, now = this.clock.now()) {
    const wo = this.ownedBy(userId, workOrderId);
    const s = this.slaOf(wo);
    this.evaluate(wo, now);
    if (s.paused_since) throw new BadRequestException("The clock is already paused for parts.");
    if (!Number.isFinite(days) || days < 1 || days > 60) throw new BadRequestException("Give the expected wait in days (1 to 60).");
    if (days > PARTS_MAX_DAYS) {
      if (s.request) throw new BadRequestException("You already have a request waiting for the coordinator.");
      this.openRequest(wo, { kind: "parts", by: userId, parts_days: days, reason: `Waiting for parts for about ${days} days.` }, now);
      this.tellCoordinators(wo, `${this.nameOf(userId)} needs parts for ~${days} days on "${wo.title}". That is over ${PARTS_MAX_DAYS} days and needs your OK.`);
    } else {
      this.beginPause(wo, days, now);
    }
    return this.view(wo, now);
  }

  resume(userId: string, workOrderId: string, now = this.clock.now()) {
    const wo = this.ownedBy(userId, workOrderId);
    const s = this.slaOf(wo);
    if (!s.paused_since) throw new BadRequestException("The clock is not paused.");
    this.endPause(wo, now);
    return this.view(wo, now);
  }

  madeSafe(userId: string, workOrderId: string, now = this.clock.now()) {
    const wo = this.ownedBy(userId, workOrderId);
    const s = this.slaOf(wo);
    if (!s.safe_by) throw new BadRequestException("Only Critical jobs have a make-safe step.");
    if (!s.made_safe_at) {
      s.made_safe_at = now.toISOString();
      wo.dispatch!.history.push({ at: s.made_safe_at, event: "made_safe", user_id: userId });
      this.tellCoordinators(wo, `${this.nameOf(userId)} made "${wo.title}" safe.`);
    }
    return this.view(wo, now);
  }

  requestExtension(userId: string, workOrderId: string, newDeadlineAt: string, reason: string, now = this.clock.now()) {
    const wo = this.ownedBy(userId, workOrderId);
    const s = this.slaOf(wo);
    this.evaluate(wo, now);
    const date = new Date(newDeadlineAt);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Give a valid new date.");
    if (date.getTime() <= new Date(s.deadline_at).getTime()) throw new BadRequestException("The new date must be later than the current finish date.");
    if ((reason ?? "").trim().length < 3) throw new BadRequestException("Give a short reason.");
    if (s.request) throw new BadRequestException("You already have a request waiting for the coordinator.");
    this.openRequest(wo, { kind: "extension", by: userId, new_deadline_at: date.toISOString(), reason: reason.trim() }, now);
    this.tellCoordinators(wo, `${this.nameOf(userId)} asked for more time on "${wo.title}", until ${this.when(date.toISOString())}: ${reason.trim()}`);
    return this.view(wo, now);
  }

  // ── Coordinator actions ────────────────────────────────────────────────

  /** Approve or refuse a technician's request. The clock keeps running meanwhile. */
  decide(workOrderId: string, approve: boolean, now = this.clock.now()) {
    const wo = this.requireOrder(workOrderId);
    const s = this.slaOf(wo);
    const req = s.request;
    if (!req) throw new BadRequestException("Nothing is waiting for a decision on this job.");
    req.status = approve ? "approved" : "denied";
    req.decided_at = now.toISOString();
    s.request = null;
    if (approve && req.kind === "extension") {
      s.deadline_at = req.new_deadline_at!;
      s.fixed_by_coordinator = true;
      this.recomputeWarnings(s, now);
    } else if (approve && req.kind === "parts") {
      this.beginPause(wo, req.parts_days!, now);
    }
    this.tellAssignee(wo, approve ? `Your request for "${wo.title}" was approved.` : `Your request for "${wo.title}" was not approved. The finish date stays ${this.when(s.deadline_at)}.`);
    return this.view(wo, now);
  }

  /** The coordinator can change any job's deadline, up or down. */
  setDeadline(workOrderId: string, deadlineAt: string, now = this.clock.now()) {
    const wo = this.requireOrder(workOrderId);
    const s = this.slaOf(wo);
    const date = new Date(deadlineAt);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Give a valid date.");
    if (date.getTime() <= new Date(s.started_at).getTime()) throw new BadRequestException("The finish date must be after the job was sent.");
    s.deadline_at = date.toISOString();
    s.fixed_by_coordinator = true;
    this.recomputeWarnings(s, now);
    this.tellAssignee(wo, `The finish date for "${wo.title}" is now ${this.when(s.deadline_at)}.`);
    return this.view(wo, now);
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  view(wo: WorkOrder, now = this.clock.now()) {
    const s = wo.dispatch?.sla;
    if (!s) return null;
    return {
      started_at: s.started_at,
      deadline_at: s.deadline_at,
      original_deadline_at: s.original_deadline_at,
      hours_left: hoursLeft(s.deadline_at, now),
      late: s.late,
      paused: !!s.paused_since,
      expected_back: s.expected_back,
      safe_by: s.safe_by,
      made_safe_at: s.made_safe_at,
      request: s.request,
      delays: this.delays(wo, now),
    };
  }

  /** What the coordinator needs: requests to decide, jobs past their date. */
  overview(orgId: string | null, now = this.clock.now()) {
    this.evaluateAll(now);
    const mine = this.database.workOrders.filter(
      (w) => w.dispatch?.sla && !DONE.includes(w.status) && (!orgId || w.organization_id === orgId),
    );
    const row = (w: WorkOrder) => ({
      work_order_id: w.work_order_id,
      title: w.title,
      priority: w.priority,
      technician: w.assigned_to_id ? this.nameOf(w.assigned_to_id) : null,
      ...this.view(w, now)!,
    });
    return {
      requests: mine.filter((w) => w.dispatch!.sla!.request).map(row),
      overdue: mine.filter((w) => w.dispatch!.sla!.late).map(row),
      unsafe: mine.filter((w) => w.dispatch!.sla!.warned.unsafe && !w.dispatch!.sla!.made_safe_at).map(row),
    };
  }

  /**
   * Where the time went, so a technician is not blamed for a staffing gap:
   * waiting for staff · waiting to start · working · waiting for parts.
   */
  delays(wo: WorkOrder, now = this.clock.now()) {
    const d = wo.dispatch!;
    const s = d.sla!;
    const ticket = this.database.serviceRequests.find((t) => t.service_request_id === wo.source_request_id);
    const created = new Date(ticket?.created_at ?? s.started_at).getTime();
    const sent = new Date(s.started_at).getTime();
    const ack = d.acknowledged_at ? new Date(d.acknowledged_at).getTime() : null;
    const end = now.getTime();
    const partsNow = s.paused_since ? end - new Date(s.paused_since).getTime() : 0;
    const parts = s.paused_ms + partsNow;
    const min = (ms: number) => Math.max(0, Math.round(ms / 60000));
    return {
      waiting_for_staff_min: min(sent - created),
      waiting_to_start_min: min((ack ?? end) - sent),
      working_min: ack ? min(end - ack - parts) : 0,
      waiting_for_parts_min: min(parts),
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private beginPause(wo: WorkOrder, days: number, now: Date) {
    const s = wo.dispatch!.sla!;
    s.paused_since = now.toISOString();
    s.expected_back = new Date(now.getTime() + days * DAY_MS).toISOString();
    wo.dispatch!.history.push({ at: s.paused_since, event: "parts_wait", user_id: wo.assigned_to_id, reason: `${days} days` });
  }

  /** Give the paused time back to the deadline. */
  private endPause(wo: WorkOrder, at: Date) {
    const s = wo.dispatch!.sla!;
    const paused = Math.max(0, at.getTime() - new Date(s.paused_since!).getTime());
    s.paused_ms += paused;
    s.deadline_at = new Date(new Date(s.deadline_at).getTime() + paused).toISOString();
    s.paused_since = null;
    s.expected_back = null;
    wo.dispatch!.history.push({ at: at.toISOString(), event: "parts_resumed", user_id: wo.assigned_to_id });
  }

  private openRequest(wo: WorkOrder, r: Omit<SlaRequest, "id" | "requested_at" | "status">, now: Date) {
    const s = wo.dispatch!.sla!;
    const req: SlaRequest = { id: crypto.randomUUID(), requested_at: now.toISOString(), status: "pending", ...r };
    s.request = req;
    s.requests_log.push(req);
  }

  /** After the date moves, the warnings already behind us must not fire again. */
  private recomputeWarnings(s: Sla, now: Date) {
    const f = usedFraction(s.started_at, s.deadline_at, now);
    s.warned.half = f >= WARN_AT[0];
    s.warned.ninety = f >= WARN_AT[1];
    s.warned.passed = f >= 1;
    // `late` stays: it records that the first date was missed.
  }

  private slaOf(wo: WorkOrder): Sla {
    if (!wo.dispatch?.sla) throw new BadRequestException("This job has no deadline yet: it has not been sent to anyone.");
    return wo.dispatch.sla;
  }

  private requireOrder(id: string): WorkOrder {
    const wo = assertTenantOwns(this.database.workOrders.find((w) => w.work_order_id === id));
    if (!wo || !wo.dispatch) throw new NotFoundException(`Dispatched work order ${id} not found`);
    return wo;
  }

  private ownedBy(userId: string, id: string): WorkOrder {
    const wo = this.requireOrder(id);
    if (wo.assigned_to_id !== userId) throw new ForbiddenException("This job is not assigned to you.");
    if (wo.dispatch!.ack_status !== "acknowledged") throw new BadRequestException("Acknowledge the job first.");
    return wo;
  }

  private nameOf(id: string) {
    return this.database.users.find((u) => u.user_id === id)?.name ?? "A technician";
  }

  private when(iso: string) {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }

  private tellAssignee(wo: WorkOrder, message: string) {
    if (wo.assigned_to_id) this.push(wo, wo.assigned_to_id, message);
  }

  private tellCoordinators(wo: WorkOrder, message: string) {
    for (const u of this.database.users) {
      if (u.role === UserRole.OPERATIONS_COORDINATOR && u.organization_id === wo.organization_id) this.push(wo, u.user_id, message);
    }
  }

  private push(wo: WorkOrder, userId: string, message: string) {
    this.database.notifications.push({
      notification_id: crypto.randomUUID(),
      organization_id: wo.organization_id,
      user_id: userId,
      target_type: NotificationTargetType.REQUEST,
      target_id: wo.work_order_id,
      message,
      is_read: false,
    });
  }
}
