import { Injectable, BadRequestException } from "@nestjs/common";
import { DatabaseService, MeterStatus, MeterType, WastageType } from "../../core/database/database.service";
import { scopeToTenant, currentOrgId } from "../../core/tenancy/tenant-context";
import { GAS_CO2_KG_PER_M3, GRID_CO2_KG_PER_KWH } from "../organizations/organizations.service";
import { addMonths, defaultRange, isPeriod, periodsBetween } from "../../core/utils/period";
import { compareYoY, meterSum, sumIn } from "../../core/utils/period-compare";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function monthLabel(period: string): string {
  const parts = period.split("-");
  if (parts.length < 2) return period;
  const m = Number(parts[1]);
  const name = MONTH_NAMES[m - 1] || parts[1];
  return `${name} ${parts[0]}`;
}

const GRANULARITIES: Record<string, "month" | "quarter" | "year"> = {
  month: "month",
  monthly: "month",
  quarter: "quarter",
  quarterly: "quarter",
  year: "year",
  yearly: "year",
};

/**
 * Readings are monthly totals, so a month is the finest honest granularity.
 * Anything finer (week, day) would have to be invented, and is refused.
 */
function normaliseGranularity(value?: string): "month" | "quarter" | "year" {
  if (!value) return "month";
  const gran = GRANULARITIES[value.trim().toLowerCase()];
  if (!gran)
    throw new BadRequestException(
      `'granularity' must be one of month, quarter or year (got '${value}'). Readings are monthly totals, so finer splits are not available.`,
    );
  return gran;
}

/**
 * Rounds each row's share of a total so the rounded shares add up to the
 * rounded total (largest-remainder method).
 */
function apportion<T extends Record<string, any>>(rows: T[], raw: (r: T) => number, key: keyof T) {
  const exact = rows.map(raw);
  const target = Math.round(exact.reduce((a, b) => a + b, 0));
  const floors = exact.map(Math.floor);
  let left = target - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  rows.forEach((r, i) => ((r as any)[key] = floors[i]));
}

export interface SummaryRow {
  period: string;
  label: string;
  energy_kwh: number;
  energy_mwh: number;
  water_kl: number;
  water_ml: number;
  gas_m3: number;
  food_kg: number;
  /** Scope 1: natural gas burned on site. */
  scope1_kg: number;
  /** Scope 2: purchased grid electricity. */
  scope2_kg: number;
  /** scope1_kg + scope2_kg. */
  emissions_kg: number;
  emissions_t: number;
}

/** One series row (or a totals block) from the four raw quantities. */
function buildRow(
  period: string,
  label: string,
  q: { energy_kwh: number; water_kl: number; gas_m3: number; food_kg: number },
): SummaryRow {
  const scope1_kg = Math.round(q.gas_m3 * GAS_CO2_KG_PER_M3);
  const scope2_kg = Math.round(q.energy_kwh * GRID_CO2_KG_PER_KWH);
  const emissions_kg = scope1_kg + scope2_kg;
  return {
    period,
    label,
    energy_kwh: q.energy_kwh,
    energy_mwh: Number((q.energy_kwh / 1000).toFixed(2)),
    water_kl: q.water_kl,
    water_ml: Number((q.water_kl / 1000).toFixed(3)),
    gas_m3: q.gas_m3,
    food_kg: q.food_kg,
    scope1_kg,
    scope2_kg,
    emissions_kg,
    emissions_t: Number((emissions_kg / 1000).toFixed(2)),
  };
}

/** Sums monthly rows into coarser buckets (quarters or years). */
function rollUp(
  rows: SummaryRow[],
  bucket: (period: string) => { key: string; label: string },
): SummaryRow[] {
  const map = new Map<string, SummaryRow>();
  for (const r of rows) {
    const { key, label } = bucket(r.period);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...r, period: key, label });
      continue;
    }
    existing.energy_kwh += r.energy_kwh;
    existing.energy_mwh = Number((existing.energy_kwh / 1000).toFixed(2));
    existing.water_kl += r.water_kl;
    existing.water_ml = Number((existing.water_kl / 1000).toFixed(3));
    existing.gas_m3 += r.gas_m3;
    existing.food_kg += r.food_kg;
    existing.scope1_kg += r.scope1_kg;
    existing.scope2_kg += r.scope2_kg;
    existing.emissions_kg += r.emissions_kg;
    existing.emissions_t = Number((existing.emissions_kg / 1000).toFixed(2));
  }
  return Array.from(map.values());
}

