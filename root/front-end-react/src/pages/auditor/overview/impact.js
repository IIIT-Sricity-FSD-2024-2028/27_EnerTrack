/**
 * impact.js — who goes in "Did it work?", and which months each is judged on.
 *
 * The order the workflow runs in is audit → proposal accepted → measures
 * implemented → savings measured. So a client is measured from the month
 * after their first measure went in, up to the last full month, against
 * the same months a year earlier. A measure cannot be credited with months
 * from before it existed.
 *
 * The backend compares only months that have readings in both years, so a
 * window running past the latest readings is safe: the extra months are
 * skipped rather than read as savings.
 *
 * Plain functions, no React.
 */

/** "2026-02-24" -> "2026-03" */
function monthAfter(isoDate) {
  const [year, month] = isoDate.split("-").map(Number);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** The last complete calendar month before `today`, as "YYYY-MM". */
function lastFullMonth(today) {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-based, so this is already last month
  return month === 0
    ? `${year - 1}-12`
    : `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * One entry per client with an accepted proposal:
 *   { organization_id, done, firstImplemented, window }
 * `window` is { from, to }, or null when there is nothing to measure yet
 * (nothing implemented, or implemented too recently for a full month).
 */
export function impactClients(audits, today = new Date()) {
  const byOrg = new Map();

  for (const audit of audits) {
    if (audit.status !== "accepted") continue;

    const id = audit.organization_id;
    if (!byOrg.has(id)) {
      byOrg.set(id, { organization_id: id, done: 0, firstImplemented: null });
    }
    const client = byOrg.get(id);

    for (const finding of audit.findings || []) {
      if (finding.status !== "implemented") continue;
      client.done++;
      const on = finding.implemented_on;
      if (on && (!client.firstImplemented || on < client.firstImplemented)) {
        client.firstImplemented = on;
      }
    }
  }

  const lastMonth = lastFullMonth(today);
  return [...byOrg.values()].map((client) => {
    let window = null;
    if (client.firstImplemented) {
      const from = monthAfter(client.firstImplemented);
      if (from <= lastMonth) window = { from, to: lastMonth };
    }
    return { ...client, window };
  });
}

/** The month a client's first measure starts being measured from. */
export function measurableFrom(client) {
  return client.firstImplemented ? monthAfter(client.firstImplemented) : null;
}

/** True when a client's savings call returned a real comparison. */
export function hasComparison(client) {
  return Boolean(client.savings && client.savings.has_comparison);
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/** "2026-03" -> "Mar 2026" */
export function formatPeriod(period) {
  const [year, month] = period.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/** "2026-03", "2026-08" -> "Mar–Aug 2026"; across years "Nov 2025–Feb 2026". */
export function formatPeriodRange(from, to) {
  if (from === to) return formatPeriod(from);
  const [fromYear] = from.split("-");
  const [toYear] = to.split("-");
  if (fromYear === toYear) {
    return `${formatPeriod(from).split(" ")[0]}–${formatPeriod(to)}`;
  }
  return `${formatPeriod(from)}–${formatPeriod(to)}`;
}
