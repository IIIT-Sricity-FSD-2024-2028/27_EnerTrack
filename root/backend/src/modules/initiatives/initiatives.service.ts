import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import {
  DatabaseService,
  Initiative,
  InitiativeStatus,
  NotificationTargetType,
  UserRole,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { assertMove, MoveTable } from "../../core/utils/transitions";
import { lastFullMonth, periodsBetween } from "../../core/utils/period";
import { compareYoY } from "../../core/utils/period-compare";
import { METRIC_INFO, metricMeasure } from "../../core/utils/metric-measure";
import { pushNotifications, usersWithRole } from "../../core/utils/notify";
import { DispatchService } from "../dispatch/dispatch.service";
import { teamLabel } from "../issue-catalogue/issue-catalogue";
import { CreateInitiativeDto } from "./dto/create-initiative.dto";
import { PutInitiativeDto } from "./dto/put-initiative.dto";

import { UpdateInitiativeDto } from "./dto/update-initiative.dto";

/** Statuses an initiative can be archived from: it is over, one way or another. */
const ARCHIVABLE: InitiativeStatus[] = [
  InitiativeStatus.COMPLETED,
  InitiativeStatus.REJECTED,
];

/**
 * The approval gate. The Sustainability Officer proposes; only the
 * Organization Admin approves or rejects. Approving starts the work at once
 * (status in-progress, on-site jobs sent), so "approved" is only a moment:
 *
 *   proposed ──(Org Admin approves)──► in-progress ──(officer)──► completed
 *       └─────(Org Admin rejects, with a reason)──► rejected
 *
 * approved → in-progress stays allowed for any record still in "approved".
 */
const RUN_MOVES = {
  [InitiativeStatus.APPROVED]: [InitiativeStatus.IN_PROGRESS],
  [InitiativeStatus.IN_PROGRESS]: [InitiativeStatus.COMPLETED],
};
const INITIATIVE_MOVES: MoveTable[] = [
  { roles: [UserRole.SUSTAINABILITY_OFFICER], moves: RUN_MOVES },
  {
    roles: [UserRole.ORGANIZATION_ADMIN],
    moves: {
      ...RUN_MOVES,
      [InitiativeStatus.PROPOSED]: [InitiativeStatus.APPROVED, InitiativeStatus.REJECTED],
    },
  },
];

/** Statuses a non-admin may delete from: never started, so nothing is lost. */
const WITHDRAWABLE: InitiativeStatus[] = [InitiativeStatus.PROPOSED, InitiativeStatus.REJECTED];

/**
 * What the Organization Admin approved: what it saves, how much, at what
 * cost, where, and towards which target. Once an initiative leaves
 * "proposed" only the Organization Admin can change these, otherwise the
 * proposer could lower the promised saving after approval and turn a red
 * rating green.
 */
const AGREED_TERMS = [
  "metric",
  "expected_saving",
  "capex",
  "building_ids",
  "meter_ids",
  "target_id",
  // Whether it needs technicians on site, and which types: the admin
  // approved the plan knowing who it would use.
  "onsite_work",
  "teams",
  "team_tasks",
] as const;

/** Longest task text for one technician type. */
const TASK_MAX = 300;

/** Today on the server's calendar (same clock as endOfDay), not UTC's. */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Same value for an agreed term? Lists compare as sets, objects by their
 * entries; unset, null, false, [] and {} are the same.
 */
function sameTerm(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) =>
    Array.isArray(v)
      ? JSON.stringify([...v].sort())
      : v && typeof v === "object"
        ? JSON.stringify(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)))
        : JSON.stringify(v ?? null);
  const isEmpty = (v: unknown) =>
    v == null ||
    v === false ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
  if (isEmpty(a) && isEmpty(b)) return true;
  return norm(a) === norm(b);
}

@Injectable()
export class InitiativesService {
  constructor(
    private database: DatabaseService,
    private dispatch: DispatchService,
  ) {}

