import { DispatchService } from "../dispatch/dispatch.service";
import { Clock } from "../dispatch/clock";
import * as crypto from "crypto";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  DatabaseService,
  NotificationTargetType,
  ServiceRequest,
  UserRole,
} from "../../core/database/database.service";
import { pushNotifications, usersWithRole } from "../../core/utils/notify";
import { currentOrgId, scopeToTenant } from "../../core/tenancy/tenant-context";
import {
  AREAS,
  AreaId,
  FLOORS,
  ISSUE_TYPES,
  MAX_FLOOR,
  OTHER_ITEM_ID,
  PARTS,
  findIssueType,
  findItem,
  findProblem,
  alertsOfficer,
  normaliseFloor,
  publicCatalogue,
} from "../issue-catalogue/issue-catalogue";
import {
  CROWD_THRESHOLD,
  InvalidReportError,
  Level,
  ReportFacts,
  ResolvedReport,
  computePriority,
  levelRank,
  maxLevel,
  resolveReport,
} from "../issue-catalogue/priority";
import { TicketLocation, classifyDuplicate, cleanPart } from "../issue-catalogue/dedupe";
import { CreateIssueReportDto } from "./dto/create-issue-report.dto";

const CLOSED = ["closed", "resolved", "completed"];
const RESPOND_WINDOW_MS = 7 * 24 * 3600 * 1000;
/** Per person, per rolling day: enough for real use, too few to flood the coordinator. */
const reportLimit = () => Number(process.env.REPORT_LIMIT_PER_DAY) || (process.env.NODE_ENV === "test" ? 100000 : 10);
const plusOneLimit = () => Number(process.env.PLUS_ONE_LIMIT_PER_DAY) || (process.env.NODE_ENV === "test" ? 100000 : 30);
const DAY_MS = 24 * 3600 * 1000;

/** What a student may see about a ticket: status and place only. */
export interface StudentTicketView {
  id: string;
  status: "Reported" | "Assigned" | "Visited" | "Checking" | "Fixed";
  /** The kind of problem (catalogue issue type id), so lists can group by it. */
  issue_type_id: string | null;
  /** What is wrong, without the place, e.g. "Lights – Flickering". */
  title: string;
  summary: string;
  location: string;
  reported_on: string | null;
  /** True when this student filed or +1'd it. */
  mine: boolean;
  /** A fixed issue the student can still confirm, or report as still broken. */
  can_respond: boolean;
}

export type SubmitOutcome =
  | { outcome: "created" | "joined" | "already_reported"; ticket: StudentTicketView }
  /** An open whole-floor/building ticket covers this spot: ask "Is this the same problem?". */
  | { outcome: "covered"; covers: StudentTicketView };

@Injectable()
export class IssueReportsService {
  constructor(
    private database: DatabaseService,
    private dispatch: DispatchService,
    private clock: Clock,
  ) {}

  catalogue() {
    return publicCatalogue();
  }

  // ── Student actions ────────────────────────────────────────────────────

  private recent = new Map<string, number[]>();

