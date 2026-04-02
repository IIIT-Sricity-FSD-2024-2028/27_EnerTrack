/**
 * costsPage.js
 * Entry-point for the Utility Costs page (finaniance3.html).
 */

import FinanceDB     from "./data/mockData.js";
import SessionModule from "./modules/session.js";
import CostModule    from "./modules/energyCosts.js";

<<<<<<< HEAD
const SS_KEY = 'enertrack.finance.costs';

function _restoreState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SS_KEY) || '{}');
    if (saved.scope)  { const el = document.getElementById('filter-scope');  if (el) el.value = saved.scope; }
    // period dropdown is populated dynamically, restore after populate
    if (saved.period) {
      const el = document.getElementById('filter-period');
      if (el) el.dataset.pendingRestore = saved.period;
    }
  } catch (_) {}
}

function _saveState() {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({
      scope:  document.getElementById('filter-scope')?.value,
      period: document.getElementById('filter-period')?.value,
    }));
  } catch (_) {}
}

=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
document.addEventListener("DOMContentLoaded", () => {
  window.FinanceDB = FinanceDB;

  SessionModule.initSession();
<<<<<<< HEAD
  _restoreState();
=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
  CostModule.renderCostTable();
  CostModule.updateCostSummary();
  wireFilters();
  wireButtons();
<<<<<<< HEAD
=======
  wireTabs();
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
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
<<<<<<< HEAD

  // Restore pending period after options are populated
  if (periodSel.dataset.pendingRestore) {
    periodSel.value = periodSel.dataset.pendingRestore;
    delete periodSel.dataset.pendingRestore;
    applyFilters();
  }
=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
}

/* ── FILTERS ──────────────────────────────────────── */

function wireFilters() {
<<<<<<< HEAD
  document.getElementById("filter-scope")?.addEventListener("change",  () => { _saveState(); applyFilters(); });
  document.getElementById("filter-period")?.addEventListener("change", () => { _saveState(); applyFilters(); });
=======
  document.getElementById("filter-scope")?.addEventListener("change",  applyFilters);
  document.getElementById("filter-period")?.addEventListener("change", applyFilters);
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
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

<<<<<<< HEAD
  // Retrieve & Calculate (simulated)
  document.getElementById("btn-retrieve")?.addEventListener("click", () => {
    import("./utils/utils.js").then(({ showToast }) => {
      showToast("Fetching consumption data…", "info", 1200);
      setTimeout(() => {
        CostModule.updateCostSummary();
        showToast("Cost calculation complete.", "success");
      }, 1400);
=======
  // Retrieve & Calculate (Simulation)
  const btn = document.getElementById("btn-retrieve");
  if (!btn) return;

  btn.addEventListener("click", () => {
    import("./utils/utils.js").then(({ showToast }) => {
      btn.disabled = true;
      btn.innerText = "Calculating...";

      showToast("Triggering campus consumption sweep...", "info", 1500);

      setTimeout(() => {
        showToast("Synchronizing with Building Management Systems...", "info", 1500);
        
        setTimeout(() => {
          // Perform the ±2% variance simulation
          _runSimulation();

          const { DashboardState } = CostModule;
          DashboardState.isPending = false;
          CostModule.updateCostSummary();

          showToast("Financial calculation complete. Charts updated.", "success");
          btn.disabled = false;
          btn.innerText = "Retrieve & Calculate";
        }, 1800);
      }, 1500);
    });
  });
}

function _runSimulation() {
  // Apply ±2% variance to every cost in FinanceDB
  FinanceDB.energyCosts.forEach(rec => {
    const factor = 1 + (Math.random() * 0.04 - 0.02); // 0.98 to 1.02
    
    rec.electricity = Math.round(rec.electricity * factor);
    rec.gas         = Math.round(rec.gas * factor);
    rec.water       = Math.round(rec.water * factor);
    rec.wastewater  = Math.round((rec.wastewater || 0) * factor);
    rec.demand      = Math.round(rec.demand * factor);
    
    rec.total = rec.electricity + rec.gas + rec.water + rec.wastewater + rec.demand;
    rec.variance = rec.budget - rec.total;
    rec.status = rec.variance > 0 ? "under-budget" : rec.variance === 0 ? "on-budget" : "over-budget";
  });
  
  CostModule.renderCostTable();
}

/* ── TABS ─────────────────────────────────────────── */

function wireTabs() {
  const tabs = document.querySelectorAll(".tabs.toggle .pill");
  if (!tabs.length) return;

  const viewModes = ["energy", "building", "time"];

  tabs.forEach((tab, idx) => {
    tab.addEventListener("click", () => {
      // Logic for active class
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const { DashboardState } = CostModule;
      if (!DashboardState.isPending) {
        CostModule.renderCostBreakdown(viewModes[idx]);
      } else {
        DashboardState.currentView = viewModes[idx]; // Just update state, it will render on "Calculate"
      }
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
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
