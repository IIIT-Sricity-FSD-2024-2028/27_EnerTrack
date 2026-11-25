import * as crypto from "crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DatabaseService,
  NotificationTargetType,
  SustainabilityTarget,
  TargetMetric,
  TargetStatus,
  UserRole,
} from "../../core/database/database.service";
import {
  assertTenantOwns,
  currentOrgId,
  scopeToTenant,
} from "../../core/tenancy/tenant-context";
import { addMonths, lastFullMonth, periodsBetween } from "../../core/utils/period";
import { compareMonths, Measure } from "../../core/utils/period-compare";
import { METRIC_INFO, metricMeasure } from "../../core/utils/metric-measure";
import { assertMove, MoveTable } from "../../core/utils/transitions";
import { pushNotifications, usersWithRole } from "../../core/utils/notify";
import { CreateTargetDto } from "./dto/create-target.dto";
import { UpdateTargetStatusDto } from "./dto/update-target-status.dto";

/** Only the Organization Admin decides on a target or closes one early. */
const TARGET_MOVES: MoveTable[] = [
  {
    roles: [UserRole.ORGANIZATION_ADMIN],
    moves: {
      [TargetStatus.PROPOSED]: [TargetStatus.ACTIVE, TargetStatus.REJECTED],
      [TargetStatus.ACTIVE]: [TargetStatus.MET, TargetStatus.MISSED],
    },
  },
];



const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const monthName = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const rangeName = (from: string, to: string) => {
  if (from === to) return monthName(from);
  if (from.endsWith("-01") && to.endsWith("-12") && from.slice(0, 4) === to.slice(0, 4)) return from.slice(0, 4);
  return `${monthName(from)} to ${monthName(to)}`;
};
const monthsFromTo = (from: string, to: string) => periodsBetween(from, to).length;

export interface TargetProgress {
  unit: string;
  meter_count: number;
  /** The months being tracked: after the baseline, up to the last full month or the deadline. */
  tracking_from: string;
  tracking_to: string | null;
  months_compared: number;
  /** Sums over the compared months only, in `unit`. */
  baseline_value: number;
  current_value: number;
  /** What current_value would be at exactly the target reduction. */
  target_value: number;
  /** How far below the baseline the compared months are (negative = above). */
  achieved_reduction_pct: number | null;
  /** Where a straight line from approval (0%) to the deadline says it should be by now. */
  required_reduction_pct: number | null;
  on_track: boolean | null;
  months: { period: string; baseline_period: string; current: number; baseline: number; compared: boolean }[];
}

@Injectable()
export class TargetsService {
  constructor(private database: DatabaseService) {}

  /** "cut electricity by 10% against 2025 by December 2026" */
  describe(t: SustainabilityTarget): string {
    const scope = t.building_ids.length
      ? ` in ${t.building_ids
          .map((id) => this.database.buildings.find((b) => b.building_id === id)?.name ?? id)
          .join(", ")}`
      : "";
    return `cut ${METRIC_INFO[t.metric].name}${scope} by ${t.reduction_pct}% against ${rangeName(t.baseline_from, t.baseline_to)} by ${monthName(t.deadline)}`;
  }

  create(dto: CreateTargetDto, userId?: string) {
    const orgId = currentOrgId() ?? null;
    const last = lastFullMonth();
    if (dto.baseline_from > dto.baseline_to)
      throw new BadRequestException("The baseline must start before it ends.");
    if (dto.baseline_to > last)
      throw new BadRequestException(`The baseline must be months that have finished (up to ${last}).`);
    if (dto.deadline <= dto.baseline_to)
      throw new BadRequestException("The deadline must come after the baseline.");
    if (dto.deadline <= last)
      throw new BadRequestException("The deadline must be a month that has not finished yet.");

    const buildingIds = [...new Set(dto.building_ids ?? [])];
    const orgBuildings = new Set(
      scopeToTenant(this.database.buildings).map((b) => b.building_id),
    );
    const unknown = buildingIds.filter((id) => !orgBuildings.has(id));
    if (unknown.length)
      throw new BadRequestException(`Unknown building: ${unknown.join(", ")}`);

    // One open target per metric and scope, so two targets never compete.
    const sameScope = (t: SustainabilityTarget) =>
      t.metric === dto.metric &&
      [...t.building_ids].sort().join() === [...buildingIds].sort().join() &&
      (t.status === TargetStatus.PROPOSED || t.status === TargetStatus.ACTIVE);
    if (scopeToTenant(this.database.targets).some(sameScope))
      throw new ConflictException(
        `There is already a proposed or active ${METRIC_INFO[dto.metric].name} target for this scope.`,
      );

    const target: SustainabilityTarget = {
      target_id: crypto.randomUUID(),
      organization_id: orgId as string,
      created_by_id: userId ?? null,
      metric: dto.metric,
      baseline_from: dto.baseline_from,
      baseline_to: dto.baseline_to,
      reduction_pct: dto.reduction_pct,
      deadline: dto.deadline,
      building_ids: buildingIds,
      status: TargetStatus.PROPOSED,
      note: dto.note ?? null,
      created_at: new Date().toISOString(),
    };
    this.database.targets.push(target);

    pushNotifications(this.database, {
      organizationId: orgId,
      userIds: usersWithRole(this.database, orgId, [UserRole.ORGANIZATION_ADMIN]),
      targetType: NotificationTargetType.TARGET,
      targetId: target.target_id,
      message: `New target to approve: ${this.describe(target)}.`,
    });
    return this.withProgress(target);
  }

