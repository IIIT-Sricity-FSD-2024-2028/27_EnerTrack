/**
 * overviewPage.js
 * Entry-point for the Finance Overview page (finaniance.html).
 * Initialises session, renders activity log, and wires up role-switcher.
 */

import FinanceDB      from "./data/mockData.js";
import { renderActivityList } from "./modules/activity.js";
import { formatCurrency, renderSessionUI } from "./utils/utils.js";

/* ── BOOT ─────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  // Expose DB globally (needed by can() helper and role-switcher)
  window.FinanceDB = FinanceDB;

  renderSessionUI(FinanceDB.session.user);
  renderActivityList();
  renderSummaryCards();
  renderDeptBars();
  wireNavigation();
});

/* ── SUMMARY CARDS ────────────────────────────────── */

function renderSummaryCards() {
  const costs = FinanceDB.energyCosts;
  const reports = FinanceDB.financialReports;
  const invoices = FinanceDB.invoices;

  // Latest month (2025-03) totals
  const march = costs.filter(c => c.period === "2025-03");
  const totalCost  = march.reduce((s, c) => s + c.total, 0);
  const totalBudget = march.reduce((s, c) => s + c.budget, 0);
  const variance = totalBudget - totalCost;
  const totalSavings = march.filter(c => c.variance > 0).reduce((s, c) => s + c.variance, 0);
  const latestROI = reports[0]?.roi ?? 0;

  _setText("card-energy-cost", formatCurrency(totalCost));
  _setText("card-savings",     formatCurrency(totalSavings));
  _setText("card-roi",         latestROI + "%");
  _setText("card-variance",    (variance >= 0 ? "+" : "") + formatCurrency(variance));

  const varEl = document.getElementById("card-variance");
  if (varEl) varEl.style.color = variance >= 0 ? "#22c55e" : "#dc2626";
}

/* ── DEPT BARS ────────────────────────────────────── */

function renderDeptBars() {
  const costs = FinanceDB.energyCosts.filter(c => c.scope === "department" && c.period === "2025-03");
  const container = document.getElementById("dept-bars");
  if (!container || costs.length === 0) return;

  const max = Math.max(...costs.map(c => c.total));
  const colors = ["#111827","#f59e0b","#10b981","#6366f1","#ef4444"];

  container.innerHTML = costs.map((c, i) => {
    const pct = Math.round((c.total / max) * 100);
    return `
      <div class="cost-row">
        <div class="cost-top">
          <span>${c.scopeLabel}</span>
          <span>${formatCurrency(c.total)}</span>
        </div>
        <div class="bar">
          <div class="fill" style="background:${colors[i % colors.length]};width:${pct}%"></div>
        </div>
      </div>`;
  }).join("");
}

/* ── NAVIGATION ───────────────────────────────────── */

function wireNavigation() {
  document.querySelectorAll(".menu-item[data-page]").forEach(item => {
    item.addEventListener("click", () => {
      window.location.href = item.dataset.page;
    });
  });
}

/* ── HELPERS ──────────────────────────────────────── */

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
