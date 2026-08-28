/**
 * costsPage.js
 * Entry-point for the Utility Costs page.
 * Data: fetched from backend /energy-costs (DTO), hydrated into universalDB.data.finance
 */

import FinanceDB from "./data/mockData.js";
import SessionModule from "./modules/session.js";
import CostModule from "./modules/energyCosts.js";
import universalDB from "../shared/universalDB.js";

document.addEventListener("DOMContentLoaded", async () => {
  window.FinanceDB = FinanceDB;

  // Hydrate from backend before rendering
  if (window.api) {
    try {
      const [energyCosts, invoices] = await Promise.all([
        window.api.get("/energy-costs").catch(() => null),
        window.api.get("/invoices").catch(() => null),
      ]);

      // ── Normalize Energy Costs ──────────────────────────────────────────
      // Backend sends: { energy_cost_id, period, electricity, gas, water,
      //   status, building_id, department_id }
      // Frontend needs: { id, period, scope, scopeRef, scopeLabel,
      //   electricity, gas, water, wastewater, demand, total, budget, variance, status }
      if (Array.isArray(energyCosts)) {
        universalDB.data.finance.energyCosts = energyCosts.map((rec) => {
          const elec      = Number(rec.electricity) || 0;
          const gas       = Number(rec.gas)         || 0;
          const water     = Number(rec.water)       || 0;
          const wastewater= Number(rec.wastewater)  || 0;
          const demand    = Number(rec.demand)      || 0;
          const total     = elec + gas + water + wastewater + demand;

          // Use existing budget if present, otherwise treat total as budget (on-budget)
          const budget    = Number(rec.budget) > 0 ? Number(rec.budget) : total;
          const variance  = budget - total;

          // Derive scope info
          const hasDept   = !!rec.department_id;
          const scope     = rec.scope || (hasDept ? "department" : "building");
          const scopeRef  = rec.scopeRef || rec.department_id || rec.building_id || "";
          const scopeLabel= rec.scopeLabel
                          || (hasDept
                              ? "Dept " + (rec.department_id || "").slice(-4)
                              : "Bldg " + (rec.building_id  || "").slice(-4));

          // Normalize status string (backend uses UNDER_BUDGET / OVER_BUDGET / ON_BUDGET)
          const rawStatus = (rec.status || "").toLowerCase().replace(/_/g, "-");
          const status    = ["under-budget", "over-budget", "on-budget"].includes(rawStatus)
                          ? rawStatus
                          : variance > 0 ? "under-budget" : variance < 0 ? "over-budget" : "on-budget";

          return {
            id:          rec.energy_cost_id || rec.id,
            period:      rec.period || "—",
            scope,
            scopeRef,
            scopeLabel,
            electricity: elec,
            gas,
            water,
            wastewater,
            demand,
            total,
            budget,
            variance,
            status,
          };
        });
      }

      // ── Normalize Invoices ──────────────────────────────────────────────
      // Backend sends: { invoice_id, invoice_number, vendor, amount, status, department_id }
      // Frontend needs: { id, invoiceNumber, vendor, amount, status, department, departmentLabel }
      if (Array.isArray(invoices)) {
        universalDB.data.finance.invoices = invoices.map((inv) => ({
          id:             inv.invoice_id || inv.id,
          invoiceNumber:  inv.invoice_number || inv.invoiceNumber || inv.invoice_id || "—",
          vendor:         inv.vendor || "—",
          amount:         Number(inv.amount) || 0,
          department:     inv.department_id || inv.department || "",
          departmentLabel: inv.departmentLabel
                          || (inv.department_id ? "Dept " + inv.department_id.slice(-4) : "—"),
          type:           inv.type || "utility",
          dueDate:        inv.due_date || inv.dueDate || null,
          issuedDate:     inv.issued_date || inv.issuedDate || null,
          status:         inv.status || "pending",
          approvedBy:     inv.approved_by_id || inv.approvedBy || null,
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
  CostModule.renderCostTable();
  CostModule.updateCostSummary();
  wireFilters();
  wireButtons();
  wireTabs();
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
  const periods = [...new Set(FinanceDB.energyCosts.map((c) => c.period))]
    .sort()
    .reverse();
  periodSel.innerHTML =
    `<option value="">All Periods</option>` +
    periods.map((p) => `<option value="${p}">${p}</option>`).join("");
}

/* ── FILTERS ──────────────────────────────────────── */

function wireFilters() {
  document
    .getElementById("filter-scope")
    ?.addEventListener("change", applyFilters);
  document
    .getElementById("filter-period")
    ?.addEventListener("change", applyFilters);
}

function applyFilters() {
  const scope = document.getElementById("filter-scope")?.value ?? "all";
  const period = document.getElementById("filter-period")?.value ?? "";
  CostModule.renderCostTable({ scope, period });
}

/* ── BUTTONS ──────────────────────────────────────── */

function wireButtons() {
  document.getElementById("btn-add-cost")?.addEventListener("click", () => {
    CostModule.openAddCostModal();
  });

  // Retrieve & Calculate (Simulation)
  const btn = document.getElementById("btn-retrieve");
  if (!btn) return;

  btn.addEventListener("click", () => {
    import("./utils/utils.js").then(({ showToast }) => {
      btn.disabled = true;
      btn.innerText = "Calculating...";

      showToast("Triggering campus consumption sweep...", "info", 1500);

      setTimeout(() => {
        showToast(
          "Synchronizing with Building Management Systems...",
          "info",
          1500,
        );

        setTimeout(() => {
          // Perform the ±2% variance simulation
          _runSimulation();

          const { DashboardState } = CostModule;
          DashboardState.isPending = false;
          CostModule.updateCostSummary();

          showToast(
            "Financial calculation complete. Charts updated.",
            "success",
          );
          btn.disabled = false;
          btn.innerText = "Retrieve & Calculate";
        }, 1800);
      }, 1500);
    });
  });
}

function _runSimulation() {
  // Apply ±2% variance to every cost in FinanceDB
  // Guard all fields against undefined/NaN — critical when data comes from backend
  FinanceDB.energyCosts.forEach((rec) => {
    const factor = 1 + (Math.random() * 0.04 - 0.02); // 0.98 to 1.02

    rec.electricity = Math.round((Number(rec.electricity) || 0) * factor);
    rec.gas         = Math.round((Number(rec.gas)         || 0) * factor);
    rec.water       = Math.round((Number(rec.water)       || 0) * factor);
    rec.wastewater  = Math.round((Number(rec.wastewater)  || 0) * factor);
    rec.demand      = Math.round((Number(rec.demand)      || 0) * factor);

    rec.total    = rec.electricity + rec.gas + rec.water + rec.wastewater + rec.demand;
    rec.budget   = Number(rec.budget) > 0 ? rec.budget : rec.total; // keep original budget
    rec.variance = rec.budget - rec.total;
    rec.status   =
      rec.variance > 0
        ? "under-budget"
        : rec.variance === 0
          ? "on-budget"
          : "over-budget";
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
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const { DashboardState } = CostModule;
      if (!DashboardState.isPending) {
        CostModule.renderCostBreakdown(viewModes[idx]);
      } else {
        DashboardState.currentView = viewModes[idx]; // Just update state, it will render on "Calculate"
      }
    });
  });
}

/* ── ROLE SWITCHER ────────────────────────────────── */

function wireRoleSwitcher() {
  const switcher = document.getElementById("role-switcher");
  if (!switcher) return;
  switcher.addEventListener("change", (e) => {
    SessionModule.switchRole(e.target.value);
    CostModule.renderCostTable();
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