  /**
   * Proposes an initiative. created_by_id is the signed-in user (from the
   * x-user-id header that AuthMiddleware sets from the token), never a value
   * from the request body. It always starts as "proposed".
   */
  create(createDto: CreateInitiativeDto, userId?: string) {
    if (createDto.status && createDto.status !== InitiativeStatus.PROPOSED)
      throw new BadRequestException(
        "A new initiative starts as proposed; the Organization Admin approves it.",
      );
    this.assertDates(createDto.start_date, createDto.target_date);
    this.assertScope(createDto);
    const work = this.onsiteWork(createDto);
    const generatedId = crypto.randomUUID();
    const newRecord = {
      initiative_id: generatedId,
      ...createDto,
      ...work,
      status: InitiativeStatus.PROPOSED,
      created_by_id: userId ?? null,
      created_at: new Date().toISOString(),
      archived_at: null,
      organization_id: currentOrgId() ?? createDto.organization_id ?? null,
    };
    this.database.initiatives.push(newRecord as any);

    this.notify(
      newRecord as Initiative,
      usersWithRole(this.database, newRecord.organization_id, [UserRole.ORGANIZATION_ADMIN]),
      `New initiative to approve: ${newRecord.title}.`,
    );
    return this.withPerformance(newRecord as Initiative);
  }

