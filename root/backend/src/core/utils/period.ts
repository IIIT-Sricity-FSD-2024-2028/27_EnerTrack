/**
 * Month-period helpers ("YYYY-MM"), shared by the seed, the sustainability
 * summary and report generation so that "the current period" means the same
 * thing everywhere and is computed from today's date, never a literal.
 *
 * Periods are calendar months in UTC, matching how meter readings are
 * stamped (month-end, UTC) and bucketed (`timestamp.slice(0, 7)`).
 */

/** "YYYY-MM" with a real month (01–12). */
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isPeriod(value: unknown): value is string {
  return typeof value === "string" && PERIOD.test(value);
}

export function toPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Shifts a "YYYY-MM" by n months (n may be negative). */
export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return toPeriod(Math.floor(index / 12), (index % 12) + 1);
}

/**
 * The most recent month that has fully ended. On 2026-11-22 that is
 * "2026-10": November is still in progress, so its readings are incomplete
 * and showing it would read as a drop in consumption.
 */
export function lastFullMonth(now: Date = new Date()): string {
  return addMonths(toPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1), -1);
}

/**
 * The default reporting window: January of the current year up to the last
 * full month. In January, when no month of the new year has ended yet, the
 * window is the whole of the previous year instead.
 */
export function defaultRange(now: Date = new Date()): { from: string; to: string } {
  const to = lastFullMonth(now);
  return { from: `${to.slice(0, 4)}-01`, to };
}

/** Every "YYYY-MM" from `from` to `to`, inclusive. Empty when from > to. */
export function periodsBetween(from: string, to: string): string[] {
  const periods: string[] = [];
  for (let p = from; p <= to; p = addMonths(p, 1)) periods.push(p);
  return periods;
}
