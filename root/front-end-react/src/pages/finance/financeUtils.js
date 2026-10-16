/**
 * financeUtils.js
 * Small helpers shared by every Financial Analyst page.
 * Ported from front-end/js/finance-analyst/utils/utils.js — the DOM parts
 * (toast, modal, field errors) became React components instead.
 */

/* ── FORMATTERS ───────────────────────────────────── */

export function formatCurrency(value) {
  if (value == null || value === "" || isNaN(value)) return "—";
  return "₹" + Number(value).toLocaleString("en-IN");
}

/** "Mar 15, 2025" style — used in tables and view modals. */
export function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "15 Mar 2025, 10:30" style — used on the wastage report cards. */
export function formatDateTime(isoString, withYear = true) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Newest period string ("2025-03") found in a list of cost records. */
export function latestPeriod(costs) {
  const periods = [...new Set(costs.map((c) => c.period))].sort().reverse();
  return periods[0];
}

/** "2025-03" → "Mar 2025"; anything else (e.g. "2025-Q1") is shown as is. */
export function periodLabel(period) {
  const m = /^(\d{4})-(\d{2})$/.exec(period || "");
  if (!m) return period || "";
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Budget minus total decides the status badge of a cost record. */
export function statusFromVariance(variance) {
  if (variance > 0) return "under-budget";
  if (variance === 0) return "on-budget";
  return "over-budget";
}

/** ROI decides whether a report is viable (same thresholds as the original). */
export function statusFromRoi(roi) {
  if (roi == null) return "marginal";
  if (roi >= 15) return "viable";
  if (roi >= 8) return "marginal";
  return "not-viable";
}

/* ── WASTAGE REPORT HELPERS ───────────────────────── */

/**
 * Short, readable reference for a wastage report ("WR-3N2A8Z"), the same on
 * every role's screen. The seed ids share their first and last segments
 * ("wwww0000-0001-…-000000000000"), so slicing the uuid would give several
 * reports the same label; a small hash of the whole id does not.
 */
export function reportRef(id) {
  if (!id) return "UNKNOWN";
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

/** The user's own words and location, which live in different fields per type. */
export function wastageSummary(report) {
  const spec = report.specificData || {};
  if (report.type === "Water") return { summary: spec.nature, location: spec.location };
  if (report.type === "Emissions") return { summary: spec.observation, location: spec.location };
  if (report.type === "Food")
    return {
      summary: `${spec.typeOfWastage || "—"} (~${spec.estimatedAmount || "?"}kg)`,
      location: spec.cafeteria,
    };
  return { summary: spec.observation, location: spec.building }; // Energy
}

/** Heading of the sensor panel, e.g. "Flow Monitoring" for water. */
export function sensorTitle(type) {
  if (type === "Food") return "Wastage Assessment";
  if (type === "Water") return "Flow Monitoring";
  if (type === "Emissions") return "Emissions Monitoring";
  return "Energy Meter Reading";
}

/* ── VALIDATION ───────────────────────────────────── */

/**
 * Checks one value against rules like { required, minLength, pattern, ... }.
 * Returns an error message, or "" when the value is valid.
 */
export function validateField(value, rules = {}) {
  const v = (value ?? "").toString().trim();

  if (rules.required && v === "") return "This field is required.";
  if (v === "") return ""; // empty optional field → nothing else to check

  if (rules.minLength && v.length < rules.minLength)
    return `Minimum ${rules.minLength} characters required.`;
  if (rules.maxLength && v.length > rules.maxLength)
    return `Maximum ${rules.maxLength} characters allowed.`;
  if (rules.pattern && !rules.pattern.test(v))
    return rules.patternMsg || "Invalid format.";
  if (rules.positiveNumber && (isNaN(Number(v)) || Number(v) <= 0))
    return "Must be a positive number.";
  if (rules.min !== undefined && Number(v) < rules.min)
    return `Minimum value is ${rules.min}.`;
  return "";
}

/**
 * Validates a whole form. `values` is the form state object and `rules`
 * maps each field name to its rules. Returns { fieldName: message } for
 * every invalid field — an empty object means the form is valid.
 */
export function validateForm(values, rules) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(rules)) {
    const message = validateField(values[field], fieldRules);
    if (message) errors[field] = message;
  }
  return errors;
}

export const PERIOD_RULE = {
  required: true,
  pattern: /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/,
  patternMsg: "Format must be YYYY-MM or YYYY-Q1 to YYYY-Q4.",
};

/* ── PERMISSIONS ──────────────────────────────────── */

const PERMISSIONS = {
  superuser: ["view", "create", "edit", "delete", "approve", "export"],
  finance_analyst: ["view", "create", "edit", "delete", "approve", "export"],
  enduser: ["view", "export"],
};

/** Same role → permission mapping as the original session.js. */
export function can(role, action) {
  let key = "finance_analyst";
  if (role === "Organization Admin") key = "superuser";
  if (["Technician", "Sustainability Officer", "Campus Visitor"].includes(role))
    key = "enduser";
  return PERMISSIONS[key].includes(action);
}