  findAll() {
    this.closeDue();
    return scopeToTenant(this.database.targets)
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((t) => this.withProgress(t));
  }

  findOne(id: string) {
    this.closeDue();
    return this.withProgress(this.get(id));
  }

  progress(id: string): TargetProgress {
    this.closeDue();
    return this.computeProgress(this.get(id));
  }

  /**
   * The Organization Admin approves or rejects a proposal, or closes an
   * active target early. Anyone else gets 403 (see TARGET_MOVES).
   */
  setStatus(id: string, dto: UpdateTargetStatusDto, role?: string, userId?: string) {
    const target = this.get(id);
    assertMove(TARGET_MOVES, role, target.status, dto.status, "a target");
    if (target.status === dto.status) return this.withProgress(target);

    const note = dto.note?.trim() || null;
    // Rejecting needs a reason the proposer can act on; an approval remark is optional.
    if (dto.status === TargetStatus.REJECTED && !note)
      throw new BadRequestException("Give a reason for rejecting it (note); the proposer sees it.");
    const now = new Date().toISOString();
    if (dto.status === TargetStatus.ACTIVE) {
      target.approved_by_id = userId ?? null;
      target.approved_at = now;
      target.decision_note = note;
    }
    if (dto.status === TargetStatus.REJECTED) target.decision_note = note;
    if (dto.status === TargetStatus.MET || dto.status === TargetStatus.MISSED) {
      target.closed_at = now;
      target.final_reduction_pct = this.computeProgress(target).achieved_reduction_pct;
      target.decision_note = dto.note ?? null;
    }
    target.status = dto.status;

    const messages: Partial<Record<TargetStatus, string>> = {
      [TargetStatus.ACTIVE]: `Your target to ${this.describe(target)} was approved and is now being tracked.${note ? ` Remark: ${note}` : ""}`,
      [TargetStatus.REJECTED]: `Your target to ${this.describe(target)} was not approved: ${note}`,
      [TargetStatus.MET]: `The target to ${this.describe(target)} was closed as met.`,
      [TargetStatus.MISSED]: `The target to ${this.describe(target)} was closed as missed.`,
    };
    this.notify(target, [target.created_by_id], messages[dto.status]!);
    return this.withProgress(target);
  }

  /** Withdraws a proposal. Only a proposed target can be removed. */
  remove(id: string, role?: string, userId?: string) {
    const target = this.get(id);
    if (target.status !== TargetStatus.PROPOSED)
      throw new ConflictException(
        `Only a proposed target can be withdrawn (this one is ${target.status}).`,
      );
    if (role !== UserRole.ORGANIZATION_ADMIN && target.created_by_id !== userId)
      throw new NotFoundException(`Target with ID ${id} not found`);
    this.database.targets = this.database.targets.filter((t) => t.target_id !== id);
    this.database.notifications = this.database.notifications.filter(
      (n) => !(n.target_type === NotificationTargetType.TARGET && n.target_id === id),
    );
    return target;
  }

  // ───────────────────────── internals ─────────────────────────

  private get(id: string): SustainabilityTarget {
    const target = assertTenantOwns(this.database.targets.find((t) => t.target_id === id));
    if (!target) throw new NotFoundException(`Target with ID ${id} not found`);
    return target;
  }