  /** Counts one more action by this person today; refuses past the limit. */
  private spend(kind: "report" | "plus", user: string, max: number) {
    const key = `${kind}:${user}`;
    const now = this.clock.now().getTime();
    const times = (this.recent.get(key) ?? []).filter((t) => now - t < DAY_MS);
    if (times.length >= max)
      throw new HttpException(
        kind === "report"
          ? "You have sent a lot of reports today. Please check Campus issues, or try again tomorrow."
          : "You have pressed +1 a lot today. Please try again tomorrow.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    times.push(now);
    this.recent.set(key, times);
  }

  submit(userId: string | undefined, dto: CreateIssueReportDto): SubmitOutcome {
    const reporter = this.requireUser(userId);
    this.spend("report", reporter, reportLimit());
    const org = currentOrgId();
    const building = this.database.buildings.find(
      (b) => b.building_id === dto.building_id && (!org || b.organization_id === org),
    );
    if (!building) throw new BadRequestException("Pick a building from the list.");

    const { floor, area } = this.checkLocation(dto);
    const part = (dto.part ?? "").trim();
    if (area === "inside_room" && !part)
      throw new BadRequestException("Enter the room number.");
    if (dto.item_id === OTHER_ITEM_ID && !(dto.other_text ?? "").trim())
      throw new BadRequestException("Type a few words about the problem.");

    const facts: ReportFacts = {
      floor,
      area,
      itemId: dto.item_id,
      issueTypeId: dto.issue_type_id,
      problemId: dto.problem_id,
      howMany: dto.how_many as ReportFacts["howMany"],
      answers: dto.answers,
      inDanger: dto.in_danger,
      happenedBefore: dto.happened_before,
      since: dto.since as ReportFacts["since"],
      howBad: dto.how_bad,
    };

    let resolved: ResolvedReport;
    try {
      resolved = resolveReport(facts);
    } catch (e) {
      if (e instanceof InvalidReportError) throw new BadRequestException(e.message);
      throw e;
    }
    this.checkItemFitsPlace(resolved, facts);

    const now = this.clock.now().toISOString();
    const candidate: TicketLocation = {
      building_id: building.building_id,
      item_id: resolved.itemId,
      floor,
      area,
      part,
      team: resolved.team,
      created_at: now,
    };
    const open = this.structuredOpen() as unknown as (ServiceRequest & TicketLocation)[];
    const dup = classifyDuplicate(candidate, open, now);

    if (dup.kind === "exact") return this.join(dup.ticket, reporter, dto, facts, resolved, now);

    if (dup.kind === "covered") {
      if (dto.same_as === undefined) {
        return { outcome: "covered", covers: this.studentView(dup.ticket, reporter) };
      }
      if (dto.same_as === dup.ticket.service_request_id) {
        return this.join(dup.ticket, reporter, dto, facts, resolved, now);
      }
      // "new" (or anything else) starts a separate ticket.
    }

    // The same fault reported again after it was marked fixed: link it to the
    // old ticket and treat it as having happened before (one level up, capped).
    const priorFix = this.recentlyFixed(candidate, now);
    if (priorFix) facts.happenedBefore = true;

    const priority = computePriority(facts, resolved, { people: 1 });
    if (priorFix) priority.reasons.push("Reported again after it was marked fixed");
    const id = crypto.randomUUID();
    const typeLabel = findIssueType(resolved.issueTypeId)?.label ?? "General";
    const tellOfficer = !resolved.isOther && alertsOfficer(resolved.itemId);
    const record: ServiceRequest = {
      service_request_id: id,
      organization_id: org ?? building.organization_id,
      reporter_id: reporter,
      assigned_to_id: null,
      category: typeLabel,
      issue_type: this.itemLabel(resolved, dto),
      status: "open",
      created_at: now,
      description: (dto.description ?? "").trim(),
      building_id: building.building_id,
      floor,
      area,
      part,
      issue_type_id: resolved.issueTypeId,
      item_id: resolved.itemId,
      problem_id: resolved.problemId,
      how_many: dto.how_many,
      answers: dto.answers ?? {},
      filed_as: resolved.filedAs,
      team: resolved.team,
      second_team: resolved.secondTeam,
      priority: priority.level,
      priority_system: priority.level,
      priority_rule: priority.ruleLevel,
      priority_override: null,
      priority_source: "rules",
      priority_reasons: priority.reasons,
      priority_history: [
        { at: now, level: priority.level, source: "rules", reason: priority.reasons.join("; ") },
      ],
      tier: priority.tier,
      size: priority.size,
      points: priority.points,
      reporter_ids: [reporter],
      plus_one_ids: [],
      joined_reports: [],
      reopened_from: priorFix?.service_request_id ?? null,
      ...(dto.other_text ? { other_text: dto.other_text.trim() } : {}),
    };
    this.database.serviceRequests.push(record);
    // The system picks the person. Nobody chooses a job from a list.
    this.dispatch.dispatch(record, new Date(now));
    if (tellOfficer) {
      // Food thrown away or smoke: General Maintenance deals with it today,
      // and the Sustainability Officer hears at once, since a one-off fix
      // will not stop it happening again.
      pushNotifications(this.database, {
        organizationId: record.organization_id,
        userIds: usersWithRole(this.database, record.organization_id, [UserRole.SUSTAINABILITY_OFFICER]),
        targetType: NotificationTargetType.REQUEST,
        targetId: id,
        message: `Waste reported: ${record.issue_type} at ${this.studentView(record, reporter).location}. General Maintenance has the job.`,
      });
    }
    return { outcome: "created", ticket: this.studentView(record, reporter) };
  }

  plusOne(userId: string | undefined, id: string): StudentTicketView {
    const user = this.requireUser(userId);
    const ticket = this.structuredOpen().find((t) => t.service_request_id === id);
    if (!ticket) throw new NotFoundException("That issue is no longer open.");
    ticket.plus_one_ids ??= [];
    ticket.reporter_ids ??= [];
    if (!ticket.plus_one_ids.includes(user) && !ticket.reporter_ids.includes(user)) {
      this.spend("plus", user, plusOneLimit());
      ticket.plus_one_ids.push(user);
      this.recalculate(ticket, this.clock.now().toISOString());
    }
    return this.studentView(ticket, user);
  }

  /**
   * The student's answer on a fixed issue. "Fixed" confirms it. "Still
   * broken" files the same problem again as a new, linked report, which the
   * rules treat as having happened before (one level higher).
   */
  respond(userId: string | undefined, id: string, fixed: boolean): StudentTicketView | SubmitOutcome {
    const user = this.requireUser(userId);
    const ticket = scopeToTenant(this.database.serviceRequests).find((t) => t.service_request_id === id);
    if (!ticket || !this.isMine(ticket, user)) throw new NotFoundException("Issue not found.");
    if (!this.canRespond(ticket, user)) throw new BadRequestException("This issue can no longer be confirmed or reopened.");
    if (fixed) {
      ticket.confirmed_fixed_at = this.clock.now().toISOString();
      return this.studentView(ticket, user);
    }
    if (ticket.item_id === OTHER_ITEM_ID)
      throw new BadRequestException("Please send a new report for this one.");
    return this.submit(user, {
      building_id: ticket.building_id!,
      floor: ticket.floor!,
      area: ticket.area!,
      part: ticket.part,
      issue_type_id: ticket.issue_type_id,
      item_id: ticket.item_id!,
      problem_id: ticket.problem_id ?? undefined,
      how_many: ticket.how_many,
      answers: ticket.answers,
      in_danger: false,
      happened_before: true,
    } as CreateIssueReportDto);
  }

  /** All open issues in the caller's organisation. No names, no priority, no counts. */
  campusIssues(userId: string | undefined, buildingId?: string, floor?: string) {
    const user = this.requireUser(userId);
    return this.structuredOpen()
      .filter((t) => (!buildingId || t.building_id === buildingId) && (!floor || t.floor === (normaliseFloor(floor) ?? floor)))
      .map((t) => this.studentView(t, user));
  }

  /** The student's own reports and the ones they +1'd, including older free-text requests. */
  mine(userId: string | undefined): StudentTicketView[] {
    const user = this.requireUser(userId);
    return scopeToTenant(this.database.serviceRequests)
      .filter((t) => this.isMine(t, user))
      .map((t) => this.studentView(t, user));
  }

  // ── Staff: priority override ───────────────────────────────────────────

  /**
   * The coordinator can set the level at any time, no reason needed. The
   * system's own level keeps updating underneath and the override wins.
   * Pass null to go back to the system's level.
   */
  setPriorityOverride(ticket: ServiceRequest, level: Level | null, now = this.clock.now().toISOString()) {
    ticket.priority_override = level;
    ticket.priority = level ?? ticket.priority_system ?? ticket.priority;
    ticket.priority_source = level ? "admin" : ticket.priority_source;
    ticket.priority_history ??= [];
    ticket.priority_history.push({
      at: now,
      level: ticket.priority,
      source: level ? "admin" : "rules",
      reason: level ? "Set by the coordinator" : "Back to the system's level",
    });
    this.dispatch.syncPriority(ticket);
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private requireUser(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException("Sign in to report an issue.");
    return userId;
  }

  /** A ticket for the same spot and fault that was fixed in the last 30 days. */
  private recentlyFixed(c: TicketLocation, now: string): ServiceRequest | undefined {
    const since = new Date(now).getTime() - 30 * 86_400_000;
    return this.database.serviceRequests
      .filter(
        (t) =>
          t.item_id &&
          !this.isOpen(t) &&
          t.closed_at &&
          new Date(t.closed_at).getTime() >= since &&
          t.building_id === c.building_id &&
          t.item_id === c.item_id &&
          t.floor === c.floor &&
          t.area === c.area &&
          cleanPart(t.part ?? "") === cleanPart(c.part),
      )
      .sort((a, b) => String(b.closed_at).localeCompare(String(a.closed_at)))[0];
  }

  private isOpen(t: ServiceRequest) {
    return !CLOSED.includes(String(t.status).toLowerCase());
  }

  private structuredOpen(): ServiceRequest[] {
    // Jobs raised from a monitoring fault are not student reports.
    return scopeToTenant(this.database.serviceRequests).filter((t) => t.item_id && !t.source_fault_id && !t.source_finding && !t.source_wastage && !t.source_initiative && this.isOpen(t));
  }

  private isMine(t: ServiceRequest, user: string) {
    return (
      t.reporter_id === user ||
      !!t.reporter_ids?.includes(user) ||
      !!t.plus_one_ids?.includes(user)
    );
  }

  private checkLocation(dto: CreateIssueReportDto): { floor: string; area: AreaId } {
    const floor = normaliseFloor(dto.floor);
    if (!floor)
      throw new BadRequestException(
        `Enter a floor number from 1 to ${MAX_FLOOR}, or basement, ground, roof, outside, whole building.`,
      );

    let area = dto.area as AreaId;
    if (floor === "whole_building") area = "whole_building";
    else if (floor === "outside") area = "outside";
    else if (!AREAS.some((a) => a.id === area))
      throw new BadRequestException("Pick where on the floor from the list.");

    const parts = PARTS[area];
    const part = (dto.part ?? "").trim();
    if (parts && part && !parts.some((p) => p.id === part) && part.length > 60)
      throw new BadRequestException("That place name is too long.");
    return { floor, area };
  }

  /** Dropdowns only offer options that make sense; the server enforces the same lists. */
  private checkItemFitsPlace(r: ResolvedReport, f: ReportFacts) {
    if (r.isOther) return;
    const found = findItem(f.itemId);
    if (!found) return;
    const { item } = found;
    if (item.areas && !item.areas.includes(f.area))
      throw new BadRequestException(`'${item.label}' can't be reported at that place.`);
    if (item.floors && !item.floors.includes(f.floor))
      throw new BadRequestException(`'${item.label}' can't be reported on that floor.`);
    if (!findProblem(item, f.problemId ?? ""))
      throw new BadRequestException("Pick what's happening from the list.");
  }

  private join(
    ticket: ServiceRequest,
    reporter: string,
    dto: CreateIssueReportDto,
    facts: ReportFacts,
    resolved: ResolvedReport,
    now: string,
  ): SubmitOutcome {
    ticket.reporter_ids ??= [ticket.reporter_id];
    if (ticket.reporter_ids.includes(reporter))
      return { outcome: "already_reported", ticket: this.studentView(ticket, reporter) };

    ticket.reporter_ids.push(reporter);
    ticket.joined_reports ??= [];
    ticket.joined_reports.push({
      reporter_id: reporter,
      problem_id: resolved.problemId,
      description: (dto.description ?? "").trim(),
      at: now,
    });

    // The ticket takes the highest level among its reports.
    const priority = computePriority(facts, resolved, { people: 1 });
    const before = (ticket.priority_rule ?? "low") as Level;
    ticket.priority_rule = maxLevel(before, priority.ruleLevel);
    if (levelRank(priority.ruleLevel) > levelRank(before)) {
      ticket.priority_source = "joined";
      ticket.priority_reasons = [...(ticket.priority_reasons ?? []), `Joined report: ${priority.reasons.join("; ")}`];
    }
    ticket.tier = Math.max(ticket.tier ?? 1, priority.tier);

    // A heavier report raises the size, but only until someone is assigned.
    if (!ticket.assigned_to_id) {
      const sizes = ["S", "M", "L"];
      if (sizes.indexOf(priority.size) > sizes.indexOf(ticket.size ?? "S")) {
        ticket.size = priority.size;
        ticket.points = priority.points;
      }
    }
    this.recalculate(ticket, now);
    return { outcome: "joined", ticket: this.studentView(ticket, reporter) };
  }

  /** Re-derives the system level after any report or +1: rule level, then the crowd raise. */
  private recalculate(ticket: ServiceRequest, now: string) {
    const people = new Set([
      ...(ticket.reporter_ids ?? []),
      ...(ticket.plus_one_ids ?? []),
      ticket.reporter_id,
    ]).size;

    let level = (ticket.priority_rule ?? ticket.priority_system ?? "low") as Level;
    const threshold = CROWD_THRESHOLD[(ticket.tier ?? 1) as 1 | 2 | 3];
    let crowd = false;
    if (threshold && people >= threshold && levelRank(level) < levelRank("high")) {
      level = (["low", "medium", "high"] as Level[])[levelRank(level) + 1];
      crowd = true;
    }

    const changed = level !== ticket.priority_system;
    ticket.priority_system = level;
    if (changed) {
      if (crowd) ticket.priority_source = "crowd";
      ticket.priority_history ??= [];
      ticket.priority_history.push({
        at: now,
        level,
        source: crowd ? "crowd" : ticket.priority_source ?? "rules",
        reason: crowd ? `${people} people affected` : "Updated by a joined report",
      });
    }
    // The coordinator's level is the one everyone works to.
    ticket.priority = ticket.priority_override ?? level;
    this.dispatch.syncPriority(ticket);
  }

  private itemLabel(r: ResolvedReport, dto: CreateIssueReportDto): string {
    if (r.isOther) return `Other: ${(dto.other_text ?? "").trim()}`;
    const found = findItem(r.itemId);
    const prob = found && r.problemId ? findProblem(found.item, r.problemId) : undefined;
    return `${found?.item.label ?? r.itemId}${prob ? ` – ${prob.label}` : ""}`;
  }

  private studentView(t: ServiceRequest, user: string): StudentTicketView {
    const building = this.database.buildings.find((b) => b.building_id === t.building_id);
    const floor = FLOORS.find((f) => f.id === t.floor)?.label ?? t.floor;
    const areaLabel = AREAS.find((a) => a.id === t.area)?.label ?? t.area;
    const partLabel =
      PARTS[t.area as AreaId]?.find((p) => p.id === t.part)?.label ?? t.part ?? "";
    const place = [
      building?.name,
      t.floor === "whole_building" ? null : t.floor === "outside" ? "outside" : `floor ${floor}`,
      t.floor === "whole_building" || t.floor === "outside" ? null : areaLabel.toLowerCase(),
      partLabel,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      id: t.service_request_id,
      status: this.studentStatus(t),
      issue_type_id: t.issue_type_id ?? null,
      title: t.issue_type ?? "Issue",
      summary: `${t.issue_type ?? "Issue"}: ${place}`,
      location: place,
      reported_on: t.created_at ?? null,
      mine: this.isMine(t, user),
      can_respond: this.canRespond(t, user),
    };
  }

  /** Fixed in the last week, theirs, not yet confirmed and not already re-reported. */
  private canRespond(t: ServiceRequest, user: string): boolean {
    if (!t.item_id || !CLOSED.includes(String(t.status).toLowerCase()) || !this.isMine(t, user)) return false;
    if (t.confirmed_fixed_at) return false;
    const closed = new Date(t.closed_at ?? t.created_at ?? 0).getTime();
    if (this.clock.now().getTime() - closed > RESPOND_WINDOW_MS) return false;
    return !this.database.serviceRequests.some((x) => x.reopened_from === t.service_request_id);
  }

  private studentStatus(t: ServiceRequest): StudentTicketView["status"] {
    const s = String(t.status).toLowerCase();
    if (CLOSED.includes(s)) return "Fixed";
    if (s === "checking") return "Checking";
    if (s === "visited") return "Visited";
    if (s === "in_progress" || s === "dispatched" || t.assigned_to_id) return "Assigned";
    return "Reported";
  }
}

/** For tests and the coordinator view: the issue types the catalogue knows. */
export const knownIssueTypes = () => ISSUE_TYPES.map((t) => t.id);