@Injectable()
export class SustainabilityMetricsService {
  constructor(private database: DatabaseService) {}

  findAll() {
    return scopeToTenant(this.database.sustainabilityMetrics);
  }

  /**
   * Tenant-scoped sustainability metrics summary.
   *
   * Every figure is a sum of real meter readings (plus food wastage reports
   * for food). Nothing is interpolated or split synthetically: the finest
   * granularity is the month, because readings are monthly totals.
   *
   * Emissions are Scope 1 (natural gas burned on site, GAS_CO2_KG_PER_M3)
   * plus Scope 2 (grid electricity, GRID_CO2_KG_PER_KWH).
   *
   * Also returns the change against the previous period of equal length,
   * meter coverage, and the active meters that sent nothing in the period.
   */
  getSummary(opts: { from?: string; to?: string; granularity?: string; groupBy?: string }) {
    if (opts.groupBy !== undefined && opts.groupBy !== "building")
      throw new BadRequestException(`'groupBy' can only be 'building' (got '${opts.groupBy}')`);
    let from = opts.from ? opts.from.trim().slice(0, 7) : "";
    let to = opts.to ? opts.to.trim().slice(0, 7) : "";

    if (opts.from && !isPeriod(from)) {
      throw new BadRequestException(`'from' (${opts.from}) must be YYYY-MM or YYYY-MM-DD`);
    }
    if (opts.to && !isPeriod(to)) {
      throw new BadRequestException(`'to' (${opts.to}) must be YYYY-MM or YYYY-MM-DD`);
    }

    const gran = normaliseGranularity(opts.granularity);

    if (!from && !to) {
      ({ from, to } = defaultRange());
    } else if (!from) {
      from = to;
    } else if (!to) {
      to = from;
    }

    if (from > to) {
      throw new BadRequestException(`'from' (${from}) must not be after 'to' (${to})`);
    }

    const periods = periodsBetween(from, to);
    const numMonths = periods.length;
    const prevPeriods = periodsBetween(addMonths(from, -numMonths), addMonths(from, -1));

    const tenantMeters = scopeToTenant(this.database.meters);
    const meterIds = tenantMeters.map((m) => m.meter_id);
    const idsOfType = (type: MeterType) =>
      tenantMeters.filter((m) => m.meter_type === type).map((m) => m.meter_id);

    const electricityMeterIds = idsOfType(MeterType.ELECTRICITY);
    const waterMeterIds = idsOfType(MeterType.WATER);
    const gasMeterIds = idsOfType(MeterType.GAS);
    const foodMeterIds = idsOfType(MeterType.FOOD);

    // Sum helper across meters and specific period list
    const sumReadings = (targetMeterIds: string[], targetPeriods: string[]) => {
      if (targetMeterIds.length === 0 || targetPeriods.length === 0) return 0;
      return this.database.meterReadings
        .filter(
          (r) =>
            targetMeterIds.includes(r.meter_id) &&
            typeof r.timestamp === "string" &&
            targetPeriods.includes(r.timestamp.slice(0, 7)),
        )
        .reduce((sum, r) => sum + Number(r.value || 0), 0);
    };

    // Also look up food wastage reports in target periods for this tenant
    const tenantWastage = scopeToTenant(this.database.wastageReports);
    const sumFoodWastage = (targetPeriods: string[]) => {
      let total = 0;
      tenantWastage.forEach((w) => {
        if (w.type === WastageType.FOOD && w.details?.specificData?.estimatedAmount) {
          // A report with no date cannot be placed in a month, so it is not
          // counted (it used to land in whatever month the view started on).
          const createdAt = (w as any).created_at;
          if (typeof createdAt === "string" && targetPeriods.includes(createdAt.slice(0, 7))) {
            total += parseFloat(w.details.specificData.estimatedAmount) || 0;
          }
        }
      });
      return total;
    };

    // Calculate series by month
    const monthlySeries: SummaryRow[] = periods.map((p) =>
      buildRow(p, monthLabel(p), {
        energy_kwh: Math.round(sumReadings(electricityMeterIds, [p])),
        water_kl: Math.round(sumReadings(waterMeterIds, [p])),
        gas_m3: Math.round(sumReadings(gasMeterIds, [p])),
        food_kg: Math.round(sumReadings(foodMeterIds, [p]) + sumFoodWastage([p])),
      }),
    );

    // Totals for current period
    const sumOf = (key: "energy_kwh" | "water_kl" | "gas_m3" | "food_kg") =>
      monthlySeries.reduce((acc, s) => acc + s[key], 0);
    const { period: _p, label: _l, ...totals } = buildRow("", "", {
      energy_kwh: sumOf("energy_kwh"),
      water_kl: sumOf("water_kl"),
      gas_m3: sumOf("gas_m3"),
      food_kg: sumOf("food_kg"),
    });

    // Totals for previous period
    const prev = buildRow("", "", {
      energy_kwh: Math.round(sumReadings(electricityMeterIds, prevPeriods)),
      water_kl: Math.round(sumReadings(waterMeterIds, prevPeriods)),
      gas_m3: Math.round(sumReadings(gasMeterIds, prevPeriods)),
      food_kg: Math.round(sumReadings(foodMeterIds, prevPeriods) + sumFoodWastage(prevPeriods)),
    });

    const calcPct = (curr: number, prev: number) =>
      prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : 0;

    const change = {
      energy_pct: calcPct(totals.energy_kwh, prev.energy_kwh),
      water_pct: calcPct(totals.water_kl, prev.water_kl),
      gas_pct: calcPct(totals.gas_m3, prev.gas_m3),
      food_pct: calcPct(totals.food_kg, prev.food_kg),
      emissions_pct: calcPct(totals.emissions_kg, prev.emissions_kg),
      has_comparison: prev.energy_kwh > 0 || prev.water_kl > 0,
    };

    // Meter coverage
    const periodReadings = this.database.meterReadings.filter(
      (r) =>
        meterIds.includes(r.meter_id) &&
        typeof r.timestamp === "string" &&
        periods.includes(r.timestamp.slice(0, 7)),
    );
    const reportingMeterIds = new Set(periodReadings.map((r) => r.meter_id));

    const meter_coverage = {
      active: tenantMeters.filter((m) => m.status === MeterStatus.ACTIVE).length,
      faulty: tenantMeters.filter((m) => m.status === MeterStatus.FAULTY).length,
      calibrating: tenantMeters.filter((m) => m.status === MeterStatus.CALIBRATING).length,
      decommissioned: tenantMeters.filter((m) => m.status === MeterStatus.DECOMMISSIONED).length,
      total: tenantMeters.length,
      /** Any meter with readings in the period, whatever its status. */
      reporting_in_period: reportingMeterIds.size,
      /**
       * Active meters with readings in the period. Compare this, not
       * reporting_in_period, with `active`: a calibrating or faulty meter
       * that still sends readings would otherwise hide a silent active one.
       */
      active_reporting: tenantMeters.filter(
        (m) => m.status === MeterStatus.ACTIVE && reportingMeterIds.has(m.meter_id),
      ).length,
    };

    // Active meters that should have reported but sent nothing in the period.
    const silent_meters = tenantMeters
      .filter((m) => m.status === MeterStatus.ACTIVE && !reportingMeterIds.has(m.meter_id))
      .map((m) => ({
        meter_id: m.meter_id,
        meter_code: m.meter_code,
        meter_type: m.meter_type,
        building_id: m.building_id,
      }));

    // Roll months up into quarters or years when asked.
    let series = monthlySeries;
    if (gran === "quarter") {
      series = rollUp(monthlySeries, (p) => {
        const [y, mo] = p.split("-").map(Number);
        const q = Math.ceil(mo / 3);
        return { key: `${y}-Q${q}`, label: `Q${q} ${y}` };
      });
    } else if (gran === "year") {
      series = rollUp(monthlySeries, (p) => {
        const y = p.split("-")[0];
        return { key: y, label: `Year ${y}` };
      });
    }

    return {
      organization_id: currentOrgId() ?? null,
      from: periods[0] ?? from,
      to: periods[periods.length - 1] ?? to,
      granularity: gran,
      emission_factors: {
        grid_kg_per_kwh: GRID_CO2_KG_PER_KWH,
        gas_kg_per_m3: GAS_CO2_KG_PER_M3,
      },
      totals,
      /**
       * The previous period of equal length that `change` compares against.
       * A zero here means "nothing to compare with", which is different from
       * a 0% change; callers must not present one as the other.
       */
      previous_totals: {
        from: prevPeriods[0],
        to: prevPeriods[prevPeriods.length - 1],
        energy_kwh: prev.energy_kwh,
        water_kl: prev.water_kl,
        gas_m3: prev.gas_m3,
        food_kg: prev.food_kg,
        emissions_kg: prev.emissions_kg,
      },
      change,
      series,
      meter_coverage,
      silent_meters,
      ...(opts.groupBy === "building"
        ? { by_building: this.byBuilding(tenantMeters, periods, prevPeriods, reportingMeterIds) }
        : {}),
    };
  }

