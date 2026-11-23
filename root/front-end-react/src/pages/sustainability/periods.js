/**
 * Month-period helpers ("YYYY-MM") for the Sustainability Officer pages.
 *
 * Mirrors backend/src/core/utils/period.ts so the browser and the server
 * agree on what "last month" and "year to date" mean. Everything is derived
 * from today's date: no page should carry a literal year or month.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toPeriod(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Shifts a "YYYY-MM" by n months (n may be negative). */
export function addMonths(period, n) {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return toPeriod(Math.floor(index / 12), (index % 12) + 1);
}

/** The most recent month that has fully ended (UTC, like the readings). */
export function lastFullMonth(now = new Date()) {
  return addMonths(toPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1), -1);
}

/** "2026-10" → "Oct 2026". */
export function periodLabel(period) {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Aug–Oct 2026", or "Nov 2025–Jan 2026" across a year boundary. */
export function rangeLabel(from, to) {
  if (from === to) return periodLabel(from);
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (fy === ty) return `${MONTHS[fm - 1]}–${MONTHS[tm - 1]} ${ty}`;
  return `${periodLabel(from)}–${periodLabel(to)}`;
}

/**
 * The three windows the Monitoring page offers, built for today's date.
 * Year to date runs from January of the last full month's year, so in
 * January it shows the whole of the year just ended rather than nothing.
 */
export function monitoringPeriods(now = new Date()) {
  const last = lastFullMonth(now);
  const quarterFrom = addMonths(last, -2);
  const yearFrom = `${last.slice(0, 4)}-01`;
  return {
    month: { name: "Last month", from: last, to: last, label: `Last month (${periodLabel(last)})` },
    quarter: {
      name: "Last 3 months",
      from: quarterFrom,
      to: last,
      label: `Last 3 months (${rangeLabel(quarterFrom, last)})`,
    },
    year: { name: "Year to date", from: yearFrom, to: last, label: `Year to date (${rangeLabel(yearFrom, last)})` },
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthName(period) {
  const [y, m] = String(period).split("-").map(Number);
  return MONTH_NAMES[m - 1] ? `${MONTH_NAMES[m - 1]} ${y}` : String(period);
}

/** "October 2026", "August to October 2026", "2025", "November 2025 to January 2026". */
export function periodName(from, to) {
  if (!from) return "";
  if (!to || from === to) return monthName(from);
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (fy === ty && fm === 1 && tm === 12) return String(fy);
  if (fy === ty) return `${MONTH_NAMES[fm - 1]} to ${MONTH_NAMES[tm - 1]} ${ty}`;
  return `${monthName(from)} to ${monthName(to)}`;
}
