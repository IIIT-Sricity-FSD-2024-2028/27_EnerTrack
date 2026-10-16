/**
 * auditorUtils.js — small helpers shared by the auditor pages.
 *
 * Ported from front-end/js/auditor/utils/utils.js. escapeHtml() is gone:
 * React escapes text on its own. The session check, toast and modal
 * helpers are gone too — RequireRole, useToast and Modal replace them.
 */

/** 125000 -> "₹1,25,000" */
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

/** 12345.6 -> "12,346" */
export function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(Math.round(Number(value || 0)));
}

/** 12345 -> "12,345 kWh" */
export function formatKwh(value) {
  return formatNumber(value) + " kWh";
}

/** "2026-07-14" -> "14 Jul 2026". Empty -> "—". */
export function formatDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "in-progress" -> "In Progress" */
export function label(value) {
  const words = String(value ?? "").split("-");
  const capitalised = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1),
  );
  return capitalised.join(" ");
}

/**
 * Which .badge colour (from tech_shared.css) a status or severity uses.
 * Unknown values fall back to "open".
 */
const BADGE_CLASS = {
  // Audit statuses (proposed and accepted are shared with findings)
  scheduled: "new",
  "in-progress": "inprogress",
  "changes-requested": "review",
  declined: "critical",
  // Audit request statuses
  pending: "review",
  approved: "resolved",
  denied: "critical",
  // Finding statuses
  proposed: "new",
  accepted: "inprogress",
  implemented: "resolved",
  rejected: "critical",
  // Severities
  high: "critical",
  moderate: "moderate",
  low: "low",
};

export function badgeClass(status) {
  return BADGE_CLASS[status] || "open";
}
