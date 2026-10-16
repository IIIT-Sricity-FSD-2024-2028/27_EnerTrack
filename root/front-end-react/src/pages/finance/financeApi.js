/**
 * financeApi.js
 * Every backend call the Financial Analyst pages make goes through here.
 *
 * The backend sends snake_case rows ({ energy_cost_id, scope_label, ... }).
 * The pages work with the camelCase shape the original front end used
 * ({ id, scopeLabel, ... }), so each "normalize" function converts one row.
 *
 * Offline fallback: if the backend is not running, the loaders return the
 * demo data stored in universalDB (localStorage) instead, exactly like the
 * original pages did. They report this with `offline: true` so a page knows
 * to save its changes locally rather than calling the API.
 */
import api from "../../api/client";
import universalDB from "../../legacy/universalDB";
import { statusFromRoi, statusFromVariance } from "./financeUtils";

/* ── OFFLINE HELPERS ──────────────────────────────── */

export function isNetworkError(error) {
  return String(error?.message || "").startsWith("Cannot reach server");
}

/**
 * GETs a list from the API. When the server cannot be reached it returns
 * `localRows` instead. Any other error (e.g. 403) is passed on to the page.
 */
async function getList(path, localRows) {
  try {
    const rows = await api.get(path);
    return { rows: Array.isArray(rows) ? rows : [], offline: false };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    console.warn(`[Finance] ${path} unavailable, using local data.`);
    return { rows: localRows || [], offline: true };
  }
}

/** Saves a finance list (energyCosts, invoices, ...) to localStorage. */
export function saveLocalFinance(key, rows) {
  universalDB.data.finance[key] = rows;
  universalDB.save();
}

/* ── DEPARTMENTS & BUILDINGS ──────────────────────── */

// The local demo data uses short ids ("dept-001") but the backend expects
// UUIDs, so the original pages translated them with these two maps.
const DEPT_UUID = {
  "dept-001": "dddd0000-0001-4000-8000-000000000000",
  "dept-002": "dddd0000-0002-4000-8000-000000000000",
  "dept-003": "dddd0000-0003-4000-8000-000000000000",
  "dept-004": "dddd0000-0004-4000-8000-000000000000",
  "dept-005": "dddd0000-0005-4000-8000-000000000000",
};
const BLDG_UUID = {
  "bldg-001": "660e8800-0001-4000-8000-000000000000",
  "bldg-002": "660e8800-0002-4000-8000-000000000000",
  "bldg-003": "660e8800-0003-4000-8000-000000000000",
};

/** Returns { departments: [{id, name}], buildings: [{id, name}] }. */
export async function loadDepartmentsAndBuildings() {
  const local = universalDB.data.finance;
  const [depts, bldgs] = await Promise.all([
    getList(
      "/departments",
      local.departments.map((d) => ({ department_id: DEPT_UUID[d.id], name: d.name })),
    ).catch(() => ({ rows: [] })),
    getList(
      "/buildings",
      local.buildings.map((b) => ({ building_id: BLDG_UUID[b.id], name: b.name })),
    ).catch(() => ({ rows: [] })),
  ]);
  return {
    departments: depts.rows.map((d) => ({ id: d.department_id, name: d.name })),
    buildings: bldgs.rows.map((b) => ({ id: b.building_id, name: b.name })),
  };
}

/* ── ENERGY COSTS ─────────────────────────────────── */

export function normalizeCost(rec, names = {}) {
  const electricity = Number(rec.electricity) || 0;
  const gas = Number(rec.gas) || 0;
  const water = Number(rec.water) || 0;
  const wastewater = Number(rec.wastewater) || 0;
  const demand = Number(rec.demand) || 0;
  const total = electricity + gas + water + wastewater + demand;
  const budget = Number(rec.budget) > 0 ? Number(rec.budget) : total;
  const variance = budget - total;

  const scope = rec.scope || (rec.department_id ? "department" : "building");
  const scopeRef = rec.scopeRef || rec.department_id || rec.building_id || "";
  const scopeLabel =
    rec.scope_label ||
    rec.scopeLabel ||
    names[scopeRef] ||
    (scope === "department" ? "Department " : "Building ") + scopeRef.slice(0, 8);

  return {
    id: rec.energy_cost_id || rec.id,
    period: rec.period || "—",
    scope,
    scopeRef,
    scopeLabel,
    electricity,
    gas,
    water,
    wastewater,
    demand,
    total,
    budget,
    variance,
    status: statusFromVariance(variance),
  };
}

export async function loadEnergyCosts() {
  const [{ rows, offline }, places] = await Promise.all([
    getList("/energy-costs", universalDB.data.finance.energyCosts),
    loadDepartmentsAndBuildings(),
  ]);
  // id → name lookup, so a record without a stored label still shows a name
  const names = {};
  [...places.departments, ...places.buildings].forEach((p) => (names[p.id] = p.name));
  return { costs: rows.map((r) => normalizeCost(r, names)), offline };
}

/* ── FINANCIAL REPORTS ────────────────────────────── */

