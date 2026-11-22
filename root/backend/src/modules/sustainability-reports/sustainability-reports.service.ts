import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import {
  DatabaseService,
  InitiativeStatus,
  MeterStatus,
  NotificationTargetType,
  SustainabilityReport,
  UserRole,
} from "../../core/database/database.service";
import { TargetsService } from "../targets/targets.service";
import { assertMove, MoveTable } from "../../core/utils/transitions";
import { pushNotifications, usersWithRole } from "../../core/utils/notify";
import { UpdateReportStatusDto } from "./dto/update-report-status.dto";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { SustainabilityMetricsService } from "../sustainability-metrics/sustainability-metrics.service";
import { defaultRange } from "../../core/utils/period";
import { CreateSustainabilityReportDto } from "./dto/create-sustainability-report.dto";
import { GenerateSustainabilityReportDto } from "./dto/generate-sustainability-report.dto";
import { PutSustainabilityReportDto } from "./dto/put-sustainability-report.dto";
import { UpdateSustainabilityReportDto } from "./dto/update-sustainability-report.dto";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2024-12" → "December 2024". */
function monthName(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "December 2024", or "November 2025 to January 2026". */
function rangeName(from: string, to: string): string {
  return from === to ? monthName(from) : `${monthName(from)} to ${monthName(to)}`;
}

/** 61600.4 → "61,600", with a fixed number of decimals. */
function fmt(value: number, digits: number): string {
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** ["A"] → "A", ["A","B"] → "A and B", ["A","B","C"] → "A, B and C". */
function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 *   draft ──(SO or Admin)──► submitted ──(Admin)──► approved ──(Admin)──► published
 *     ▲                          │
 *     └──────(Admin: send back)──┘
 */
const REPORT_MOVES: MoveTable[] = [
  {
    roles: [UserRole.SUSTAINABILITY_OFFICER, UserRole.ORGANIZATION_ADMIN],
    moves: { draft: ["submitted"] },
  },
  {
    roles: [UserRole.ORGANIZATION_ADMIN],
    moves: { submitted: ["approved", "draft"], approved: ["published"] },
  },
];

@Injectable()
export class SustainabilityReportsService {
  constructor(
    private database: DatabaseService,
    private metricsService: SustainabilityMetricsService,
    private targetsService: TargetsService,
  ) {}

  /**
   * Saves a report. The client sends only the period; the snapshot is
   * generated here, exactly as POST /generate previews it, so what is saved
   * always matches the meter readings, data gaps included.
   */
  create(createDto: CreateSustainabilityReportDto, userId?: string) {
    const snapshot = this.generate(createDto);
    const newRecord = {
      ...snapshot,
      report_id: crypto.randomUUID(),
      organization_id: currentOrgId() ?? null,
      generated_by_id: userId ?? null,
      status: "draft",
    };
    this.database.sustainabilityReports.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.sustainabilityReports);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.sustainabilityReports.find(
      (item) => item.report_id === id,
    ));
    if (!record)
      throw new NotFoundException(
        `SustainabilityReport with ID ${id} not found`,
      );
    return record;
  }

  /** Regenerates a saved report for a (possibly new) period. */
  put(id: string, putDto: PutSustainabilityReportDto) {
    const index = this.indexOf(id);
    const existing = this.database.sustainabilityReports[index];
    this.assertDraft(existing);
    const snapshot = this.generate(putDto);
    this.database.sustainabilityReports[index] = {
      ...snapshot,
      report_id: id,
      organization_id: existing.organization_id,
      generated_by_id: existing.generated_by_id,
      status: existing.status ?? "draft",
    } as any;
    return this.database.sustainabilityReports[index];
  }

  /** Renames a saved report. The figures cannot be edited in place. */
  update(id: string, updateDto: UpdateSustainabilityReportDto) {
    const index = this.indexOf(id);
    const existing = this.database.sustainabilityReports[index];
    this.assertDraft(existing);
    this.database.sustainabilityReports[index] = {
      ...existing,
      ...(updateDto.title !== undefined ? { title: updateDto.title } : {}),
    };
    return this.database.sustainabilityReports[index];
  }

  private indexOf(id: string): number {
    const index = this.database.sustainabilityReports.findIndex(
      (item) => item.report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.sustainabilityReports[index]))
      throw new NotFoundException(`SustainabilityReport with ID ${id} not found`);
    return index;
  }

  /**
   * Deletes a draft. Only drafts can be deleted, and the Sustainability
   * Officer only their own; anything submitted or later is part of the
   * record (a published report is corrected by restating it).
   */
  remove(id: string, role?: string, userId?: string) {
    const index = this.indexOf(id);
    const existing = this.database.sustainabilityReports[index];
    if ((existing.status ?? "draft") !== "draft")
      throw new ConflictException(
        `Only a draft report can be deleted (this one is ${existing.status}).`,
      );
    if (role !== UserRole.ORGANIZATION_ADMIN && existing.generated_by_id !== userId)
      throw new ForbiddenException("You can only delete drafts you created.");
    const removed = this.database.sustainabilityReports.splice(index, 1);
    // A discarded restatement frees the published original to be restated again.
    if (existing.supersedes) {
      const original = this.database.sustainabilityReports.find((r) => r.report_id === existing.supersedes);
      if (original && original.superseded_by === existing.report_id) original.superseded_by = null;
    }
    return removed[0];
  }

  /**
   * Sign-off. The Sustainability Officer submits a draft; the Organization
   * Admin approves it or sends it back (with a note), then publishes it.
   * A published report cannot be changed or deleted.
   */
  setStatus(id: string, dto: UpdateReportStatusDto, role?: string, userId?: string) {
    const index = this.indexOf(id);
    const report = this.database.sustainabilityReports[index];
    const from = report.status ?? "draft";
    assertMove(REPORT_MOVES, role, from, dto.status, "a report");
    if (from === dto.status) return report;
    if (from === "draft" && dto.status === "draft") return report;

    const now = new Date().toISOString();
    const org = report.organization_id;
    const admins = usersWithRole(this.database, org, [UserRole.ORGANIZATION_ADMIN]);
    const label = report.title;
    report.status = dto.status;
    if (dto.status === "submitted") {
      report.submitted_at = now;
      report.review_note = null;
      this.notify(report, admins, `Report to approve: ${label}.`);
    } else if (dto.status === "draft") {
      report.review_note = dto.note ?? null;
      this.notify(report, [report.generated_by_id], `Your report "${label}" was sent back${dto.note ? `: ${dto.note}` : "."}`);
    } else if (dto.status === "approved") {
      report.approved_by_id = userId ?? null;
      report.approved_at = now;
      this.notify(report, [report.generated_by_id], `Your report "${label}" was approved.`);
    } else if (dto.status === "published") {
      report.published_at = now;
      this.notify(report, [report.generated_by_id], `Your report "${label}" was published.`);
    }
    return report;
  }

  /**
   * Corrects a published report without changing it: a new draft is built
   * from today's readings for the same period, linked both ways
   * (supersedes / superseded_by) so Archives can show the versions.
   */
  restate(id: string, userId?: string) {
    const original = this.database.sustainabilityReports[this.indexOf(id)];
    if (original.status !== "published")
      throw new ConflictException("Only a published report can be restated; edit the draft instead.");
    if (original.superseded_by)
      throw new ConflictException("This report has already been restated.");
    const fresh = this.create(
      {
        period: original.period,
        from: original.from,
        to: original.to,
        title: `${original.title} (restated)`,
      },
      userId,
    ) as SustainabilityReport;
    fresh.supersedes = original.report_id;
    original.superseded_by = fresh.report_id;
    return fresh;
  }

  /**
   * Extra sections, each included only when there is something in it:
   * the five buildings using the most electricity, target progress (as of
   * the last full month), and initiatives completed in the period with the
   * saving measured for them.
   */
  private sections(summary: any, from: string, to: string) {
    const out: Record<string, any[]> = {};

    const buildings = (summary.by_building ?? [])
      .filter((b: any) => b.energy_kwh > 0 || b.water_kl > 0 || b.gas_m3 > 0)
      .slice(0, 5)
      .map((b: any) => ({
        name: b.name,
        energy_kwh: b.energy_kwh,
        emissions_kg: b.emissions_kg,
        change_pct: b.change_pct,
        yoy_pct: b.yoy_pct,
      }));
    if (buildings.length) out.buildings = buildings;

    const targets = this.targetsService
      .findAll()
      .filter((t: any) => ["active", "met", "missed"].includes(t.status))
      .map((t: any) => ({
        summary: t.summary,
        status: t.status,
        reduction_pct: t.reduction_pct,
        achieved_reduction_pct:
          t.status === "active" ? t.progress.achieved_reduction_pct : (t.final_reduction_pct ?? null),
        required_reduction_pct: t.status === "active" ? t.progress.required_reduction_pct : null,
        on_track: t.status === "active" ? t.progress.on_track : null,
      }));
    if (targets.length) out.targets = targets;

    const units: Record<string, string> = { energy_kwh: "kWh", water_kl: "kL", gas_m3: "m³", emissions_kg: "kg CO₂e" };
    const completed = scopeToTenant(this.database.initiatives)
      .filter(
        (i) =>
          i.status === InitiativeStatus.COMPLETED &&
          i.completed_at &&
          i.completed_at.slice(0, 7) >= from &&
          i.completed_at.slice(0, 7) <= to,
      )
      .map((i) => ({
        title: i.title,
        completed_at: i.completed_at,
        verified_saving: i.verified_saving ?? null,
        expected_saving: i.expected_saving ?? null,
        unit: i.metric ? units[i.metric] : null,
      }));
    if (completed.length) out.initiatives = completed;

    return out;
  }

  private assertDraft(report: SustainabilityReport) {
    const status = report.status ?? "draft";
    if (status !== "draft")
      throw new ConflictException(
        status === "published"
          ? "A published report cannot be changed. Restate it to issue a correction."
          : `Only a draft can be changed (this one is ${status}).`,
      );
  }

  private notify(report: SustainabilityReport, userIds: (string | null | undefined)[], message: string) {
    pushNotifications(this.database, {
      organizationId: report.organization_id,
      userIds,
      targetType: NotificationTargetType.REPORT,
      targetId: report.report_id,
      message,
    });
  }

  /**
   * Generates a computed preview of sustainability metrics for a given period.
   * Validates period bounds, computes metrics and deltas, surfaces data gaps honestly,
   * and DOES NOT persist to the database.
   */
  generate(dto: GenerateSustainabilityReportDto) {
    if (!dto.period || !dto.period.trim()) {
      throw new BadRequestException("Period is required");
    }

    let from = dto.from ? dto.from.trim().slice(0, 7) : "";
    let to = dto.to ? dto.to.trim().slice(0, 7) : "";

    // Parse period if from/to not explicitly given
    if (!from || !to) {
      const p = dto.period.trim();
      // A quarter or month named without a year means the current reporting
      // year: the year of the last full month, not a hard-coded one.
      const range = defaultRange();
      const currentYear = range.to.slice(0, 4);
      const matchYm = p.match(/\b(\d{4}-\d{2})\b/);
      const matchYear = p.match(/\b(20\d{2})\b/);
      const matchQuarter = p.match(/Q([1-4])\s*(20\d{2})?/i);
      const matchMonth = p.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s*(20\d{2})?/i);

      if (p.includes(" to ")) {
        const parts = p.split(" to ");
        from = parts[0].trim().slice(0, 7);
        to = parts[1].trim().slice(0, 7);
      } else if (matchQuarter) {
        const q = Number(matchQuarter[1]);
        const y = matchQuarter[2] || (matchYear ? matchYear[1] : currentYear);
        const startMo = (q - 1) * 3 + 1;
        const endMo = q * 3;
        from = `${y}-${String(startMo).padStart(2, "0")}`;
        to = `${y}-${String(endMo).padStart(2, "0")}`;
      } else if (matchMonth) {
        const monthMap: Record<string, string> = {
          january: "01", february: "02", march: "03", april: "04",
          may: "05", june: "06", july: "07", august: "08",
          september: "09", october: "10", november: "11", december: "12",
        };
        const mo = monthMap[matchMonth[1].toLowerCase()] || "01";
        const y = matchMonth[2] || (matchYear ? matchYear[1] : currentYear);
        from = `${y}-${mo}`;
        to = `${y}-${mo}`;
      } else if (matchYm) {
        from = matchYm[1];
        to = matchYm[1];
      } else if (matchYear) {
        const y = matchYear[1];
        from = `${y}-01`;
        to = `${y}-12`;
      } else {
        ({ from, to } = range);
      }
    }

    if (from > to) {
      throw new BadRequestException(`'from' (${from}) must not be after 'to' (${to})`);
    }

    const summary = this.metricsService.getSummary({ from, to, groupBy: "building" });
    const { totals, change, meter_coverage } = summary;

    // Data gaps, written as plain sentences for whoever reads the report.
    const tenantMeters = scopeToTenant(this.database.meters);
    const data_gaps: string[] = [];
    const prev = summary.previous_totals;

    const faulty = tenantMeters.filter((m) => m.status === MeterStatus.FAULTY);
    if (faulty.length > 0) {
      const many = faulty.length > 1;
      data_gaps.push(
        `${many ? "Meters" : "Meter"} ${listOf(faulty.map((m) => m.meter_code))} ${many ? "are" : "is"} marked faulty, so ${many ? "their" : "its"} readings may be incomplete.`,
      );
    }

    const calibrating = tenantMeters.filter((m) => m.status === MeterStatus.CALIBRATING);
    if (calibrating.length > 0) {
      const many = calibrating.length > 1;
      data_gaps.push(
        `${many ? "Meters" : "Meter"} ${listOf(calibrating.map((m) => m.meter_code))} ${many ? "are" : "is"} being calibrated, so ${many ? "their" : "its"} readings may be inaccurate.`,
      );
    }

    if (summary.silent_meters.length > 0) {
      const codes = summary.silent_meters.map((m) => m.meter_code);
      data_gaps.push(
        `${listOf(codes)} sent no readings for this period. ${meter_coverage.active_reporting} of ${meter_coverage.active} active meters are included.`,
      );
    }

    if (prev.energy_kwh === 0 && prev.water_kl === 0) {
      data_gaps.push(
        `There are no readings for ${rangeName(prev.from, prev.to)}, so changes against the previous period cannot be calculated.`,
      );
    }

    const missing = [
      totals.energy_kwh === 0 && "electricity",
      totals.water_kl === 0 && "water",
      totals.gas_m3 === 0 && "natural gas",
    ].filter(Boolean) as string[];
    if (missing.length > 0) {
      data_gaps.push(`There are no ${listOf(missing)} readings for this period.`);
    }

    // Abatement metrics. Each one is computed from readings in this period
    // and the previous period of equal length, or is null ("not measured")
    // when there is nothing to compare with. No figure is ever filled in
    // with a default: a report that shows a reduction must have measured it.
    // Same formats as the report document: "+2.1%" / "−15.3%" (a real minus).
    const signedPct = (pct: number) =>
      pct === 0 ? "0%" : `${pct > 0 ? "+" : "−"}${fmt(Math.abs(pct), 1)}%`;
    const energyReduction = prev.energy_kwh > 0 ? signedPct(change.energy_pct) : null;
    // Emissions not emitted compared with the previous period. Zero when
    // emissions rose; the deltas show by how much.
    const avoidedEmissions =
      prev.emissions_kg > 0
        ? `${fmt(Math.max(0, prev.emissions_kg - totals.emissions_kg) / 1000, 1)} t CO₂e`
        : null;
    const waterSaved =
      prev.water_kl > 0
        ? `${fmt(Math.max(0, prev.water_kl - totals.water_kl), 0)} kL`
        : null;

    // Per-metric deltas, null where the previous period had no readings, so
    // "no comparison" never reads as "no change".
    const deltaOrNull = (pct: number, prevValue: number) => (prevValue > 0 ? pct : null);

    return {
      title: dto.title || `${dto.period} Sustainability Performance Report`,
      period: dto.period,
      from: summary.from,
      to: summary.to,
      generated_at: new Date().toISOString(),
      totals,
      deltas: {
        energy_pct: deltaOrNull(change.energy_pct, prev.energy_kwh),
        water_pct: deltaOrNull(change.water_pct, prev.water_kl),
        gas_pct: deltaOrNull(change.gas_pct, prev.gas_m3),
        food_pct: deltaOrNull(change.food_pct, prev.food_kg),
        emissions_pct: deltaOrNull(change.emissions_pct, prev.emissions_kg),
      },
      compared_with: { from: prev.from, to: prev.to },
      // The previous period's figures, so a report can show both side by side.
      previous: {
        energy_kwh: prev.energy_kwh,
        water_kl: prev.water_kl,
        gas_m3: prev.gas_m3,
        food_kg: prev.food_kg,
        emissions_kg: prev.emissions_kg,
      },
      metrics: {
        energyReduction,
        avoidedEmissions,
        waterSaved,
        energyConsumed: `${fmt(totals.energy_kwh / 1000, 1)} MWh`,
        waterIntake: `${fmt(totals.water_kl, 0)} kL`,
        emissionsTons: `${fmt(totals.emissions_kg / 1000, 1)} t CO₂e`,
      },
      meter_coverage,
      emission_factors: summary.emission_factors,
      data_gaps,
      ...this.sections(summary, from, to),
    };
  }
}