  /** Every initiative, each with its measured performance (where measurable). */
  findAll() {
    return scopeToTenant(this.database.initiatives).map((i) => this.withPerformance(i));
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.initiatives.find(
      (item) => item.initiative_id === id,
    ));
    if (!record)
      throw new NotFoundException(`Initiative with ID ${id} not found`);
    return this.withPerformance(record);
  }

  /**
   * Measured performance: each month since the start date against the same
   * month a year earlier, on the initiative's meters. Only months with
   * readings on both sides count, so a silent month is never a saving.
   */
  performance(id: string) {
    const record = assertTenantOwns(this.database.initiatives.find((i) => i.initiative_id === id));
    if (!record) throw new NotFoundException(`Initiative with ID ${id} not found`);
    return this.measure(record);
  }

  put(id: string, putDto: PutInitiativeDto, role?: string, userId?: string) {
    const index = this.indexOf(id);
    const existing = this.database.initiatives[index];
    this.assertDates(putDto.start_date, putDto.target_date);
    this.assertScope(putDto);
    const to = (putDto.status ?? existing.status) as InitiativeStatus;
    assertMove(INITIATIVE_MOVES, role, existing.status, to, "an initiative");
    const work = this.onsiteWork(putDto);
    this.assertDecision(existing, to, undefined, putDto.target_date ?? null);
    this.assertCanMove({ ...existing, ...putDto, ...work } as Initiative, existing.status, to);
    this.assertWorkChange(existing, { ...existing, ...putDto, ...work, status: to } as Initiative);
    // A full replace still keeps who proposed it, the decision and whether it
    // is archived: none of those are part of the editable record.
    this.database.initiatives[index] = {
      initiative_id: id,
      ...putDto,
      ...work,
      status: to,
      created_by_id: existing.created_by_id,
      created_at: existing.created_at ?? null,
      archived_at: existing.archived_at ?? null,
      decided_by_id: existing.decided_by_id ?? null,
      decided_at: existing.decided_at ?? null,
      decision_note: existing.decision_note ?? null,
      completed_at: existing.completed_at ?? null,
      verified_saving: existing.verified_saving ?? null,
      verified_at: existing.verified_at ?? null,
      source_finding: existing.source_finding ?? null,
      expected_saving_amount: existing.expected_saving_amount ?? null,
      organization_id: existing.organization_id,
    } as Initiative;
    this.afterMove(this.database.initiatives[index], existing.status, to, userId, undefined);
    this.afterWorkChange(existing, this.database.initiatives[index]);
    return this.database.initiatives[index];
  }

  /**
   * Edits an initiative. A status change must follow the approval gate
   * (INITIATIVE_MOVES), otherwise 403. After approval the agreed terms
   * (AGREED_TERMS) are locked for everyone but the Organization Admin (409);
   * the title, description and dates stay editable.
   */
  update(id: string, updateDto: UpdateInitiativeDto, role?: string, userId?: string) {
    const index = this.indexOf(id);
    const existing = this.database.initiatives[index];
    if (existing.status !== InitiativeStatus.PROPOSED && role !== UserRole.ORGANIZATION_ADMIN) {
      const changed = AGREED_TERMS.filter(
        (key) => key in updateDto && !sameTerm((updateDto as any)[key], (existing as any)[key]),
      );
      if (changed.length)
        throw new ConflictException(
          `This initiative is ${existing.status}, so what was approved (${changed.join(", ")}) can only be changed by the Organization Admin.`,
        );
    }
    this.assertDates(
      updateDto.start_date ?? existing.start_date ?? undefined,
      updateDto.target_date ?? existing.target_date ?? undefined,
    );
    const { decision_note: note, ...changes } = updateDto;
    const to = (changes.status ?? existing.status) as InitiativeStatus;
    assertMove(INITIATIVE_MOVES, role, existing.status, to, "an initiative");
    this.assertScope({ ...existing, ...changes });
    const work = this.onsiteWork({ ...existing, ...changes });
    this.assertDecision(existing, to, note, changes.target_date ?? existing.target_date ?? null);
    this.assertCanMove({ ...existing, ...changes, ...work } as Initiative, existing.status, to);
    this.assertWorkChange(existing, { ...existing, ...changes, ...work, status: to } as Initiative);
    this.database.initiatives[index] = {
      ...existing,
      ...changes,
      ...work,
      status: to,
      organization_id: existing.organization_id,
    };
    this.afterMove(this.database.initiatives[index], existing.status, to, userId, note);
    this.afterWorkChange(existing, this.database.initiatives[index]);
    return this.withPerformance(this.database.initiatives[index]);
  }

  /**
   * Moves a finished (completed) or rejected initiative off the board and
   * into Archives. The record stays on the server, so it is still there on
   * another device or after signing in again. Archiving twice keeps the
   * first timestamp.
   */
  archive(id: string) {
    const index = this.indexOf(id);
    const existing = this.database.initiatives[index];
    if (!ARCHIVABLE.includes(existing.status))
      throw new BadRequestException(
        `Only a completed or rejected initiative can be archived (this one is '${existing.status}')`,
      );
    this.database.initiatives[index] = {
      ...existing,
      archived_at: existing.archived_at ?? new Date().toISOString(),
    };
    return this.database.initiatives[index];
  }

  /**
   * Deletes an initiative. The Sustainability Officer can only withdraw one
   * that never started (proposed or rejected); approved, running or
   * completed work is history and only the Organization Admin can remove it.
   */
  remove(id: string, role?: string) {
    const index = this.indexOf(id);
    const existing = this.database.initiatives[index];
    // Its jobs would stay with technicians for an initiative that no longer exists.
    const open = this.dispatch.initiativeJobs(id).filter((j) => j.open);
    if (open.length)
      throw new ConflictException(
        `${open.length} job${open.length === 1 ? " is" : "s are"} still open for this initiative (${this.teamNames(open)}). Close them first; the coordinator can close a job that is no longer needed.`,
      );
    if (role !== UserRole.ORGANIZATION_ADMIN && !WITHDRAWABLE.includes(existing.status))
      throw new ConflictException(
        `Only a proposed or rejected initiative can be deleted (this one is ${existing.status}); ask the Organization Admin.`,
      );
    const removed = this.database.initiatives.splice(index, 1);
    this.database.notifications = this.database.notifications.filter(
      (n) => !(n.target_type === NotificationTargetType.INITIATIVE && n.target_id === id),
    );
    return removed[0];
  }

  // ───────────────────────── internals ─────────────────────────

  /** Records the Org Admin's decision and tells the proposer; stamps start and completion. */
  private afterMove(
    record: Initiative,
    from: InitiativeStatus,
    to: InitiativeStatus,
    userId: string | undefined,
    note: string | undefined,
  ) {
    if (from === to) return;
    const today = new Date().toISOString().slice(0, 10);
    const remark = note?.trim() || null;
    if (from === InitiativeStatus.PROPOSED) {
      record.decided_by_id = userId ?? null;
      record.decided_at = new Date().toISOString();
      record.decision_note = remark;
    }
    // Approval is the go-ahead: the initiative starts there and then.
    if (from === InitiativeStatus.PROPOSED && to === InitiativeStatus.APPROVED) {
      record.status = InitiativeStatus.IN_PROGRESS;
      to = InitiativeStatus.IN_PROGRESS;
      from = InitiativeStatus.APPROVED;
      const sent = this.startWork(record, today);
      this.notify(
        record,
        [record.created_by_id],
        `Your initiative "${record.title}" was approved${remark ? `: ${remark}` : "."} ${
          sent.length
            ? `Work has started: ${sent.length} job${sent.length === 1 ? "" : "s"} sent to ${sent.map((t) => teamLabel(t.team)).join(", ")}.`
            : "It is now in progress."
        }`,
      );
      return;
    }
    if (from === InitiativeStatus.PROPOSED && to === InitiativeStatus.REJECTED) {
      this.notify(record, [record.created_by_id], `Your initiative "${record.title}" was not approved: ${remark}`);
      return;
    }
    // Any record still sitting in "approved" (from before approval started work) starts the same way.
    if (from === InitiativeStatus.APPROVED && to === InitiativeStatus.IN_PROGRESS) this.startWork(record, today);
    // Completing it records what it actually saved up to now.
    if (to === InitiativeStatus.COMPLETED) {
      record.completed_at = new Date().toISOString();
      const perf = this.measure(record);
      record.verified_saving = perf.measurable && perf.months_compared > 0 ? perf.actual_saving_to_date : null;
      record.verified_at = record.verified_saving === null ? null : record.completed_at;
    }
  }

  /** Starts the work: start date today (unless set), and one job per technician type for on-site work. */
  private startWork(record: Initiative, today: string) {
    if (!record.start_date) record.start_date = today;
    return record.onsite_work ? this.dispatch.sendInitiative(record) : [];
  }

  /**
   * The Organization Admin's decision on a proposal: a rejection needs a
   * reason (the proposer sees it); an approval starts the work, so it is
   * refused once the target date has passed (move the date, then approve).
   */
  private assertDecision(existing: Initiative, to: InitiativeStatus, note: string | undefined, targetDate: string | null) {
    if (existing.status !== InitiativeStatus.PROPOSED || to === existing.status) return;
    if (to === InitiativeStatus.REJECTED && !(note ?? "").trim())
      throw new BadRequestException("Give a reason for rejecting it (decision_note); the proposer sees it.");
    if (to === InitiativeStatus.APPROVED && targetDate && targetDate < todayIso())
      throw new BadRequestException(`The target date (${targetDate}) has passed; move it first, then approve.`);
  }

  private notify(record: Initiative, userIds: (string | null | undefined)[], message: string) {
    pushNotifications(this.database, {
      organizationId: record.organization_id,
      userIds,
      targetType: NotificationTargetType.INITIATIVE,
      targetId: record.initiative_id,
      message,
    });
  }

  /**
   * The record plus what every screen needs to tell its story: measured
   * performance, its jobs (with spend), who proposed and decided it, and the
   * money (cost, spent, expected saving, payback).
   */
  private withPerformance(record: Initiative) {
    const jobs = record.onsite_work ? this.dispatch.initiativeJobs(record.initiative_id) : [];
    const spent = jobs.reduce((n, j) => n + j.spent, 0);
    const pending = jobs.reduce((n, j) => n + j.spend_pending, 0);
    const name = (id: string | null | undefined) => (id ? this.database.users.find((u) => u.user_id === id)?.name ?? null : null);
    // A yearly saving in money: given (audit findings) or from the tariff for electricity.
    const org = this.database.organizations.find((o) => o.organization_id === record.organization_id);
    const tariff = Number((org as any)?.tariff_rate) || null;
    const savingMoney =
      record.expected_saving_amount ??
      (record.metric === "energy_kwh" && record.expected_saving != null && tariff ? Math.round(record.expected_saving * tariff) : null);
    return {
      ...record,
      team_labels: (record.teams ?? []).map((t) => teamLabel(t)),
      created_by_name: name(record.created_by_id),
      decided_by_name: name(record.decided_by_id),
      performance: this.measure(record),
      jobs,
      money: {
        cost: record.capex ?? null,
        /** Approved expense bills on its jobs. */
        spent,
        /** Bills still waiting for Finance. */
        spend_pending: pending,
        expected_saving_per_year: savingMoney,
        payback_years: savingMoney && savingMoney > 0 && record.capex ? Math.round((record.capex / savingMoney) * 10) / 10 : null,
      },
    };
  }

  /**
   * The officer checked a closed job and it is not right: they ask for
   * rework with a reason. The coordinator decides who redoes it and by when.
   */
  requestRework(id: string, workOrderId: string, reason: string | undefined, userId?: string) {
    const record = this.database.initiatives[this.indexOf(id)];
    this.dispatch.requestRework(record, workOrderId, reason, userId);
    return this.withPerformance(record);
  }

  /**
   * On-site work, cleaned up: "no" keeps no technician types; "yes" needs at
   * least one type and a target date (the jobs' finish date).
   */
  private onsiteWork(
    dto: { onsite_work?: boolean | null; teams?: string[] | null; team_tasks?: Record<string, string> | null; target_date?: string | null },
  ) {
    if (!dto.onsite_work) return { onsite_work: false, teams: [] as string[], team_tasks: {} as Record<string, string> };
    const teams = [...new Set(dto.teams ?? [])];
    if (!teams.length)
      throw new BadRequestException("Pick at least one technician type the on-site work needs.");
    if (!dto.target_date)
      throw new BadRequestException("Initiatives with on-site work need a target date: it is the technicians' finish date.");
    // What each type has to do: an optional short task per ticked type, nothing for the others.
    const given = dto.team_tasks ?? {};
    const team_tasks: Record<string, string> = {};
    for (const t of teams) {
      const task = typeof given[t] === "string" ? given[t].trim() : "";
      if (task.length > TASK_MAX)
        throw new BadRequestException(`The ${teamLabel(t)} task is too long (at most ${TASK_MAX} characters).`);
      if (task) team_tasks[t] = task;
    }
    return { onsite_work: true, teams, team_tasks };
  }

  /**
   * Checks that only apply to on-site work, before anything is saved:
   * starting needs a target date that has not passed; completing needs every
   * job (first try and rework) to be closed.
   */
  private assertCanMove(record: Initiative, from: InitiativeStatus, to: InitiativeStatus) {
    if (from === to || !record.onsite_work) return;
    if (from === InitiativeStatus.APPROVED && to === InitiativeStatus.IN_PROGRESS && (record.target_date ?? "") < todayIso())
      throw new BadRequestException(
        `The target date (${record.target_date}) has passed. Move it first: it becomes the technicians' finish date.`,
      );
    if (to === InitiativeStatus.COMPLETED) {
      const jobs = this.dispatch.initiativeJobs(record.initiative_id);
      const open = jobs.filter((j) => j.open);
      if (open.length)
        throw new ConflictException(
          `${open.length} job${open.length === 1 ? " is" : "s are"} still open (${this.teamNames(open)}). The initiative can be completed once all its work is closed.`,
        );
      const asked = jobs.filter((j) => j.rework_request?.status === "pending");
      if (asked.length)
        throw new ConflictException(
          `Rework is waiting for the coordinator's decision (${this.teamNames(asked)}). The initiative can be completed once that is settled.`,
        );
    }
  }

  private teamNames(jobs: { team: string | null }[]) {
    return [...new Set(jobs.map((j) => teamLabel(j.team)))].join(", ");
  }

  /**
   * Changes to on-site work once jobs exist (only the Organization Admin can
   * make them: they are agreed terms). Refused when they would leave jobs
   * behind: switching on-site work off, dropping a technician type that
   * already has a job, or changing anything after completion. A running
   * initiative's target date (its jobs' finish date) cannot move into the past.
   */
  private assertWorkChange(existing: Initiative, next: Initiative) {
    const jobs = existing.onsite_work ? this.dispatch.initiativeJobs(existing.initiative_id) : [];
    if (jobs.length) {
      const typesChanged =
        !sameTerm(existing.teams, next.teams) || !sameTerm(existing.onsite_work, next.onsite_work) || !sameTerm(existing.team_tasks, next.team_tasks);
      if (existing.status === InitiativeStatus.COMPLETED && typesChanged)
        throw new ConflictException("This initiative is completed; its on-site work can no longer change.");
      if (!next.onsite_work)
        throw new ConflictException(
          `Jobs have already been sent (${this.teamNames(jobs)}), so on-site work cannot be switched off. Close any open jobs through the coordinator instead.`,
        );
      const dropped = (existing.teams ?? []).filter((t) => !(next.teams ?? []).includes(t) && jobs.some((j) => j.team === t));
      if (dropped.length)
        throw new ConflictException(
          `${dropped.map((t) => teamLabel(t)).join(", ")} already ${dropped.length === 1 ? "has a job" : "have jobs"} for this initiative, so ${dropped.length === 1 ? "it" : "they"} cannot be removed. Close the job through the coordinator if it is not needed.`,
        );
    }
    if (
      next.status === InitiativeStatus.IN_PROGRESS &&
      next.onsite_work &&
      next.target_date !== existing.target_date &&
      (next.target_date ?? "") < todayIso()
    )
      throw new BadRequestException(
        "Work is running, so the target date (the technicians' finish date) cannot be in the past.",
      );
  }

  /**
   * After a change to a running initiative with on-site work: a technician
   * type added later gets its job now (one per missing type, as at Start
   * work), and a new target date moves the open jobs' finish date.
   */
  private afterWorkChange(existing: Initiative, saved: Initiative) {
    if (existing.status !== InitiativeStatus.IN_PROGRESS || saved.status !== InitiativeStatus.IN_PROGRESS || !saved.onsite_work) return;
    this.dispatch.sendInitiative(saved);
    if (saved.target_date !== existing.target_date) this.dispatch.retimeInitiative(saved);
  }

  /** See performance(). Not measurable without a metric and a start date. */
  private measure(record: Initiative) {
    if (!record.metric || !record.start_date)
      return {
        measurable: false as const,
        reason: !record.metric ? "No measure chosen." : "Not started yet.",
      };
    const { measure, meterIds } = metricMeasure(this.database, {
      organizationId: record.organization_id,
      metric: record.metric,
      buildingIds: record.building_ids,
      meterIds: record.meter_ids,
    });
    const startMonth = record.start_date.slice(0, 7);
    const last = lastFullMonth();
    const endMonth =
      record.completed_at && record.completed_at.slice(0, 7) < last ? record.completed_at.slice(0, 7) : last;
    const months = startMonth <= endMonth ? periodsBetween(startMonth, endMonth) : [];
    const cmp = compareYoY(measure, months);
    const actual = cmp.baseline - cmp.current;
    const expectedToDate =
      record.expected_saving != null ? Math.round((record.expected_saving / 12) * cmp.months_compared) : null;
    const onTrack = expectedToDate && expectedToDate > 0 && cmp.months_compared > 0 ? actual >= expectedToDate : null;
    return {
      measurable: true as const,
      unit: METRIC_INFO[record.metric].unit,
      meter_count: meterIds.length,
      from: months[0] ?? null,
      to: months.length ? months[months.length - 1] : null,
      months_compared: cmp.months_compared,
      /** Saved against the same months a year earlier (compared months only). */
      actual_saving_to_date: actual,
      /** expected_saving pro rata for the compared months. */
      expected_to_date: expectedToDate,
      on_track: onTrack,
      /** green: on track; amber: at least half way there; red: below half. */
      rating:
        onTrack === null || expectedToDate === null
          ? null
          : onTrack
            ? "green"
            : actual >= expectedToDate / 2
              ? "amber"
              : "red",
      months: cmp.months,
    };
  }

  /** Buildings, meters and target must belong to the organisation (and the target measure the same thing). */
  private assertScope(dto: { building_ids?: string[]; meter_ids?: string[]; target_id?: string | null; metric?: string | null }) {
    const orgBuildings = new Set(scopeToTenant(this.database.buildings).map((b) => b.building_id));
    const badB = (dto.building_ids ?? []).filter((id) => !orgBuildings.has(id));
    if (badB.length) throw new BadRequestException(`Unknown building: ${badB.join(", ")}`);
    const orgMeters = new Set(scopeToTenant(this.database.meters).map((m) => m.meter_id));
    const badM = (dto.meter_ids ?? []).filter((id) => !orgMeters.has(id));
    if (badM.length) throw new BadRequestException(`Unknown meter: ${badM.join(", ")}`);
    if (dto.target_id) {
      const target = scopeToTenant(this.database.targets).find((t) => t.target_id === dto.target_id);
      if (!target) throw new BadRequestException(`Unknown target: ${dto.target_id}`);
      if (dto.metric && target.metric !== dto.metric)
        throw new BadRequestException("The initiative must measure the same thing as its target.");
    }
  }

  private indexOf(id: string): number {
    const index = this.database.initiatives.findIndex(
      (item) => item.initiative_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.initiatives[index]))
      throw new NotFoundException(`Initiative with ID ${id} not found`);
    return index;
  }

  private assertDates(start?: string | null, target?: string | null) {
    if (start && target && target < start)
      throw new BadRequestException(
        `target_date (${target}) must not be before start_date (${start})`,
      );
  }
}
