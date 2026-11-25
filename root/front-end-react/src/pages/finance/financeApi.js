/**
 * financeApi.js
 * Turns backend rows into the shape the Financial Analyst pages use.
 *
 * The backend sends snake_case rows ({ energy_cost_id, scope_label, ... }).
 * The pages work with the camelCase shape the original front end used
 * ({ id, scopeLabel, ... }), so each "normalize" function converts one row.
 * The finance slices (store/slices/energyCostsSlice, financialReportsSlice,
 * invoicesSlice) keep the raw rows and call these in their selectors.
 */
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