  private withProgress(t: SustainabilityTarget) {
    return { ...t, summary: this.describe(t), progress: this.computeProgress(t) };
  }

  private notify(t: SustainabilityTarget, userIds: (string | null | undefined)[], message: string) {
    pushNotifications(this.database, {
      organizationId: t.organization_id,
      userIds,
      targetType: NotificationTargetType.TARGET,
      targetId: t.target_id,
      message,
    });
  }

  private measureFor(t: SustainabilityTarget): { measure: Measure; meterCount: number } {
    const { measure, meterIds } = metricMeasure(this.database, {
      organizationId: t.organization_id,
      metric: t.metric,
      buildingIds: t.building_ids,
    });
    return { measure, meterCount: meterIds.length };
  }

  /**
   * Compares each month after the baseline with the same calendar month in
   * the baseline period, counting only months with readings on both sides.
   */
  private computeProgress(t: SustainabilityTarget): TargetProgress {
    const { measure, meterCount } = this.measureFor(t);
    const baselineMonths = periodsBetween(t.baseline_from, t.baseline_to);
    const trackingFrom = addMonths(t.baseline_to, 1);
    const last = lastFullMonth();
    const trackingTo = t.deadline < last ? t.deadline : last;
    const tracking = trackingFrom <= trackingTo ? periodsBetween(trackingFrom, trackingTo) : [];

    // Same calendar month in the baseline; the latest one if it spans years.
    const pairs: [string, string][] = [];
    for (const p of tracking) {
      const match = baselineMonths.filter((b) => b.slice(5, 7) === p.slice(5, 7)).pop();
      if (match) pairs.push([p, match]);
    }
    const cmp = compareMonths(measure, pairs);
    const achieved = cmp.months_compared > 0 ? Number((-cmp.change_pct).toFixed(1)) : null;

    // Straight line from 0% at approval (or the first tracked month, if later)
    // to the full reduction at the deadline.
    // A target that has not been approved is not being tracked yet, so it
    // shows the measured change but no on-track verdict.
    const tracked = t.status !== TargetStatus.PROPOSED && t.status !== TargetStatus.REJECTED;
    let required: number | null = null;
    const comparedMonths = cmp.months.filter((m) => m.compared);
    if (tracked && comparedMonths.length) {
      const approvedMonth = (t.approved_at ?? t.created_at ?? "").slice(0, 7);
      const start = approvedMonth > trackingFrom ? approvedMonth : trackingFrom;
      const latest = comparedMonths[comparedMonths.length - 1].period;
      const total = Math.max(1, monthsFromTo(start, t.deadline));
      const elapsed = latest < start ? 0 : Math.min(total, monthsFromTo(start, latest));
      required = Number(((t.reduction_pct * elapsed) / total).toFixed(1));
    }

    return {
      unit: METRIC_INFO[t.metric].unit,
      meter_count: meterCount,
      tracking_from: trackingFrom,
      tracking_to: tracking.length ? trackingTo : null,
      months_compared: cmp.months_compared,
      baseline_value: cmp.baseline,
      current_value: cmp.current,
      target_value: Math.round(cmp.baseline * (1 - t.reduction_pct / 100)),
      achieved_reduction_pct: achieved,
      required_reduction_pct: required,
      on_track: achieved === null || required === null ? null : achieved >= required,
      months: cmp.months,
    };
  }

  /**
   * Closes active targets whose deadline month has finished: met when the
   * measured reduction reaches the target, missed otherwise (including when
   * nothing could be measured). Runs whenever targets are read.
   */
  private closeDue() {
    const last = lastFullMonth();
    for (const t of scopeToTenant(this.database.targets)) {
      if (t.status !== TargetStatus.ACTIVE || t.deadline > last) continue;
      const achieved = this.computeProgress(t).achieved_reduction_pct;
      t.status = achieved !== null && achieved >= t.reduction_pct ? TargetStatus.MET : TargetStatus.MISSED;
      t.closed_at = new Date().toISOString();
      t.final_reduction_pct = achieved;
      this.notify(
        t,
        [t.created_by_id, ...usersWithRole(this.database, t.organization_id, [UserRole.ORGANIZATION_ADMIN])],
        `The deadline has passed for the target to ${this.describe(t)}. It was ${t.status}${achieved === null ? " (no readings to measure it)." : `, with a ${achieved}% reduction.`}`,
      );
    }
  }
}
