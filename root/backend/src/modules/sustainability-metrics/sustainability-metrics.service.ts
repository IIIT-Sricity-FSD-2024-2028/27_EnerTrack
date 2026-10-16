import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { DatabaseService, MeterStatus, MeterType, WastageType } from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { GRID_CO2_KG_PER_KWH } from "../organizations/organizations.service";
import { CreateSustainabilityMetricDto } from "./dto/create-sustainability-metric.dto";
import { PutSustainabilityMetricDto } from "./dto/put-sustainability-metric.dto";
import { UpdateSustainabilityMetricDto } from "./dto/update-sustainability-metric.dto";

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

@Injectable()
export class SustainabilityMetricsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateSustainabilityMetricDto) {
    const generatedId = crypto.randomUUID();
    const newRecord = { sustainability_metric_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null };
    this.database.sustainabilityMetrics.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.sustainabilityMetrics);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.sustainabilityMetrics.find(
      (item) => item.sustainability_metric_id === id,
    ));
    if (!record)
      throw new NotFoundException(
        `SustainabilityMetric with ID ${id} not found`,
      );
    return record;
  }

  put(id: string, putDto: PutSustainabilityMetricDto) {
    const index = this.database.sustainabilityMetrics.findIndex(
      (item) => item.sustainability_metric_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.sustainabilityMetrics[index]))
      throw new NotFoundException(
        `Sustainability Metric with ID ${id} not found`,
      );
    this.database.sustainabilityMetrics[index] = {
      sustainability_metric_id: id,
      ...putDto,
    } as any;
    return this.database.sustainabilityMetrics[index];
  }
  update(id: string, updateDto: UpdateSustainabilityMetricDto) {
    const index = this.database.sustainabilityMetrics.findIndex(
      (item) => item.sustainability_metric_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.sustainabilityMetrics[index]))
      throw new NotFoundException(
        `SustainabilityMetric with ID ${id} not found`,
      );
    this.database.sustainabilityMetrics[index] = {
      ...this.database.sustainabilityMetrics[index],
      ...updateDto,
      organization_id: this.database.sustainabilityMetrics[index].organization_id,
    };
    return this.database.sustainabilityMetrics[index];
  }

  remove(id: string) {
    const index = this.database.sustainabilityMetrics.findIndex(
      (item) => item.sustainability_metric_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.sustainabilityMetrics[index]))
      throw new NotFoundException(
        `SustainabilityMetric with ID ${id} not found`,
      );
    const removed = this.database.sustainabilityMetrics.splice(index, 1);
    return removed[0];
  }

  /**
   * Tenant-scoped sustainability metrics summary.
   * Aggregates readings across electricity, water, gas, and food meters,
   * computes CO2 emissions with the standard 0.82 kg/kWh constant,
   * calculates delta against the previous period of equal length,
   * and reports meter coverage and activity.
   */
  getSummary(opts: { from?: string; to?: string; granularity?: string }) {
    let from = opts.from ? opts.from.trim().slice(0, 7) : "";
    let to = opts.to ? opts.to.trim().slice(0, 7) : "";

    const periodPattern = /^\d{4}-\d{2}$/;

    if (opts.from && !periodPattern.test(from)) {
      throw new BadRequestException(`'from' (${opts.from}) must be YYYY-MM or YYYY-MM-DD`);
    }
    if (opts.to && !periodPattern.test(to)) {
      throw new BadRequestException(`'to' (${opts.to}) must be YYYY-MM or YYYY-MM-DD`);
    }

    if (!from && !to) {
      from = "2026-01";
      to = "2026-08";
    } else if (!from) {
      from = to;
    } else if (!to) {
      to = from;
    }

    if (from > to) {
      throw new BadRequestException(`'from' (${from}) must not be after 'to' (${to})`);
    }

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

    const numMonths = periods.length;
    const prevPeriods: string[] = [];
    let [pYear, pMonth] = from.split("-").map(Number);
    pMonth -= 1;
    if (pMonth < 1) {
      pMonth = 12;
      pYear -= 1;
    }
    for (let i = 0; i < numMonths; i++) {
      prevPeriods.unshift(`${pYear}-${String(pMonth).padStart(2, "0")}`);
      pMonth -= 1;
      if (pMonth < 1) {
        pMonth = 12;
        pYear -= 1;
      }
    }

    const tenantMeters = scopeToTenant(this.database.meters);
    const meterIds = tenantMeters.map((m) => m.meter_id);

    const electricityMeterIds = tenantMeters
      .filter((m) => m.meter_type === MeterType.ELECTRICITY)
      .map((m) => m.meter_id);
    const waterMeterIds = tenantMeters
      .filter((m) => m.meter_type === MeterType.WATER)
      .map((m) => m.meter_id);
    const gasMeterIds = tenantMeters
      .filter((m) => m.meter_type === MeterType.GAS)
      .map((m) => m.meter_id);
    const foodMeterIds = tenantMeters
      .filter((m) => m.meter_type === MeterType.FOOD)
      .map((m) => m.meter_id);

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
          const createdPeriod = (w as any).created_at
            ? (w as any).created_at.slice(0, 7)
            : periods[0];
          if (targetPeriods.includes(createdPeriod)) {
            total += parseFloat(w.details.specificData.estimatedAmount) || 0;
          }
        }
      });
      return total;
    };

    // Calculate series by month
    const monthlySeries = periods.map((p) => {
      const e_kwh = Math.round(sumReadings(electricityMeterIds, [p]));
      const w_kl = Math.round(sumReadings(waterMeterIds, [p]));
      const g_m3 = Math.round(sumReadings(gasMeterIds, [p]));
      const f_kg = Math.round(sumReadings(foodMeterIds, [p]) + sumFoodWastage([p]));
      const em_kg = Math.round(e_kwh * GRID_CO2_KG_PER_KWH);
      const em_t = Number((em_kg / 1000).toFixed(2));

      return {
        period: p,
        label: monthLabel(p),
        energy_kwh: e_kwh,
        energy_mwh: Number((e_kwh / 1000).toFixed(2)),
        water_kl: w_kl,
        water_ml: Number((w_kl / 1000).toFixed(3)),
        gas_m3: g_m3,
        food_kg: f_kg,
        emissions_kg: em_kg,
        emissions_t: em_t,
      };
    });

    // Totals for current period
    const total_energy_kwh = monthlySeries.reduce((acc, s) => acc + s.energy_kwh, 0);
    const total_water_kl = monthlySeries.reduce((acc, s) => acc + s.water_kl, 0);
    const total_gas_m3 = monthlySeries.reduce((acc, s) => acc + s.gas_m3, 0);
    const total_food_kg = monthlySeries.reduce((acc, s) => acc + s.food_kg, 0);
    const total_emissions_kg = Math.round(total_energy_kwh * GRID_CO2_KG_PER_KWH);
    const total_emissions_t = Number((total_emissions_kg / 1000).toFixed(2));

    const totals = {
      energy_kwh: total_energy_kwh,
      energy_mwh: Number((total_energy_kwh / 1000).toFixed(2)),
      water_kl: total_water_kl,
      water_ml: Number((total_water_kl / 1000).toFixed(3)),
      gas_m3: total_gas_m3,
      food_kg: total_food_kg,
      emissions_kg: total_emissions_kg,
      emissions_t: total_emissions_t,
    };

    // Totals for previous period
    const prev_energy_kwh = Math.round(sumReadings(electricityMeterIds, prevPeriods));
    const prev_water_kl = Math.round(sumReadings(waterMeterIds, prevPeriods));
    const prev_gas_m3 = Math.round(sumReadings(gasMeterIds, prevPeriods));
    const prev_food_kg = Math.round(sumReadings(foodMeterIds, prevPeriods) + sumFoodWastage(prevPeriods));
    const prev_emissions_kg = Math.round(prev_energy_kwh * GRID_CO2_KG_PER_KWH);

    const calcPct = (curr: number, prev: number) =>
      prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : 0;

    const change = {
      energy_pct: calcPct(total_energy_kwh, prev_energy_kwh),
      water_pct: calcPct(total_water_kl, prev_water_kl),
      gas_pct: calcPct(total_gas_m3, prev_gas_m3),
      food_pct: calcPct(total_food_kg, prev_food_kg),
      emissions_pct: calcPct(total_emissions_kg, prev_emissions_kg),
      has_comparison: prev_energy_kwh > 0 || prev_water_kl > 0,
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
      reporting_in_period: reportingMeterIds.size,
    };

    // Grouping for granularity if requested
    let series = monthlySeries;
    const gran = (opts.granularity || "month").toLowerCase();
    if (gran === "quarter" || gran === "quarterly") {
      const qMap = new Map<string, (typeof monthlySeries)[0]>();
      for (const m of monthlySeries) {
        const [y, mo] = m.period.split("-").map(Number);
        const q = Math.ceil(mo / 3);
        const qKey = `${y}-Q${q}`;
        const existing = qMap.get(qKey);
        if (!existing) {
          qMap.set(qKey, {
            ...m,
            period: qKey,
            label: `Q${q} ${y}`,
          });
        } else {
          existing.energy_kwh += m.energy_kwh;
          existing.energy_mwh = Number((existing.energy_kwh / 1000).toFixed(2));
          existing.water_kl += m.water_kl;
          existing.water_ml = Number((existing.water_kl / 1000).toFixed(3));
          existing.gas_m3 += m.gas_m3;
          existing.food_kg += m.food_kg;
          existing.emissions_kg += m.emissions_kg;
          existing.emissions_t = Number((existing.emissions_kg / 1000).toFixed(2));
        }
      }
      series = Array.from(qMap.values());
    } else if (gran === "year" || gran === "yearly") {
      const yMap = new Map<string, (typeof monthlySeries)[0]>();
      for (const m of monthlySeries) {
        const yKey = m.period.split("-")[0];
        const existing = yMap.get(yKey);
        if (!existing) {
          yMap.set(yKey, {
            ...m,
            period: yKey,
            label: `Year ${yKey}`,
          });
        } else {
          existing.energy_kwh += m.energy_kwh;
          existing.energy_mwh = Number((existing.energy_kwh / 1000).toFixed(2));
          existing.water_kl += m.water_kl;
          existing.water_ml = Number((existing.water_kl / 1000).toFixed(3));
          existing.gas_m3 += m.gas_m3;
          existing.food_kg += m.food_kg;
          existing.emissions_kg += m.emissions_kg;
          existing.emissions_t = Number((existing.emissions_kg / 1000).toFixed(2));
        }
      }
      series = Array.from(yMap.values());
    }

    return {
      organization_id: currentOrgId() ?? null,
      from: periods[0] ?? from,
      to: periods[periods.length - 1] ?? to,
      granularity: gran,
      totals,
      change,
      series,
      meter_coverage,
    };
  }
}
