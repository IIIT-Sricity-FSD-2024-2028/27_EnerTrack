import {
  DatabaseService,
  MeterStatus,
  MeterType,
  TargetMetric,
} from "../database/database.service";
import { GAS_CO2_KG_PER_M3, GRID_CO2_KG_PER_KWH } from "../../modules/organizations/organizations.service";
import { Measure, meterSum } from "./period-compare";

/** Display name and unit for each measurable metric. */
export const METRIC_INFO: Record<TargetMetric, { name: string; unit: string }> = {
  [TargetMetric.ENERGY_KWH]: { name: "electricity", unit: "kWh" },
  [TargetMetric.WATER_KL]: { name: "water", unit: "kL" },
  [TargetMetric.GAS_M3]: { name: "natural gas", unit: "m³" },
  [TargetMetric.EMISSIONS_KG]: { name: "emissions", unit: "kg CO₂e" },
};

/**
 * How a metric is measured for a scope: which live meters, and a monthly
 * Measure over them. Shared by targets and initiative measurement.
 *
 * - explicit meter_ids win (filtered to the right type);
 * - otherwise every live meter of the metric's type in the buildings;
 * - no buildings means the whole organisation.
 * Emissions combine grid electricity (Scope 2) and gas (Scope 1).
 */
export function metricMeasure(
  database: DatabaseService,
  opts: { organizationId: string; metric: TargetMetric; buildingIds?: string[]; meterIds?: string[] },
): { measure: Measure; meterIds: string[] } {
  const pick = (type: MeterType) =>
    database.meters
      .filter(
        (m) =>
          m.organization_id === opts.organizationId &&
          m.meter_type === type &&
          m.status !== MeterStatus.DECOMMISSIONED &&
          (opts.meterIds?.length
            ? opts.meterIds.includes(m.meter_id)
            : !opts.buildingIds?.length || opts.buildingIds.includes(m.building_id)),
      )
      .map((m) => m.meter_id);

  if (opts.metric === TargetMetric.EMISSIONS_KG) {
    const elec = pick(MeterType.ELECTRICITY);
    const gas = pick(MeterType.GAS);
    const e = meterSum(database, elec);
    const g = meterSum(database, gas);
    return {
      measure: (p) => e(p) * GRID_CO2_KG_PER_KWH + g(p) * GAS_CO2_KG_PER_M3,
      meterIds: [...elec, ...gas],
    };
  }
  const type = {
    [TargetMetric.ENERGY_KWH]: MeterType.ELECTRICITY,
    [TargetMetric.WATER_KL]: MeterType.WATER,
    [TargetMetric.GAS_M3]: MeterType.GAS,
  }[opts.metric];
  const ids = pick(type);
  return { measure: meterSum(database, ids), meterIds: ids };
}
