/**
 * costsPage.js
 * Entry-point for the Utility Costs page (finaniance3.html).
 */

import FinanceDB     from "./data/mockData.js";
import SessionModule from "./modules/session.js";
import CostModule    from "./modules/energyCosts.js";

document.addEventListener("DOMContentLoaded", () => {
  window.FinanceDB = FinanceDB;

  SessionModule.initSession();
  CostModule.renderCostTable();
  CostModule.updateCostSummary();
  wireFilters();
  wireButtons();
  wireRoleSwitcher();
  wireNavigation();
  populateScopeDropdown();
});

/* ── SCOPE DROPDOWN ───────────────────────────────── */

function populateScopeDropdown() {
  const scopeSel = document.getElementById("filter-scope");
  const periodSel = document.getElementById("filter-period");
  if (!scopeSel || !periodSel) return;

  // Unique periods
  const periods = [...new Set(FinanceDB.energyCosts.map(c => c.period))].sort().reverse();
  periodSel.innerHTML = `<option value="">All Periods</option>` +
    periods.map(p => `<option value="${p}">${p}</option>`).join("");
}

/* ── FILTERS ──────────────────────────────────────── */

function wireFilters() {
  document.getElementById("filter-scope")?.addEventListener("change",  applyFilters);
  document.getElementById("filter-period")?.addEventListener("change", applyFilters);
}

function applyFilters() {
  const scope  = document.getElementById("filter-scope")?.value  ?? "all";
  const period = document.getElementById("filter-period")?.value ?? "";
  CostModule.renderCostTable({ scope, period });
}

/* ── BUTTONS ──────────────────────────────────────── */

function wireButtons() {
  document.getElementById("btn-add-cost")?.addEventListener("click", () => {
    CostModule.openAddCostModal();
  });

  // Retrieve & Calculate (simulated)
  document.getElementById("btn-retrieve")?.addEventListener("click", () => {
    import("./utils/utils.js").then(({ showToast }) => {
      showToast("Fetching consumption data…", "info", 1200);
      setTimeout(() => {
        CostModule.updateCostSummary();
        showToast("Cost calculation complete.", "success");
      }, 1400);
    });
  });
}

/* ── ROLE SWITCHER ────────────────────────────────── */

function wireRoleSwitcher() {
  const switcher = document.getElementById("role-switcher");
  if (!switcher) return;
  switcher.addEventListener("change", e => {
    SessionModule.switchRole(e.target.value);
    CostModule.renderCostTable();
  });
}

/* ── NAVIGATION ───────────────────────────────────── */

function wireNavigation() {
  document.querySelectorAll(".menu-item[data-page]").forEach(item => {
    item.addEventListener("click", () => { window.location.href = item.dataset.page; });
  });
}
