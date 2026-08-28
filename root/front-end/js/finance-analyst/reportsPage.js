/**
 * reportsPage.js
 * Entry-point for the Financial Reports page.
 * Data: fetched from backend /financial-reports and /invoices (DTO), hydrated into universalDB.data.finance
 */

import FinanceDB from "./data/mockData.js";
import SessionModule from "./modules/session.js";
import ReportModule from "./modules/reports.js";
import InvoiceModule from "./modules/invoices.js";
import { formatCurrency, can } from "./utils/utils.js";
import universalDB from "../shared/universalDB.js";

document.addEventListener("DOMContentLoaded", async () => {
  window.FinanceDB = FinanceDB;

  // Hydrate from backend before rendering
  if (window.api) {
    try {
      const [reports, invoices] = await Promise.all([
        window.api.get("/financial-reports").catch(() => null),
        window.api.get("/invoices").catch(() => null),
      ]);

      // ── Normalize Financial Reports ─────────────────────────────────────
      // Backend sends: { financial_report_id, title, period, roi (string), npv,
      //   building_id, department_id, generated_by_id }
      // Frontend needs: { id, title, period, category, scopeLabel, roi (number),
      //   npv, paybackYears, status, format, generatedBy, notes }
      if (Array.isArray(reports)) {
        universalDB.data.finance.financialReports = reports.map((rep) => {
          // Parse ROI — backend stores as "15%" string or number
          const roiRaw = rep.roi;
          const roiNum = roiRaw != null
            ? parseFloat(String(roiRaw).replace("%", ""))
            : null;
          // Derive viability status from ROI
          const status = roiNum == null ? "marginal"
            : roiNum >= 15 ? "viable"
            : roiNum >= 8  ? "marginal"
            : "not-viable";
          // Derive scopeLabel from available IDs
          const scopeLabel = rep.department_id
            ? "Department (" + rep.department_id.slice(-8) + ")"
            : rep.building_id
            ? "Building (" + rep.building_id.slice(-8) + ")"
            : "Campus";

          return {
            id:           rep.financial_report_id || rep.id,
            title:        rep.title || "Untitled Report",
            period:       rep.period || "—",
            category:     rep.category || "energy",
            scope:        rep.scope || (rep.department_id ? "department" : rep.building_id ? "building" : "campus"),
            scopeLabel:   rep.scope_label || rep.scopeLabel || scopeLabel,
            generatedAt:  rep.generated_at || rep.generatedAt || new Date().toISOString(),
            generatedBy:  rep.generated_by_id || rep.generatedBy || "System",
            format:       rep.format || "PDF",
            roi:          roiNum,
            npv:          rep.npv != null ? Number(rep.npv) : null,
            paybackYears: rep.payback_years != null ? Number(rep.payback_years)
                          : rep.paybackYears != null ? Number(rep.paybackYears)
                          : null,
            status:       rep.status || status,
            notes:        rep.notes || "",
            archived:     rep.archived === true || rep.archived === "true",
          };
        });
      }

      // ── Normalize Invoices ──────────────────────────────────────────────
      // Backend sends: { invoice_id, invoice_number, vendor, amount, status,
      //   department_id, approved_by_id }
      // Frontend needs: { id, invoiceNumber, vendor, amount, status,
      //   department, departmentLabel, type, dueDate, issuedDate, approvedBy, archived }
      if (Array.isArray(invoices)) {
        // Build a quick dept-label lookup from local mock data (has short IDs)
        // Backend uses UUID dept IDs, so we fall back gracefully
        const deptLookup = {};
        (universalDB.data.finance.departments || []).forEach((d) => {
          deptLookup[d.id] = d.name;
        });

        universalDB.data.finance.invoices = invoices.map((inv) => ({
          id:             inv.invoice_id || inv.id,
          invoiceNumber:  inv.invoice_number || inv.invoiceNumber || inv.invoice_id || "—",
          vendor:         inv.vendor || "—",
          amount:         Number(inv.amount) || 0,
          department:     inv.department_id || inv.department || "",
          departmentLabel: deptLookup[inv.department_id]
                          || inv.department_label
                          || inv.departmentLabel
                          || (inv.department_id ? "Dept " + inv.department_id.slice(-4) : "—"),
          type:           inv.type || "utility",
          dueDate:        inv.due_date || inv.dueDate || null,
          issuedDate:     inv.issued_date || inv.issuedDate || null,
          status:         inv.status || "pending",
          approvedBy:     inv.approved_by_id || inv.approvedBy || null,
          archived:       inv.archived === true || inv.archived === "true",
        }));
      }
    } catch (err) {
      console.warn(
        "[Finance] Backend fetch failed, using local data:",
        err.message,
      );
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
  _setText("metric-roi", (latest.roi ?? "—") + "%");
  _setText("metric-npv", latest.npv != null ? formatCurrency(latest.npv) : "—");
  _setText(
    "metric-payback",
    latest.paybackYears != null ? latest.paybackYears + " yrs" : "—",
  );
  renderViabilityResult(latest);
}

function renderViabilityResult(rep) {
  const banner = document.getElementById("viability-result");
  if (!banner) return;
  if (!rep) {
    banner.textContent = "No report data.";
    return;
  }

  const map = {
    viable: {
      text: "Financially Viable — Recommend Expansion",
      badge: "ROI ≥ Threshold",
      color: "#d1fae5",
      textColor: "#065f46",
    },
    marginal: {
      text: "Marginal Viability — Review Before Proceeding",
      badge: "ROI Near Threshold",
      color: "#fef3c7",
      textColor: "#92400e",
    },
    "not-viable": {
      text: "Not Viable — Do Not Proceed",
      badge: "ROI < Threshold",
      color: "#fee2e2",
      textColor: "#b91c1c",
    },
  };
  const v = map[rep.status] || map.marginal;
  banner.style.background = v.color;
  banner.style.color = v.textColor;
  banner.querySelector?.(".badge") &&
    (banner.querySelector(".badge").textContent = v.badge);
  const textNode = banner.childNodes[0];
  if (textNode?.nodeType === 3) textNode.textContent = v.text + " ";
}

/* ── FILTERS ──────────────────────────────────────── */

function wireFilters() {
  const categoryFilter = document.getElementById("report-filter-category");
  const statusFilter = document.getElementById("report-filter-status");
  const invoiceFilter = document.getElementById("invoice-filter-status");
  const deptFilter = document.getElementById("invoice-filter-dept");

  categoryFilter?.addEventListener("change", applyReportFilters);
  statusFilter?.addEventListener("change", applyReportFilters);
  invoiceFilter?.addEventListener("change", applyInvoiceFilters);
  deptFilter?.addEventListener("change", applyInvoiceFilters);
}

function applyReportFilters() {
  const category =
    document.getElementById("report-filter-category")?.value ?? "all";
  const status =
    document.getElementById("report-filter-status")?.value ?? "all";
  ReportModule.renderReportList({ category, status });
}

function applyInvoiceFilters() {
  const status =
    document.getElementById("invoice-filter-status")?.value ?? "all";
  const department =
    document.getElementById("invoice-filter-dept")?.value ?? "all";
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
      import("./utils/utils.js").then(({ showToast }) =>
        showToast("Enter a valid savings value.", "warning"),
      );
      return;
    }
    if (!budget || budget <= 0) {
      import("./utils/utils.js").then(({ showToast }) =>
        showToast("Enter a valid budget value.", "warning"),
      );
      return;
    }

    const roi = ((saving / budget) * 100).toFixed(1);
    const npv = (saving * 3.2 - budget).toFixed(0); // simplified 3-yr NPV
    const payback = (budget / saving).toFixed(1);

    _setText("metric-roi", roi + "%");
    _setText("metric-npv", "₹" + Number(npv).toLocaleString());
    _setText("metric-payback", payback + " yrs");

    const status = roi >= 15 ? "viable" : roi >= 8 ? "marginal" : "not-viable";
    renderViabilityResult({ status, roi: Number(roi), npv: Number(npv) });
    import("./utils/utils.js").then(({ showToast }) =>
      showToast("Metrics calculated.", "success"),
    );
  });
}

/* ── ROLE SWITCHER ────────────────────────────────── */

function wireRoleSwitcher() {
  const switcher = document.getElementById("role-switcher");
  if (!switcher) return;
  switcher.addEventListener("change", (e) => {
    SessionModule.switchRole(e.target.value);
    ReportModule.renderReportList();
    InvoiceModule.renderInvoiceList();
  });
}

/* ── NAVIGATION ───────────────────────────────────── */

function wireNavigation() {
  document.querySelectorAll(".menu-item[data-page]").forEach((item) => {
    item.addEventListener("click", () => {
      window.location.href = item.dataset.page;
    });
  });
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
