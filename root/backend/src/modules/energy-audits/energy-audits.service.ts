import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import {
  AuditFinding,
  AuditStatus,
  DatabaseService,
  EnergyAudit,
  FindingStatus,
  MeterStatus,
  MeterType,
  PeriodFactorValues,
  SavingsVerification,
  VerificationStatus,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { adjustBaseline, verifiedSaving } from "../billing/pricing";
import { CreateEnergyAuditDto } from "./dto/create-energy-audit.dto";
import { PutEnergyAuditDto } from "./dto/put-energy-audit.dto";
import { UpdateEnergyAuditDto } from "./dto/update-energy-audit.dto";
import {
  CreateFindingDto,
  CreateVerificationDto,
  DisputeVerificationDto,
  LockBaselineDto,
  UpdateFindingDto,
  UpdateSurveyDto,
} from "./dto/audit-sub-resource.dto";

/** Grid emissions factor for Indian electricity, kg CO2 per kWh. */
const GRID_CO2_KG_PER_KWH = 0.82;

@Injectable()
export class EnergyAuditsService {
  constructor(private database: DatabaseService) {}

  /* ── CRUD ──────────────────────────────────────────────────────── */

  create(createDto: CreateEnergyAuditDto) {
    const orgId = createDto.organization_id ?? currentOrgId();
    if (!orgId)
      throw new BadRequestException(
        "organization_id is required, either in the body or as the x-org-id header",
      );

    const org = this.database.organizations.find(
      (o) => o.organization_id === orgId,
    );
    if (!org)
      throw new NotFoundException(`Organization with ID ${orgId} not found`);

    const auditor = this.database.users.find(
      (u) => u.user_id === createDto.auditor_id,
    );
    if (!auditor)
      throw new NotFoundException(
        `Auditor with ID ${createDto.auditor_id} not found`,
      );

    const newRecord: EnergyAudit = {
      audit_id: crypto.randomUUID(),
      organization_id: orgId,
      auditor_id: createDto.auditor_id,
      status: createDto.status,
      scheduled_on: createDto.scheduled_on ?? null,
      conducted_on: createDto.conducted_on ?? null,
      approved_on: createDto.approved_on ?? null,
      survey: (createDto.survey as any) ?? {
        buildings_surveyed: 0,
        meters_found: 0,
        data_source_tier: null,
        floor_area_sqm: null,
        notes: null,
      },
      baseline: (createDto.baseline as any) ?? null,
      findings: (createDto.findings as any) ?? [],
      verifications: (createDto.verifications as any) ?? [],
      recommended_plan_id: createDto.recommended_plan_id ?? null,
      projected_annual_saving: createDto.projected_annual_saving ?? 0,
      summary: createDto.summary ?? null,
    };

    this.database.energyAudits.push(newRecord);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.energyAudits);
  }

  findOne(id: string) {
    const record = assertTenantOwns(
      this.database.energyAudits.find((item) => item.audit_id === id),
    );
    if (!record) throw new NotFoundException(`Audit with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutEnergyAuditDto) {
    const index = this.indexOf(id);
    this.database.energyAudits[index] = {
      ...this.database.energyAudits[index],
      ...(putDto as any),
      audit_id: id,
      organization_id: this.database.energyAudits[index].organization_id,
    };
    return this.database.energyAudits[index];
  }

  update(id: string, updateDto: UpdateEnergyAuditDto) {
    const index = this.indexOf(id);
    this.database.energyAudits[index] = {
      ...this.database.energyAudits[index],
      ...(updateDto as any),
      audit_id: id,
      organization_id: this.database.energyAudits[index].organization_id,
    };
    return this.database.energyAudits[index];
  }

  remove(id: string) {
    const index = this.indexOf(id);
    const audit = this.database.energyAudits[index];

    // A contract measures its savings against this audit's baseline. Delete
    // the audit and every future verification loses the figure it compares
    // to, so the subscription has to be repointed first.
    const linked = this.database.subscriptions.filter(
      (s) => s.baseline_audit_id === id,
    );
    if (linked.length > 0)
      throw new ConflictException(
        `Cannot delete audit ${id}: subscription ${linked[0].subscription_id} uses its baseline`,
      );
    if (audit.verifications.some((v) => v.status === VerificationStatus.CLIENT_ACCEPTED))
      throw new ConflictException(
        `Cannot delete audit ${id}: it holds client-accepted verifications that have been billed`,
      );

    return this.database.energyAudits.splice(index, 1)[0];
  }

  /* ── Survey and baseline ───────────────────────────────────────── */

  updateSurvey(id: string, dto: UpdateSurveyDto) {
    const audit = this.findOne(id);
    audit.survey = { ...audit.survey, ...(dto as any) };
    return audit.survey;
  }

  /**
   * Proposes a baseline from the meter readings already on file.
   *
   * The point is that the auditor confirms a number the platform computed
   * rather than typing one in. A hand-entered baseline is the single
   * easiest place to quietly inflate every future savings claim, since
   * everything downstream is measured against it.
   *
   * Returns the monthly average across the window, not the total, because
   * verifications are billed per month and have to compare like with like.
   */
  baselineSuggestion(id: string, from: string, to: string) {
    const audit = this.findOne(id);
    if (!from || !to)
      throw new BadRequestException(
        "from and to are required, as YYYY-MM (e.g. from=2025-03&to=2025-08)",
      );
    if (from > to)
      throw new BadRequestException(`'from' (${from}) must not be after 'to' (${to})`);

    const meterIds = this.liveElectricityMeters(audit.organization_id).map(
      (m) => m.meter_id,
    );
    const periods = this.periodsBetween(from, to);

    const monthlyTotals = periods.map((p) => this.actualKwh(meterIds, p));
    const monthsWithData = monthlyTotals.filter((t) => t > 0).length;
    if (monthsWithData === 0)
      throw new BadRequestException(
        `No meter readings found for ${audit.organization_id} between ${from} and ${to}`,
      );

    const baselineKwh = Math.round(
      monthlyTotals.reduce((a, b) => a + b, 0) / monthsWithData,
    );
    const factors = this.averageFactors(audit.organization_id, periods);
    const org = this.database.organizations.find(
      (o) => o.organization_id === audit.organization_id,
    );
    const tariff = org?.tariff_rate ?? 0;

    return {
      period_from: from,
      period_to: to,
      months_in_window: periods.length,
      months_with_data: monthsWithData,
      meter_ids: meterIds,
      baseline_kwh: baselineKwh,
      baseline_cost: Math.round(baselineKwh * tariff),
      baseline_co2_kg: Math.round(baselineKwh * GRID_CO2_KG_PER_KWH),
      factors,
      monthly: periods.map((period, i) => ({ period, kwh: monthlyTotals[i] })),
    };
  }

  /**
   * Freezes the baseline. Everything the client is ever billed a share of
   * is measured against these numbers, so re-locking is refused: a
   * baseline that can be edited after savings have been claimed against it
   * is not a baseline.
   */
  lockBaseline(id: string, dto: LockBaselineDto) {
    const audit = this.findOne(id);
    if (audit.baseline?.locked)
      throw new ConflictException(
        `Audit ${id} already has a locked baseline. Raise a new audit to re-baseline this site.`,
      );

    const f = dto.factors ?? ({} as PeriodFactorValues);
    if (!f.cooling_degree_days || !f.occupancy_index || !f.floor_area_sqm)
      throw new BadRequestException(
        "factors.cooling_degree_days, factors.occupancy_index and factors.floor_area_sqm are all required: " +
          "without them a later period cannot be normalised and savings cannot be verified",
      );

    audit.baseline = {
      period_from: dto.period_from,
      period_to: dto.period_to,
      locked: true,
      locked_on: new Date().toISOString().slice(0, 10),
      locked_by: dto.locked_by,
      baseline_kwh: dto.baseline_kwh,
      baseline_water_kl: dto.baseline_water_kl ?? 0,
      baseline_cost: dto.baseline_cost ?? 0,
      baseline_co2_kg:
        dto.baseline_co2_kg ?? Math.round(dto.baseline_kwh * GRID_CO2_KG_PER_KWH),
      factors: {
        cooling_degree_days: f.cooling_degree_days,
        occupancy_index: f.occupancy_index,
        floor_area_sqm: f.floor_area_sqm,
      },
    };
    return audit.baseline;
  }

  /* ── Findings ──────────────────────────────────────────────────── */

  addFinding(id: string, dto: CreateFindingDto) {
    const audit = this.findOne(id);

    for (const buildingId of dto.building_ids) {
      const building = this.database.buildings.find(
        (b) => b.building_id === buildingId,
      );
      if (!building)
        throw new NotFoundException(`Building with ID ${buildingId} not found`);
      if (building.organization_id !== audit.organization_id)
        throw new BadRequestException(
          `Building ${buildingId} belongs to a different organisation than this audit`,
        );
    }

    const finding: AuditFinding = {
      finding_id: crypto.randomUUID(),
      title: dto.title,
      category: dto.category,
      severity: dto.severity,
      est_annual_saving: dto.est_annual_saving,
      capex: dto.capex,
      payback_months:
        dto.payback_months ??
        (dto.est_annual_saving > 0
          ? Math.round((dto.capex / dto.est_annual_saving) * 12)
          : 0),
      status: dto.status ?? FindingStatus.PROPOSED,
      implemented_on: null,
      building_ids: dto.building_ids,
    };

    audit.findings.push(finding);
    return finding;
  }

  updateFinding(id: string, findingId: string, dto: UpdateFindingDto) {
    const audit = this.findOne(id);
    const finding = audit.findings.find((f) => f.finding_id === findingId);
    if (!finding)
      throw new NotFoundException(
        `Finding with ID ${findingId} not found on audit ${id}`,
      );

    Object.assign(finding, dto);

    // The implementation date is what scopes which months a saving may be
    // claimed for, so it is stamped here rather than trusted from the body.
    if (finding.status === FindingStatus.IMPLEMENTED && !finding.implemented_on) {
      finding.implemented_on =
        dto.implemented_on ?? new Date().toISOString().slice(0, 10);
    }
    if (finding.status !== FindingStatus.IMPLEMENTED && !dto.implemented_on) {
      // Reverting a finding out of IMPLEMENTED withdraws its claim: the
      // date goes with it, so past periods stop crediting the measure.
      if (finding.status !== FindingStatus.VERIFIED) finding.implemented_on = null;
    }

    return finding;
  }

  removeFinding(id: string, findingId: string) {
    const audit = this.findOne(id);
    const index = audit.findings.findIndex((f) => f.finding_id === findingId);
    if (index === -1)
      throw new NotFoundException(
        `Finding with ID ${findingId} not found on audit ${id}`,
      );

    const credited = audit.verifications.some((v) =>
      v.finding_ids.includes(findingId),
    );
    if (credited)
      throw new ConflictException(
        `Cannot delete finding ${findingId}: a savings verification credits it`,
      );

    return audit.findings.splice(index, 1)[0];
  }

  /* ── Verification ──────────────────────────────────────────────── */

  /**
   * Computes what could be claimed for one month, without saving anything.
   *
   * Three things happen here, and the order matters:
   *
   *  1. Attribution — only findings that are IMPLEMENTED, and only those
   *     implemented before the period ended, contribute. Their buildings
   *     decide which meters count, and decommissioned meters drop out.
   *  2. Adjustment — the locked baseline is restated for this month's
   *     weather, occupancy and floor area before anything is subtracted.
   *  3. Comparison — savings are adjusted-baseline minus actual, floored
   *     at zero.
   *
   * The raw figure is returned alongside so the client signing it can see
   * exactly how much of a naive claim the adjustment removed.
   */
  verificationSuggestion(id: string, period: string) {
    const audit = this.findOne(id);
    if (!period || !/^\d{4}-\d{2}$/.test(period))
      throw new BadRequestException("period is required, as YYYY-MM");
    if (!audit.baseline?.locked)
      throw new ConflictException(
        `Audit ${id} has no locked baseline. Lock one before verifying savings against it.`,
      );

    const creditable = this.creditableFindings(audit, period);
    const meters = this.attributableMeters(audit, creditable);
    const meterIds = meters.map((m) => m.meter_id);

    const actualKwh = this.actualKwh(meterIds, period);
    const actualFactors = this.factorsFor(audit.organization_id, period);

    // The locked baseline covers the whole estate, but a set of findings
    // may only touch part of it. Comparing an estate-wide baseline against
    // consumption on two of ten meters would report the other eight as
    // savings, so the baseline is first narrowed to the same meters using
    // the share of consumption they accounted for during the baseline
    // window itself.
    const scopeShare = this.baselineShare(audit, meterIds);
    const rawBaseline = Math.round(audit.baseline.baseline_kwh * scopeShare);

    const adjustedBaseline = Math.round(
      adjustBaseline(rawBaseline, audit.baseline.factors, actualFactors),
    );

    const org = this.database.organizations.find(
      (o) => o.organization_id === audit.organization_id,
    );
    const { savedKwh, savedAmount } = verifiedSaving(
      adjustedBaseline,
      actualKwh,
      org?.tariff_rate ?? 0,
    );

    // What a naive baseline-minus-actual would have claimed. Shown, never
    // billed: the gap between the two is the point of the whole exercise.
    const naiveSavedKwh = Math.max(0, rawBaseline - actualKwh);

    return {
      period,
      finding_ids: creditable.map((f) => f.finding_id),
      meter_ids: meterIds,
      actual_factors: actualFactors,
      /** The audit's estate-wide locked baseline, before scoping. */
      estate_baseline_kwh: audit.baseline.baseline_kwh,
      /** Share of that estate the credited meters accounted for. */
      scope_share: Number(scopeShare.toFixed(4)),
      raw_baseline_kwh: rawBaseline,
      adjusted_baseline_kwh: adjustedBaseline,
      actual_kwh: actualKwh,
      saved_kwh: savedKwh,
      saved_amount: savedAmount,
      unadjusted_saved_kwh: naiveSavedKwh,
      unadjusted_saved_amount: Math.round(naiveSavedKwh * (org?.tariff_rate ?? 0)),
      adjustment_kwh: adjustedBaseline - rawBaseline,
      claimable: creditable.length > 0 && savedKwh > 0,
    };
  }

  /**
   * Persists a verification as a draft.
   *
   * Every figure is recomputed here rather than accepted from the request
   * body. The party submitting this works for the party being paid a share
   * of the result, so nothing about the claim is taken on trust.
   */
  addVerification(id: string, dto: CreateVerificationDto) {
    const audit = this.findOne(id);
    if (audit.verifications.some((v) => v.period === dto.period))
      throw new ConflictException(
        `Audit ${id} already has a verification for ${dto.period}`,
      );

    const computed = this.verificationSuggestion(id, dto.period);
    if (computed.finding_ids.length === 0)
      throw new ConflictException(
        `Nothing to verify for ${dto.period}: no implemented findings covered this period. ` +
          `The performance share is payable only where recommendations were implemented.`,
      );

    const verification: SavingsVerification = {
      verification_id: crypto.randomUUID(),
      period: dto.period,
      status: VerificationStatus.DRAFT,
      finding_ids: computed.finding_ids,
      meter_ids: computed.meter_ids,
      actual_factors: computed.actual_factors,
      raw_baseline_kwh: computed.raw_baseline_kwh,
      adjusted_baseline_kwh: computed.adjusted_baseline_kwh,
      actual_kwh: computed.actual_kwh,
      saved_kwh: computed.saved_kwh,
      saved_amount: computed.saved_amount,
      signed_by: null,
      signed_on: null,
      accepted_by: null,
      accepted_on: null,
      dispute_reason: null,
      disputed_on: null,
    };

    audit.verifications.push(verification);
    return verification;
  }

  /** The auditor's sign-off. Still not billable — the client has to accept. */
  signVerification(id: string, verificationId: string, signedBy: string) {
    const { verification } = this.locateVerification(id, verificationId);
    if (verification.status === VerificationStatus.CLIENT_ACCEPTED)
      throw new ConflictException(
        `Verification ${verificationId} has already been accepted by the client and cannot be re-signed`,
      );

    verification.status = VerificationStatus.AUDITOR_SIGNED;
    verification.signed_by = signedBy;
    verification.signed_on = new Date().toISOString().slice(0, 10);
    return verification;
  }

  /**
   * The client's counter-signature, and the moment a claim becomes money.
   *
   * This is the one write in the revenue model a client-side role may
   * perform, and it exists to close a hole: the auditor who locks the
   * baseline works for EnerTrack, and EnerTrack is paid a share of the gap
   * between that baseline and actual consumption. Without a counterparty
   * that is a loop the vendor controls from both ends.
   *
   * The tenant check below is the load-bearing part. A client may only
   * accept claims against their own organisation, never another's.
   */
  acceptVerification(id: string, verificationId: string, acceptedBy: string) {
    const { audit, verification } = this.locateVerification(id, verificationId);
    this.assertCallerBelongsToTenant(audit);

    if (verification.status === VerificationStatus.DRAFT)
      throw new ConflictException(
        `Verification ${verificationId} has not been signed by the auditor yet`,
      );
    if (verification.status === VerificationStatus.CLIENT_ACCEPTED)
      throw new ConflictException(
        `Verification ${verificationId} has already been accepted`,
      );

    verification.status = VerificationStatus.CLIENT_ACCEPTED;
    verification.accepted_by = acceptedBy;
    verification.accepted_on = new Date().toISOString().slice(0, 10);
    verification.dispute_reason = null;
    verification.disputed_on = null;

    // The measures that produced an accepted saving are settled.
    for (const finding of audit.findings) {
      if (verification.finding_ids.includes(finding.finding_id))
        finding.status = FindingStatus.VERIFIED;
    }

    return verification;
  }

  /** The client's rejection. A disputed claim never reaches an invoice. */
  disputeVerification(
    id: string,
    verificationId: string,
    dto: DisputeVerificationDto,
  ) {
    const { audit, verification } = this.locateVerification(id, verificationId);
    this.assertCallerBelongsToTenant(audit);

    if (verification.status === VerificationStatus.CLIENT_ACCEPTED)
      throw new ConflictException(
        `Verification ${verificationId} was already accepted. Raise a credit note rather than disputing it after the fact.`,
      );

    verification.status = VerificationStatus.DISPUTED;
    verification.dispute_reason = dto.dispute_reason;
    verification.disputed_on = new Date().toISOString().slice(0, 10);
    verification.accepted_by = null;
    verification.accepted_on = null;
    return verification;
  }

  /** Verifications across every audit, for the platform-side worklists. */
  listVerifications(status?: string) {
    return scopeToTenant(this.database.energyAudits).flatMap((audit) =>
      audit.verifications
        .filter((v) => !status || v.status === status)
        .map((v) => ({
          ...v,
          audit_id: audit.audit_id,
          organization_id: audit.organization_id,
          organization_name:
            this.database.organizations.find(
              (o) => o.organization_id === audit.organization_id,
            )?.name ?? null,
        })),
    );
  }

  /* ── Internals ─────────────────────────────────────────────────── */

  /**
   * Findings that may be credited for a period.
   *
   * A finding counts only when it is IMPLEMENTED and was implemented on or
   * before the last day of the period. Anything proposed, accepted but not
   * done, or completed after the month ended contributes nothing — which
   * is what makes the share "payable only where recommendations were
   * implemented" true in code and not just on the pricing page.
   */
  private creditableFindings(audit: EnergyAudit, period: string): AuditFinding[] {
    return audit.findings.filter((f) => {
      const settled =
        f.status === FindingStatus.IMPLEMENTED ||
        f.status === FindingStatus.VERIFIED;
      if (!settled || !f.implemented_on) return false;
      return f.implemented_on.slice(0, 7) <= period;
    });
  }

  /**
   * Meters a set of findings covers.
   *
   * Scoped by the buildings the measures touch, then narrowed to live
   * electricity meters. A decommissioned meter reports nothing, so
   * including it would drag actual consumption down and inflate the claim.
   */
  private attributableMeters(audit: EnergyAudit, findings: AuditFinding[]) {
    const buildingIds = new Set(findings.flatMap((f) => f.building_ids));
    return this.liveElectricityMeters(audit.organization_id).filter((m) =>
      buildingIds.has(m.building_id),
    );
  }

  /**
   * What fraction of the baseline belongs to a subset of meters.
   *
   * Measured over the baseline window itself, from the same readings the
   * baseline was derived from, so the split reflects how the estate
   * actually consumed rather than a headcount of meters. Returns 1 when
   * the window has no readings to divide, which leaves the baseline
   * unscoped rather than collapsing it to zero.
   */
  private baselineShare(audit: EnergyAudit, meterIds: string[]): number {
    if (!audit.baseline) return 1;
    const periods = this.periodsBetween(
      audit.baseline.period_from,
      audit.baseline.period_to,
    );
    const allMeterIds = this.liveElectricityMeters(audit.organization_id).map(
      (m) => m.meter_id,
    );

    const total = periods.reduce((sum, p) => sum + this.actualKwh(allMeterIds, p), 0);
    if (total <= 0) return 1;

    const scoped = periods.reduce((sum, p) => sum + this.actualKwh(meterIds, p), 0);
    return scoped / total;
  }

  private liveElectricityMeters(orgId: string) {
    return this.database.meters.filter(
      (m) =>
        m.organization_id === orgId &&
        m.meter_type === MeterType.ELECTRICITY &&
        m.status !== MeterStatus.DECOMMISSIONED,
    );
  }

  /** Total kWh recorded on a set of meters during one "YYYY-MM". */
  private actualKwh(meterIds: string[], period: string): number {
    if (meterIds.length === 0) return 0;
    return Math.round(
      this.database.meterReadings
        .filter(
          (r) =>
            meterIds.includes(r.meter_id) &&
            typeof r.timestamp === "string" &&
            r.timestamp.slice(0, 7) === period,
        )
        .reduce((sum, r) => sum + Number(r.value || 0), 0),
    );
  }

  /**
   * Normalisation factors for one month.
   *
   * Falls back to the organisation's own floor area with neutral weather
   * and occupancy when a month has no recorded factors, so an unseeded
   * period yields no adjustment rather than a divide-by-zero.
   */
  private factorsFor(orgId: string, period: string): PeriodFactorValues {
    const row = this.database.periodFactors.find(
      (p) => p.organization_id === orgId && p.period === period,
    );
    if (row)
      return {
        cooling_degree_days: row.cooling_degree_days,
        occupancy_index: row.occupancy_index,
        floor_area_sqm: row.floor_area_sqm,
      };

    const org = this.database.organizations.find(
      (o) => o.organization_id === orgId,
    );
    return {
      cooling_degree_days: 0,
      occupancy_index: 1,
      floor_area_sqm: org?.floor_area_sqm ?? 0,
    };
  }

  private averageFactors(orgId: string, periods: string[]): PeriodFactorValues {
    const rows = this.database.periodFactors.filter(
      (p) => p.organization_id === orgId && periods.includes(p.period),
    );
    if (rows.length === 0) return this.factorsFor(orgId, periods[0] ?? "");

    const mean = (pick: (r: (typeof rows)[number]) => number) =>
      rows.reduce((sum, r) => sum + pick(r), 0) / rows.length;

    return {
      cooling_degree_days: Math.round(mean((r) => r.cooling_degree_days)),
      occupancy_index: Number(mean((r) => r.occupancy_index).toFixed(3)),
      floor_area_sqm: Math.round(mean((r) => r.floor_area_sqm)),
    };
  }

  /** Every "YYYY-MM" from `from` to `to`, inclusive. */
  private periodsBetween(from: string, to: string): string[] {
    const periods: string[] = [];
    let [year, month] = from.split("-").map(Number);
    const [endYear, endMonth] = to.split("-").map(Number);
    while (year < endYear || (year === endYear && month <= endMonth)) {
      periods.push(`${year}-${String(month).padStart(2, "0")}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return periods;
  }

  private locateVerification(id: string, verificationId: string) {
    const audit = this.findOne(id);
    const verification = audit.verifications.find(
      (v) => v.verification_id === verificationId,
    );
    if (!verification)
      throw new NotFoundException(
        `Verification with ID ${verificationId} not found on audit ${id}`,
      );
    return { audit, verification };
  }

  /**
   * Refuses a client acting on another tenant's claim.
   *
   * Accept and dispute are the only routes here a client-side role may
   * call, so this is the boundary that keeps that concession narrow.
   * EnerTrack staff send no x-org-id and are let through — they are
   * platform-side by role, which the tenancy middleware has already
   * established.
   */
  private assertCallerBelongsToTenant(audit: EnergyAudit) {
    const orgId = currentOrgId();
    if (orgId && orgId !== audit.organization_id)
      throw new ForbiddenException(
        "You cannot act on a savings verification belonging to another organisation",
      );
  }

  private indexOf(id: string): number {
    const index = this.database.energyAudits.findIndex(
      (item) => item.audit_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.energyAudits[index]))
      throw new NotFoundException(`Audit with ID ${id} not found`);
    return index;
  }
}
