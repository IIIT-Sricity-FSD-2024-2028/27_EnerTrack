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
import { CreateInitiativeDto } from "./dto/create-initiative.dto";
import { PutInitiativeDto } from "./dto/put-initiative.dto";

import { UpdateInitiativeDto } from "./dto/update-initiative.dto";

/** Statuses an initiative can be archived from: it is over, one way or another. */
const ARCHIVABLE: InitiativeStatus[] = [
  InitiativeStatus.COMPLETED,
  InitiativeStatus.REJECTED,
];

/**
 * The approval gate. The Sustainability Officer proposes and then runs an
 * approved initiative; only the Organization Admin approves or rejects.
 *
 *   proposed ──(Org Admin)──► approved ──► in-progress ──► completed
 *       └─────(Org Admin)──► rejected
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

@Injectable()
export class InitiativesService {
  constructor(private database: DatabaseService) {}

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
    const generatedId = crypto.randomUUID();
    const newRecord = {
      initiative_id: generatedId,
      ...createDto,
      status: InitiativeStatus.PROPOSED,
      created_by_id: userId ?? null,
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
    // A full replace still keeps who proposed it, the decision and whether it
    // is archived: none of those are part of the editable record.
    this.database.initiatives[index] = {
      initiative_id: id,
      ...putDto,
      status: to,
      created_by_id: existing.created_by_id,
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
    return this.database.initiatives[index];
  }

  /**
   * Edits an initiative. A status change must follow the approval gate
   * (INITIATIVE_MOVES), otherwise 403; editing other fields is fine.
   */
  update(id: string, updateDto: UpdateInitiativeDto, role?: string, userId?: string) {
    const index = this.indexOf(id);
    const existing = this.database.initiatives[index];
    this.assertDates(
      updateDto.start_date ?? existing.start_date ?? undefined,
      updateDto.target_date ?? existing.target_date ?? undefined,
    );
    const { decision_note: note, ...changes } = updateDto;
    const to = (changes.status ?? existing.status) as InitiativeStatus;
    assertMove(INITIATIVE_MOVES, role, existing.status, to, "an initiative");
    this.assertScope({ ...existing, ...changes });
    this.database.initiatives[index] = {
      ...existing,
      ...changes,
      status: to,
      organization_id: existing.organization_id,
    };
    this.afterMove(this.database.initiatives[index], existing.status, to, userId, note);
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
    // Starting work without a start date: it starts today.
    if (to === InitiativeStatus.IN_PROGRESS && !record.start_date) record.start_date = today;
    // Completing it records what it actually saved up to now.
    if (to === InitiativeStatus.COMPLETED) {
      record.completed_at = new Date().toISOString();
      const perf = this.measure(record);
      record.verified_saving = perf.measurable && perf.months_compared > 0 ? perf.actual_saving_to_date : null;
      record.verified_at = record.verified_saving === null ? null : record.completed_at;
    }
    if (from === InitiativeStatus.PROPOSED) {
      record.decided_by_id = userId ?? null;
      record.decided_at = new Date().toISOString();
      record.decision_note = note ?? null;
      this.notify(
        record,
        [record.created_by_id],
        to === InitiativeStatus.APPROVED
          ? `Your initiative "${record.title}" was approved.`
          : `Your initiative "${record.title}" was not approved${note ? `: ${note}` : "."}`,
      );
    }
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

  private withPerformance(record: Initiative) {
    return { ...record, performance: this.measure(record) };
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
