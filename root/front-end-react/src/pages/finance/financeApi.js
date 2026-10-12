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

function isNetworkError(error) {
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

/* ── DELETING ─────────────────────────────────────── */

/*
 * The backend only lets an Organization Admin DELETE energy costs, financial
 * reports and invoices. For any other role (the Financial Analyst) we do not
 * send a request the server will refuse. Instead the deleted record's id is
 * remembered in localStorage and the loaders below leave it out of the list.
 * Note: the record still exists on the server for other users.
 */
const DELETED_KEY = "enertrack_finance_deleted";

function readDeletedIds() {
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY)) || {};
  } catch {
    return {};
  }
}

/** Drops the rows whose id was deleted locally. `kind` is e.g. "invoices". */
function withoutDeleted(kind, rows, idField) {
  const deleted = readDeletedIds()[kind] || [];
  return rows.filter((row) => !deleted.includes(row[idField] || row.id));
}

/**
 * Deletes one record. Organization Admin → real DELETE on the server.
 * Anyone else → hidden locally (see above). Throws if the real DELETE fails.
 */
export async function deleteRecord(kind, path, id, role) {
  if (role === "Organization Admin") {
    await api.delete(`${path}/${id}`);
    return;
  }
  const deleted = readDeletedIds();
  deleted[kind] = [...(deleted[kind] || []), id];
  localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
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
  const visible = withoutDeleted("energyCosts", rows, "energy_cost_id");
  return { costs: visible.map((r) => normalizeCost(r, names)), offline };
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
  const visible = withoutDeleted("financialReports", rows, "financial_report_id");
  return { reports: visible.map(normalizeReport), offline };
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
    status: inv.status || "pending",
    approvedBy: inv.approvedBy || inv.approved_by_id || null,
    archived: inv.archived === true || inv.archived === "true",
  };
}

export async function loadInvoices() {
  const { rows, offline } = await getList("/invoices", universalDB.data.finance.invoices);
  const visible = withoutDeleted("invoices", rows, "invoice_id");
  return { invoices: visible.map(normalizeInvoice), offline };
}

/* ── WASTAGE REPORTS (Sustainability workflow) ────── */

/*
 * The backend only lets a Sustainability Officer or Organization Admin PATCH
 * a wastage report. The original page therefore fell back to saving the
 * Financial Analyst's changes (cost impact, comments, "returned") in
 * localStorage. We keep that behaviour: local changes live in
 * universalDB.data.workflow.wastageReports and are laid over the API rows.
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
  const { rows } = await getList("/wastage-reports", []);
  const reports = rows.map((r) => normalizeWastageReport(r, user));

  // Lay the locally saved Financial Analyst changes over the API rows.
  const local = localWastageReports();
  const merged = reports.map((r) => {
    const saved = local.find((l) => l.id === r.id);
    return saved ? { ...r, ...saved } : r;
  });
  // Reports that only exist locally (backend offline) are kept too.
  local.forEach((l) => {
    if (!merged.some((r) => r.id === l.id)) merged.push(normalizeWastageReport(l, user));
  });
  return merged;
}

/**
 * Saves changes to one wastage report. `changes` holds the new status and
 * the fields that live inside `details` (costImpact, comments, returnedAt).
 */
export async function updateWastageReport(report, changes, role) {
  // Only these roles may PATCH a wastage report on the backend, so a
  // Financial Analyst's change is saved locally without a doomed request.
  if (role === "Sustainability Officer" || role === "Organization Admin") {
    const { status, ...detailChanges } = changes;
    try {
      await api.patch(`/wastage-reports/${report.id}`, {
        status: status || report.status,
        details: { ...report.details, ...detailChanges },
      });
    } catch (error) {
      console.warn("[Finance] Wastage update failed, saving locally.", error.message);
    }
  }

  // Always keep the local copy as well — it is what the Archives page and
  // the overlay above read when the backend refuses the update.
  const updated = { ...report, ...changes };
  const others = localWastageReports().filter((r) => r.id !== report.id);
  universalDB.data.workflow.wastageReports = [...others, updated];
  universalDB.save();
  return updated;
}