export function normalizeReport(rep) {
  const roi = rep.roi != null && rep.roi !== "" ? parseFloat(String(rep.roi).replace("%", "")) : null;
  const scopeLabel =
    rep.scope_label ||
    rep.scopeLabel ||
    (rep.department_id
      ? "Department (" + rep.department_id.slice(-8) + ")"
      : rep.building_id
        ? "Building (" + rep.building_id.slice(-8) + ")"
        : "Campus");

  return {
    id: rep.financial_report_id || rep.id,
    title: rep.title || "Untitled Report",
    period: rep.period || "—",
    category: rep.category || "energy",
    scopeLabel,
    generatedAt: rep.generated_at || rep.generatedAt || new Date().toISOString(),
    generatedBy: rep.generatedBy || rep.generated_by_id || "System",
    format: rep.format || "PDF",
    roi: isNaN(roi) ? null : roi,
    npv: rep.npv != null && rep.npv !== "" ? Number(rep.npv) : null,
    paybackYears:
      rep.payback_years != null
        ? Number(rep.payback_years)
        : rep.paybackYears != null
          ? Number(rep.paybackYears)
          : null,
    status: rep.status || statusFromRoi(roi),
    notes: rep.notes || "",
    archived: rep.archived === true || rep.archived === "true",
  };
}

export async function loadReports() {
  const { rows, offline } = await getList(
    "/financial-reports",
    universalDB.data.finance.financialReports,
  );
  return { reports: rows.map(normalizeReport), offline };
}

/* ── INVOICES ─────────────────────────────────────── */

export function normalizeInvoice(inv) {
  return {
    id: inv.invoice_id || inv.id,
    invoiceNumber: inv.invoice_number || inv.invoiceNumber || "—",
    vendor: inv.vendor || "—",
    amount: Number(inv.amount) || 0,
    department: inv.department_id || inv.department || "",
    departmentLabel:
      inv.department_label ||
      inv.departmentLabel ||
      (inv.department_id ? "Department " + inv.department_id.slice(0, 8) : "—"),
    type: inv.type || "utility",
    dueDate: inv.due_date || inv.dueDate || null,
    issuedDate: inv.issued_date || inv.issuedDate || null,
    // The Financial Analyst creates invoices, so there is no separate approval
    // step: older invoices saved as "approved" are shown as "paid".
    status: inv.status === "approved" ? "paid" : inv.status || "pending",
    // Name of the attached PDF (set by POST /invoices/:id/document), or null.
    documentName: inv.document_original_name || inv.documentName || null,
    archived: inv.archived === true || inv.archived === "true",
  };
}

export async function loadInvoices() {
  const { rows, offline } = await getList("/invoices", universalDB.data.finance.invoices);
  return { invoices: rows.map(normalizeInvoice), offline };
}

/* ── WASTAGE REPORTS (Sustainability workflow) ────── */

/*
 * The backend is the source of truth for wastage reports. Local copies in
 * universalDB.data.workflow.wastageReports are only used when the backend
 * cannot be reached (offline demo mode).
 */
function localWastageReports() {
  return universalDB.data.workflow.wastageReports || [];
}

export function normalizeWastageReport(r, user) {
  const d = r.details || {};
  const isMine = user && r.reporter_id === user.user_id;
  return {
    id: r.wastage_report_id || r.id,
    type: r.type,
    status: r.status,
    reporterId: r.reporter_id,
    reporterName: isMine ? user.name : r.reporterName || "Unknown",
    specificData: d.specificData || r.specificData || {},
    systemData: d.systemData || r.systemData || {},
    costImpact: d.costImpact || r.costImpact || null,
    metricTarget: d.metricTarget || r.metricTarget || null,
    priority: d.priority || r.priority || "Low",
    comments: d.comments || r.comments || [],
    timestamp: r.created_at || r.timestamp || new Date().toISOString(),
    validatedAt: d.validatedAt || r.validatedAt,
    revisionRequest: d.revisionRequest || r.revisionRequest,
    returnedAt: d.returnedAt || r.returnedAt,
    details: d,
  };
}

export async function loadWastageReports(user) {
  // Server rows when the backend is up; the local copies only when offline.
  const { rows } = await getList("/wastage-reports", localWastageReports());
  return rows.map((r) => normalizeWastageReport(r, user));
}

/**
 * Saves changes to one wastage report. `changes` holds the new status and
 * the fields that live inside `details` (costImpact, comments, returnedAt).
 * Throws if the server refuses, so the page can show an error.
 */
export async function updateWastageReport(report, changes) {
  const { status, ...detailChanges } = changes;
  // The backend replaces `details` with what we send, so send all of it.
  const details = { ...report.details, ...detailChanges };
  const updated = { ...report, ...changes, details };

  try {
    await api.patch(`/wastage-reports/${report.id}`, {
      status: status || report.status,
      details,
    });
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    // Backend not running → keep the change locally (offline demo mode).
    const others = localWastageReports().filter((r) => r.id !== report.id);
    universalDB.data.workflow.wastageReports = [...others, updated];
    universalDB.save();
  }
  return updated;
}

/**
 * Adds one comment to a wastage report through POST /wastage-reports/:id/comments.
 * The server appends it to the list itself, so a comment someone else posted
 * in the meantime (e.g. the occupant) is never overwritten, which re-sending
 * the whole list in a PATCH could do. The server records the role from the
 * x-role header. Offline, the comment is kept locally instead.
 * Returns the report with its new comment list; throws if the server refuses.
 */
export async function addWastageComment(report, { author, role, text }) {
  try {
    const saved = await api.post(`/wastage-reports/${report.id}/comments`, { author, text });
    const details = saved?.details || report.details;
    return { ...report, details, comments: details.comments || [] };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const comment = { author, role, text, timestamp: new Date().toISOString() };
    return updateWastageReport(report, { comments: [...(report.comments || []), comment] });
  }
}
