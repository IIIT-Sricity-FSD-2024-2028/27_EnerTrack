import { DatabaseService } from "../database/database.service";

/**
 * Like-for-like comparison of monthly meter readings, shared by the savings
 * report (organizations.service.ts), sustainability targets and, later,
 * initiative measurement.
 *
 * A month only counts when it has readings on both sides. A month not yet
 * reported this year (or a meter that went silent) would otherwise read as a
 * 100% saving.
 */

/** A value for one "YYYY-MM": a sum of readings, or a weighted mix of them. */
export type Measure = (period: string) => number;

/** Total of all readings on a set of meters during one "YYYY-MM". */
export function sumIn(
  database: DatabaseService,
  meterIds: string[],
  period: string,
): number {
  if (meterIds.length === 0) return 0;
  return database.meterReadings
    .filter(
      (r) =>
        meterIds.includes(r.meter_id) &&
        typeof r.timestamp === "string" &&
        r.timestamp.slice(0, 7) === period,
    )
    .reduce((sum, r) => sum + Number(r.value || 0), 0);
}

/** A Measure that sums a set of meters. */
export function meterSum(database: DatabaseService, meterIds: string[]): Measure {
  return (period) => sumIn(database, meterIds, period);
}

export function oneYearEarlier(period: string): string {
  const [year, month] = period.split("-");
  return `${Number(year) - 1}-${month}`;
}

export interface MonthComparison {
  period: string;
  baseline_period: string;
  current: number;
  baseline: number;
  /** True only when both sides have readings. */
  compared: boolean;
}

export interface Comparison {
  months: MonthComparison[];
  months_compared: number;
  /** Sums over the compared months only. */
  current: number;
  baseline: number;
  /** (current − baseline) / baseline × 100, one decimal; 0 with no baseline. */
  change_pct: number;
}

/**
 * Compares each current month with a baseline month, given as pairs
 * [current, baseline]. Values are rounded per month, as the savings report
 * has always done.
 */
export function compareMonths(measure: Measure, pairs: [string, string][]): Comparison {
  const months = pairs.map(([period, baselinePeriod]) => {
    const current = Math.round(measure(period));
    const baseline = Math.round(measure(baselinePeriod));
    return {
      period,
      baseline_period: baselinePeriod,
      current,
      baseline,
      compared: current > 0 && baseline > 0,
    };
  });
  const compared = months.filter((m) => m.compared);
  const current = compared.reduce((sum, m) => sum + m.current, 0);
  const baseline = compared.reduce((sum, m) => sum + m.baseline, 0);
  return {
    months,
    months_compared: compared.length,
    current,
    baseline,
    change_pct: baseline > 0 ? Number((((current - baseline) / baseline) * 100).toFixed(1)) : 0,
  };
}

/** Each month against the same month a year earlier. */
export function compareYoY(measure: Measure, periods: string[]): Comparison {
  return compareMonths(measure, periods.map((p) => [p, oneYearEarlier(p)]));
}
