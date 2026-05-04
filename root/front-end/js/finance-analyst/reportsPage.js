/**
 * reportsPage.js
 * Entry-point for the Financial Reports page.
 * Data: fetched from backend /financial-reports and /invoices (DTO), hydrated into universalDB.data.finance
 */

import FinanceDB     from "./data/mockData.js";
import SessionModule from "./modules/session.js";
import ReportModule  from "./modules/reports.js";
import InvoiceModule from "./modules/invoices.js";
import { formatCurrency, can } from "./utils/utils.js";
import universalDB   from "../shared/universalDB.js";

document.addEventListener("DOMContentLoaded", async () => {
  window.FinanceDB = FinanceDB;

  // Hydrate from backend before rendering
  if (window.api) {
    try {
      const [reports, invoices] = await Promise.all([
        window.api.get('/financial-reports').catch(() => null),
        window.api.get('/invoices').catch(() => null)
      ]);
      if (Array.isArray(reports))  universalDB.data.finance.financialReports = reports;
      if (Array.isArray(invoices)) universalDB.data.finance.invoices         = invoices;
    } catch (err) {
      console.warn('[Finance] Backend fetch failed, using local data:', err.message);
    }
  }

  SessionModule.initSession();
  ReportModule.renderReportList();
  InvoiceModule.renderInvoiceList();
  InvoiceModule.updateInvoiceSummary();
  renderMetricCards();
  wireFilters();
  wireButtons();
  wireRoleSwitcher();
  wireNavigation();
  renderViabilityResult();
});


/* ── METRIC CARDS ─────────────────────────────────── */

function renderMetricCards() {
  const reports = FinanceDB.financialReports;
  if (reports.length === 0) return;

  const latest = reports[0];
  _setText("metric-roi",     (latest.roi ?? "—") + "%");
  _setText("metric-npv",     latest.npv != null ? formatCurrency(latest.npv) : "—");
  _setText("metric-payback", latest.paybackYears != null ? latest.paybackYears + " yrs" : "—");
  renderViabilityResult(latest);
}

function renderViabilityResult(rep) {
  const banner = document.getElementById("viability-result");
  if (!banner) return;
  if (!rep) { banner.textContent = "No report data."; return; }

  const map = {
    viable:     { text: "Financially Viable — Recommend Expansion", badge: "ROI ≥ Threshold", color: "#d1fae5", textColor: "#065f46" },
    marginal:   { text: "Marginal Viability — Review Before Proceeding", badge: "ROI Near Threshold", color: "#fef3c7", textColor: "#92400e" },
    "not-viable": { text: "Not Viable — Do Not Proceed", badge: "ROI < Threshold", color: "#fee2e2", textColor: "#b91c1c" }
  };
  const v = map[rep.status] || map.marginal;
  banner.style.background  = v.color;
  banner.style.color       = v.textColor;
  banner.querySelector?.(".badge") && (banner.querySelector(".badge").textContent = v.badge);
  const textNode = banner.childNodes[0];
  if (textNode?.nodeType === 3) textNode.textContent = v.text + " ";
}

/* ── FILTERS ──────────────────────────────────────── */

function wireFilters() {
  const categoryFilter = document.getElementById("report-filter-category");
  const statusFilter   = document.getElementById("report-filter-status");
  const invoiceFilter  = document.getElementById("invoice-filter-status");
  const deptFilter     = document.getElementById("invoice-filter-dept");

  categoryFilter?.addEventListener("change", applyReportFilters);
  statusFilter?.addEventListener("change",   applyReportFilters);
  invoiceFilter?.addEventListener("change",  applyInvoiceFilters);
  deptFilter?.addEventListener("change",     applyInvoiceFilters);
}

function applyReportFilters() {
  const category = document.getElementById("report-filter-category")?.value ?? "all";
  const status   = document.getElementById("report-filter-status")?.value   ?? "all";
  ReportModule.renderReportList({ category, status });
}

function applyInvoiceFilters() {
  const status     = document.getElementById("invoice-filter-status")?.value     ?? "all";
  const department = document.getElementById("invoice-filter-dept")?.value ?? "all";
  InvoiceModule.renderInvoiceList({ status, department });
}

/* ── BUTTONS ──────────────────────────────────────── */

function wireButtons() {
  // Add report
  document.getElementById("btn-add-report")?.addEventListener("click", () => {
    ReportModule.openAddReportModal();
  });

  // Add invoice
  document.getElementById("btn-add-invoice")?.addEventListener("click", () => {
    InvoiceModule.openAddInvoiceModal();
  });

  // Calculate metrics (simulated)
  document.getElementById("btn-calculate")?.addEventListener("click", () => {
    const saving = Number(document.getElementById("calc-saving")?.value ?? 0);
    const budget = Number(document.getElementById("calc-budget")?.value ?? 0);

    if (!saving || saving <= 0) {
      import("./utils/utils.js").then(({ showToast }) => showToast("Enter a valid savings value.", "warning"));
      return;
    }
    if (!budget || budget <= 0) {
      import("./utils/utils.js").then(({ showToast }) => showToast("Enter a valid budget value.", "warning"));
      return;
    }

    const roi     = ((saving / budget) * 100).toFixed(1);
    const npv     = (saving * 3.2 - budget).toFixed(0);   // simplified 3-yr NPV
    const payback = (budget / saving).toFixed(1);

    _setText("metric-roi",     roi + "%");
    _setText("metric-npv",     "₹" + Number(npv).toLocaleString());
    _setText("metric-payback", payback + " yrs");

    const status = roi >= 15 ? "viable" : roi >= 8 ? "marginal" : "not-viable";
    renderViabilityResult({ status, roi: Number(roi), npv: Number(npv) });
    import("./utils/utils.js").then(({ showToast }) => showToast("Metrics calculated.", "success"));
  });
}

/* ── ROLE SWITCHER ────────────────────────────────── */

function wireRoleSwitcher() {
  const switcher = document.getElementById("role-switcher");
  if (!switcher) return;
  switcher.addEventListener("change", e => {
    SessionModule.switchRole(e.target.value);
    ReportModule.renderReportList();
    InvoiceModule.renderInvoiceList();
  });
}

/* ── NAVIGATION ───────────────────────────────────── */

function wireNavigation() {
  document.querySelectorAll(".menu-item[data-page]").forEach(item => {
    item.addEventListener("click", () => { window.location.href = item.dataset.page; });
  });
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
