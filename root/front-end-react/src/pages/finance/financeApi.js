/**
 * financeApi.js
 * Turns backend rows into the shape the Financial Analyst pages use.
 *
 * The backend sends snake_case rows ({ energy_cost_id, scope_label, ... }).
 * The pages work with the camelCase shape the original front end used
 * ({ id, scopeLabel, ... }), so each "normalize" function converts one row.
 * The finance slices (store/slices/energyCostsSlice, financialReportsSlice,
 * invoicesSlice) keep the raw rows and call these in their selectors.
 *
 * The wastage functions at the bottom still call the API themselves. They
 * belong to the wastage workflow (Person 5) and move to wastageReportsSlice
 * with it; the finance and sustainability pages import them from here until
 * then.
 */
import api from "../../api/client";
import { statusFromRoi, statusFromVariance } from "./financeUtils";

/* ── ENERGY COSTS ─────────────────────────────────── */

export function normalizeCost(rec, names = {}) {
  const electricity = Number(rec.electricity) || 0;
  const gas = Number(rec.gas) || 0;
  const water = Number(rec.water) || 0;
  const wastewater = Number(rec.wastewater) || 0;
  const demand = Number(rec.demand) || 0;
  const total = electricity + gas + water + wastewater + demand;
  // No budget stays 0: it is not the same as "exactly on budget".
  const budget = Number(rec.budget) > 0 ? Number(rec.budget) : 0;
  const variance = budget > 0 ? budget - total : 0;

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
    status: statusFromVariance(variance, budget),
  };
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

/* ── WASTAGE REPORTS (Sustainability workflow) ────── */

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
    // The backend keeps the time it was reported inside details.
    timestamp: r.created_at || r.timestamp || d.timestamp || new Date().toISOString(),
    validatedAt: d.validatedAt || r.validatedAt,
    revisionRequest: d.revisionRequest || r.revisionRequest,
    returnedAt: d.returnedAt || r.returnedAt,
    // The waste reports a case grew out of.
    sourceRequestIds: r.source_request_ids || [],
    details: d,
  };
}

export async function loadWastageReports(user) {
  const rows = await api.get("/wastage-reports");
  return (Array.isArray(rows) ? rows : []).map((r) => normalizeWastageReport(r, user));
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

  // The server decides whether the move is allowed (403 otherwise) and is the
  // only record; if it cannot be reached the error goes to the caller rather
  // than the change being kept in this browser and shown as saved.
  await api.patch(`/wastage-reports/${report.id}`, {
    status: status || report.status,
    details,
  });
  return updated;
}

/**
 * Adds one comment to a wastage report through POST /wastage-reports/:id/comments.
 * The server appends it to the list itself, so a comment someone else posted
 * in the meantime (e.g. the occupant) is never overwritten, which re-sending
 * the whole list in a PATCH could do. The server records the role from the
 * signed-in token. Returns the report with its new comment list; throws if
 * the server refuses or cannot be reached (nothing is kept locally).
 */
export async function addWastageComment(report, { author, text }) {
  const saved = await api.post(`/wastage-reports/${report.id}/comments`, { author, text });
  const details = saved?.details || report.details;
  return { ...report, details, comments: details.comments || [] };
}