  /**
   * The same totals split by building, so the officer can see where use is
   * concentrated and where it is rising. Every meter belongs to exactly one
   * building, so the buildings add up to the campus totals (food is left
   * out: food wastage reports are not tied to a building).
   */
  private byBuilding(
    tenantMeters: { meter_id: string; meter_code: string; building_id: string; meter_type: MeterType; status: MeterStatus }[],
    periods: string[],
    prevPeriods: string[],
    reportingMeterIds: Set<string>,
  ) {
    const buildings = scopeToTenant(this.database.buildings);
    const sum = (ids: string[], ps: string[]) => ps.reduce((acc, p) => acc + sumIn(this.database, ids, p), 0);
    const pct = (now: number, before: number) =>
      before > 0 ? Number((((now - before) / before) * 100).toFixed(1)) : null;

    const rows = buildings
      .map((b) => {
        const meters = tenantMeters.filter((m) => m.building_id === b.building_id);
        const ids = (type: MeterType) => meters.filter((m) => m.meter_type === type).map((m) => m.meter_id);
        const elec = ids(MeterType.ELECTRICITY);
        const water = ids(MeterType.WATER);
        const gas = ids(MeterType.GAS);
        const totals = buildRow("", "", {
          energy_kwh: periods.reduce((acc, p) => acc + Math.round(sumIn(this.database, elec, p)), 0),
          water_kl: periods.reduce((acc, p) => acc + Math.round(sumIn(this.database, water, p)), 0),
          gas_m3: periods.reduce((acc, p) => acc + Math.round(sumIn(this.database, gas, p)), 0),
          food_kg: 0,
        });
        const prevEnergy = Math.round(sum(elec, prevPeriods));
        // Same months a year earlier, like for like (shared with targets).
        // Decommissioned meters are left out, as targets and savings do: a
        // meter that stopped reporting would otherwise read as a saving.
        const liveElec = meters
          .filter((m) => m.meter_type === MeterType.ELECTRICITY && m.status !== MeterStatus.DECOMMISSIONED)
          .map((m) => m.meter_id);
        const yoy = compareYoY(meterSum(this.database, liveElec), periods);
        const active = meters.filter((m) => m.status === MeterStatus.ACTIVE);
        return {
          building_id: b.building_id,
          name: b.name,
          energy_kwh: totals.energy_kwh,
          water_kl: totals.water_kl,
          gas_m3: totals.gas_m3,
          scope1_kg: totals.scope1_kg,
          scope2_kg: totals.scope2_kg,
          emissions_kg: totals.emissions_kg,
          /** Electricity against the previous period of the same length. */
          change_pct: pct(totals.energy_kwh, prevEnergy),
          /** Electricity against the same months a year earlier (compared months only). */
          yoy_pct: yoy.months_compared > 0 ? yoy.change_pct : null,
          meters_total: meters.length,
          meters_reporting: meters.filter((m) => reportingMeterIds.has(m.meter_id)).length,
          silent_meters: active
            .filter((m) => !reportingMeterIds.has(m.meter_id))
            .map((m) => ({ meter_id: m.meter_id, meter_code: m.meter_code, meter_type: m.meter_type })),
          faulty_meters: meters
            .filter((m) => m.status === MeterStatus.FAULTY || m.status === MeterStatus.CALIBRATING)
            .map((m) => ({ meter_id: m.meter_id, meter_code: m.meter_code, meter_type: m.meter_type, status: m.status })),
        };
      })
      .sort((a, b) => b.energy_kwh - a.energy_kwh);

    // Emissions are rounded once for the campus; round each building's share
    // so the buildings add up to exactly that figure (largest remainder).
    apportion(rows, (r) => r.gas_m3 * GAS_CO2_KG_PER_M3, "scope1_kg");
    apportion(rows, (r) => r.energy_kwh * GRID_CO2_KG_PER_KWH, "scope2_kg");
    for (const r of rows) r.emissions_kg = r.scope1_kg + r.scope2_kg;
    return rows;
  }
}
