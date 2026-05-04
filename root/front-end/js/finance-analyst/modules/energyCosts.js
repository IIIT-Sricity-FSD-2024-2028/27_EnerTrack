/**
 * energyCosts.js
 * CRUD operations for energy cost records (Utility Costs page).
 */

import FinanceDB, { persistData } from "../data/mockData.js";
import universalDB from "../../shared/universalDB.js";
import { showToast, openModal, badgeHTML, formatCurrency, generateId, validateForm, showFieldError, clearAllErrors, can } from "../utils/utils.js";
import { logActivity } from "./activity.js";

/* ── STATE ────────────────────────────────────────── */
export const DashboardState = {
  isPending: true,
  currentView: "energy" // "energy" | "building" | "time"
};
window.DashboardState = DashboardState;

/* ── RENDER TABLE ─────────────────────────────────── */

export function renderCostTable(filter = {}) {
  const tbody = document.getElementById("cost-tbody");
  if (!tbody) return;

  let records = [...FinanceDB.energyCosts];

  if (filter.scope && filter.scope !== "all") records = records.filter(r => r.scope === filter.scope);
  if (filter.period && filter.period !== "") records = records.filter(r => r.period === filter.period);

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#9ca3af;padding:32px">No records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(rec => `
    <tr data-id="${rec.id}">
      <td>${rec.period}</td>
      <td style="text-transform:capitalize">${rec.scope}</td>
      <td>${rec.scopeLabel}</td>
      <td>${formatCurrency(rec.electricity)}</td>
      <td>${formatCurrency(rec.gas)}</td>
      <td>${formatCurrency(rec.water)}</td>
      <td>${formatCurrency(rec.wastewater || 0)}</td>
      <td><strong>${formatCurrency(rec.total)}</strong></td>
      <td>${badgeHTML(rec.status)}</td>
      <td class="action-cell">
        <div class="action-row">
          <button class="action-btn btn-view"   onclick="CostModule.viewCostRecord('${rec.id}')">View</button>
          ${can("edit")   ? `<button class="action-btn btn-edit"   onclick="CostModule.editCostRecord('${rec.id}')">Edit</button>` : ""}
        </div>
        ${can("delete") ? `<button class="action-btn btn-delete" onclick="CostModule.deleteCostRecord('${rec.id}')">Delete</button>` : ""}
      </td>
    </tr>
  `).join("");
}

/* ── VIEW ─────────────────────────────────────────── */

export function viewCostRecord(id) {
  const rec = FinanceDB.energyCosts.find(r => r.id === id);
  if (!rec) return;

  openModal({
    title: `Cost Record — ${rec.scopeLabel} (${rec.period})`,
    bodyHTML: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;font-size:14px">
        <div><strong>Period</strong><p>${rec.period}</p></div>
        <div><strong>Scope</strong><p style="text-transform:capitalize">${rec.scope}</p></div>
        <div><strong>Reference</strong><p>${rec.scopeLabel}</p></div>
        <div><strong>Status</strong><p>${badgeHTML(rec.status)}</p></div>
        <div><strong>Electricity</strong><p>${formatCurrency(rec.electricity)}</p></div>
        <div><strong>Gas</strong><p>${formatCurrency(rec.gas)}</p></div>
        <div><strong>Water</strong><p>${formatCurrency(rec.water)}</p></div>
        <div><strong>Wastewater</strong><p>${formatCurrency(rec.wastewater || 0)}</p></div>
        <div><strong>Demand</strong><p>${formatCurrency(rec.demand)}</p></div>
        <div><strong>Total Cost</strong><p><strong>${formatCurrency(rec.total)}</strong></p></div>
        <div><strong>Budget</strong><p>${formatCurrency(rec.budget)}</p></div>
        <div><strong>Variance</strong><p style="color:${rec.variance >= 0 ? '#166534':'#dc2626'}">${rec.variance >= 0 ? '+' : ''}${formatCurrency(rec.variance)}</p></div>
      </div>`,
    confirmLabel: "Close",
    cancelLabel: "",
    onConfirm: () => {}
  });
}

/* ── ADD ──────────────────────────────────────────── */

export function openAddCostModal() {
  if (!can("create")) { showToast("Permission denied.", "error"); return; }

  const deptOptions = FinanceDB.departments.map(d => `<option value="${d.id}|dept|${d.name}">${d.name}</option>`).join("");
  const bldgOptions = FinanceDB.buildings.map(b => `<option value="${b.id}|building|${b.name}">${b.name}</option>`).join("");

  openModal({
    title: "Add Energy Cost Record",
    bodyHTML: `
      <form id="add-cost-form" novalidate>
        <div class="fm-row">
          <div class="fm-group">
            <label>Period * (YYYY-MM or YYYY-QN)</label>
            <input id="ac-period" placeholder="e.g. 2025-03">
          </div>
          <div class="fm-group">
            <label>Scope *</label>
            <select id="ac-scope-type" onchange="CostModule._toggleScopeSelect()">
              <option value="">Select scope</option>
              <option value="department">Department</option>
              <option value="building">Building</option>
            </select>
          </div>
        </div>
        <div class="fm-group" id="ac-scope-dept" style="display:none">
          <label>Department *</label>
          <select id="ac-dept-ref"><option value="">Choose department</option>${deptOptions}</select>
        </div>
        <div class="fm-group" id="ac-scope-bldg" style="display:none">
          <label>Building *</label>
          <select id="ac-bldg-ref"><option value="">Choose building</option>${bldgOptions}</select>
        </div>
        <div class="fm-row">
          <div class="fm-group">
            <label>Electricity ($) *</label>
            <input id="ac-elec" type="number" placeholder="0" min="0">
          </div>
          <div class="fm-group">
            <label>Gas ($) *</label>
            <input id="ac-gas" type="number" placeholder="0" min="0">
          </div>
        </div>
        <div class="fm-row">
          <div class="fm-group">
            <label>Water ($) *</label>
            <input id="ac-water" type="number" placeholder="0" min="0">
          </div>
          <div class="fm-group">
            <label>Wastewater ($) *</label>
            <input id="ac-wastewater" type="number" placeholder="0" min="0">
          </div>
        </div>
        <div class="fm-row">
          <div class="fm-group">
            <label>Demand Charge ($) *</label>
            <input id="ac-demand" type="number" placeholder="0" min="0">
          </div>
          <div class="fm-group">
            <label>Budget ($) *</label>
            <input id="ac-budget" type="number" placeholder="0" min="1">
          </div>
        </div>
      </form>`,
    confirmLabel: "Add Record",
    onConfirm: () => _submitAddCost()
  });
}

// Toggle department/building select visibility
export function _toggleScopeSelect() {
  const type = document.getElementById("ac-scope-type")?.value;
  document.getElementById("ac-scope-dept").style.display = type === "department" ? "" : "none";
  document.getElementById("ac-scope-bldg").style.display = type === "building"   ? "" : "none";
}
window._toggleScopeSelect = _toggleScopeSelect;

function _submitAddCost() {
  const form = document.getElementById("add-cost-form");
  if (!form) return;

  const fields = {
    period:    document.getElementById("ac-period"),
    scopeType: document.getElementById("ac-scope-type"),
    elec:       document.getElementById("ac-elec"),
    gas:        document.getElementById("ac-gas"),
    water:      document.getElementById("ac-water"),
    wastewater: document.getElementById("ac-wastewater"),
    demand:     document.getElementById("ac-demand"),
    budget:     document.getElementById("ac-budget")
  };

  clearAllErrors(form);
  let valid = true;

  const rules = {
    period: { required: true, pattern: /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/, patternMsg: "Format must be YYYY-MM or YYYY-Q1 to YYYY-Q4." },
    scopeType: { required: true },
    elec: { required: true, min: 0 },
    gas: { required: true, min: 0 },
    water: { required: true, min: 0 },
    wastewater: { required: true, min: 0 },
    demand: { required: true, min: 0 },
    budget: { required: true, positiveNumber: true }
  };

  const data = {};
  for (const [k, el] of Object.entries(fields)) data[k] = el?.value || "";

  const { errors } = validateForm(data, rules);
  for (const [k, msg] of Object.entries(errors)) {
    if (fields[k]) { showFieldError(fields[k], msg); valid = false; }
  }

  // Scope ref
  const scopeType = fields.scopeType.value;
  const deptRef = document.getElementById("ac-dept-ref");
  const bldgRef = document.getElementById("ac-bldg-ref");
  let scopeValue = "";

  if (scopeType === "department") {
    scopeValue = deptRef?.value ?? "";
    if (!scopeValue) { showFieldError(deptRef, "Select a department."); valid = false; }
  } else if (scopeType === "building") {
    scopeValue = bldgRef?.value ?? "";
    if (!scopeValue) { showFieldError(bldgRef, "Select a building."); valid = false; }
  }

  if (!valid) {
    return false;
  }

  const [scopeId, , scopeLabel] = scopeValue.split("|");
  const periodVal  = fields.period.value;
  const elec       = Number(fields.elec.value);
  const gas        = Number(fields.gas.value);
  const water      = Number(fields.water.value);
  const wastewater = Number(fields.wastewater.value);
  const demand     = Number(fields.demand.value);
  const total      = elec + gas + water + wastewater + demand;
  const budget     = Number(fields.budget.value);
  const variance = budget - total;

  const newRec = {
    period: periodVal,
    scope: scopeType,
    scopeRef: scopeId,
    scopeLabel,
    electricity: elec, gas, water, wastewater, demand, total, budget, variance,
    status: variance > 0 ? "under-budget" : variance === 0 ? "on-budget" : "over-budget"
  };

  if (window.api) {
      window.api.post('/energy-costs', newRec).then(res => {
          if (res) {
              const recWithId = { ...newRec, id: res.energy_cost_id || generateId("ec") };
              FinanceDB.energyCosts.push(recWithId);
              _finishAdd(recWithId);
          }
      }).catch(console.warn);
  } else {
      const recWithId = { ...newRec, id: generateId("ec") };
      FinanceDB.energyCosts.push(recWithId);
      _finishAdd(recWithId);
  }

  function _finishAdd(rec) {
      persistData();
      logActivity("energy", `Cost record added for ${scopeLabel}`, `Period: ${periodVal}, Total: ${formatCurrency(total)}`);
      renderCostTable();
      updateCostSummary();
      showToast("Energy cost record added.", "success");
  }
}

/* ── EDIT ─────────────────────────────────────────── */

export function editCostRecord(id) {
  if (!can("edit")) { showToast("Permission denied.", "error"); return; }
  const rec = FinanceDB.energyCosts.find(r => r.id === id);
  if (!rec) return;

  openModal({
    title: `Edit Cost Record — ${rec.scopeLabel}`,
    bodyHTML: `
      <form id="edit-cost-form" novalidate>
        <p style="font-size:13px;color:#6b7280;margin-bottom:16px">Period: <strong>${rec.period}</strong> — Scope: <strong>${rec.scopeLabel}</strong></p>
        <div class="fm-row">
          <div class="fm-group">
            <label>Electricity ($) *</label>
            <input id="ecc-elec" type="number" value="${rec.electricity}" min="0">
          </div>
          <div class="fm-group">
            <label>Gas ($) *</label>
            <input id="ecc-gas" type="number" value="${rec.gas}" min="0">
          </div>
        </div>
        <div class="fm-row">
          <div class="fm-group">
            <label>Water ($) *</label>
            <input id="ecc-water" type="number" value="${rec.water}" min="0">
          </div>
          <div class="fm-group">
            <label>Wastewater ($) *</label>
            <input id="ecc-wastewater" type="number" value="${rec.wastewater || 0}" min="0">
          </div>
        </div>
        <div class="fm-row">
          <div class="fm-group">
            <label>Demand Charge ($) *</label>
            <input id="ecc-demand" type="number" value="${rec.demand}" min="0">
          </div>
          <div class="fm-group">
            <label>Budget ($) *</label>
            <input id="ecc-budget" type="number" value="${rec.budget}" min="1">
          </div>
        </div>
      </form>`,
    confirmLabel: "Save Changes",
    onConfirm: () => _submitEditCost(id)
  });
}

function _submitEditCost(id) {
  const form = document.getElementById("edit-cost-form");
  if (!form) return;

  const fields = {
    elec:       document.getElementById("ecc-elec"),
    gas:        document.getElementById("ecc-gas"),
    water:      document.getElementById("ecc-water"),
    wastewater: document.getElementById("ecc-wastewater"),
    demand:     document.getElementById("ecc-demand"),
    budget:     document.getElementById("ecc-budget")
  };

  clearAllErrors(form);
  let valid = true;

  const rules = {
    elec: { required: true, min: 0 },
    gas: { required: true, min: 0 },
    water: { required: true, min: 0 },
    wastewater: { required: true, min: 0 },
    demand: { required: true, min: 0 },
    budget: { required: true, positiveNumber: true }
  };

  const data = {};
  for (const [k, el] of Object.entries(fields)) data[k] = el?.value || "";

  const { errors } = validateForm(data, rules);
  for (const [k, msg] of Object.entries(errors)) {
    if (fields[k]) { showFieldError(fields[k], msg); valid = false; }
  }

  if (!valid) {
    return false;
  }

  const idx = FinanceDB.energyCosts.findIndex(r => r.id === id);
  if (idx < 0) return;
  const elec       = Number(fields.elec.value);
  const gas        = Number(fields.gas.value);
  const water      = Number(fields.water.value);
  const wastewater = Number(fields.wastewater.value);
  const demand     = Number(fields.demand.value);
  const total      = elec + gas + water + wastewater + demand;
  const budget     = Number(fields.budget.value);
  const variance = budget - total;

  const payload = {
      electricity: elec, gas, water, wastewater, demand, total, budget, variance,
      status: variance > 0 ? "under-budget" : variance === 0 ? "on-budget" : "over-budget"
  };

  if (window.api) {
      window.api.patch(`/energy-costs/${id}`, payload).then(() => {
          Object.assign(FinanceDB.energyCosts[idx], payload);
          _finishEdit();
      }).catch(console.warn);
  } else {
      Object.assign(FinanceDB.energyCosts[idx], payload);
      _finishEdit();
  }

  function _finishEdit() {
      persistData();
      logActivity("energy", `Cost record updated for ${FinanceDB.energyCosts[idx].scopeLabel}`, `Total: ${formatCurrency(total)}`);
      renderCostTable();
      updateCostSummary();
      showToast("Cost record updated.", "success");
  }
}

/* ── DELETE ───────────────────────────────────────── */

export function deleteCostRecord(id) {
  if (!can("delete")) { showToast("Permission denied.", "error"); return; }
  const rec = FinanceDB.energyCosts.find(r => r.id === id);
  if (!rec) return;

  openModal({
    title: "Delete Cost Record",
    bodyHTML: `<p>Are you sure you want to delete the cost record for <strong>${rec.scopeLabel}</strong> (${rec.period})?</p>`,
    confirmLabel: "Delete",
    danger: true,
    onConfirm: () => {
      if (window.api) {
          window.api.delete(`/energy-costs/${id}`).then(() => {
              universalDB.data.finance.energyCosts = FinanceDB.energyCosts.filter(r => r.id !== id);
              _finishDelete();
          }).catch(console.warn);
      } else {
          universalDB.data.finance.energyCosts = FinanceDB.energyCosts.filter(r => r.id !== id);
          _finishDelete();
      }

      function _finishDelete() {
          persistData();
          logActivity("energy", `Cost record deleted for ${rec.scopeLabel}`, `Period: ${rec.period}`);
          renderCostTable();
          updateCostSummary();
          showToast("Cost record deleted.", "success");
      }
    }
  });
}

/* ── SUMMARY ──────────────────────────────────────── */

export function updateCostSummary() {
  const all = FinanceDB.energyCosts;
  const totalCost   = all.reduce((s, r) => s + r.total, 0);
  const totalBudget = all.reduce((s, r) => s + r.budget, 0);
  const overBudget  = all.filter(r => r.status === "over-budget").length;

  _setText("cost-total",      formatCurrency(totalCost));
  _setText("cost-budget",     formatCurrency(totalBudget));
  _setText("cost-over-count", overBudget);

  // If dashboard is pending, clear graphs/metrics
  if (DashboardState.isPending) {
    _setAnalyticsPending();
    return;
  }

  _updateAnalyticMetrics(all);
  renderCostBreakdown(DashboardState.currentView);
  _updateBudgetVsActual(all);
}

function _setAnalyticsPending() {
  const bars = document.querySelector(".bars");
  if (bars) bars.innerHTML = `<div style="width:100%;text-align:center;color:#9ca3af;padding-top:20px;font-style:italic">Analytics pending. Click "Retrieve & Calculate" to begin simulation.</div>`;
  
  // Reset metrics
  document.querySelectorAll(".metric strong").forEach(s => s.textContent = "—");
  document.querySelectorAll(".budget-card strong").forEach(s => s.textContent = "—");
}

function _updateAnalyticMetrics(all) {
  const totalConsumption = all.length * 1.24; // Mock scale
  const totalCost = all.reduce((s, r) => s + r.total, 0);
  const budgetTotal = all.reduce((s, r) => s + r.budget, 0);
  const variance = budgetTotal - totalCost;

  const labels = document.querySelectorAll(".metric strong");
  if (labels[0]) labels[0].textContent = totalConsumption.toFixed(2) + "M kWh";
  if (labels[1]) labels[1].textContent = formatCurrency(totalCost);
  if (labels[2]) {
    labels[2].textContent = (variance >= 0 ? "+" : "") + formatCurrency(variance);
    labels[2].parentElement.style.color = variance >= 0 ? "#059669" : "#dc2626";
  }
}

function _updateBudgetVsActual(all) {
  const actual = all.reduce((s, r) => s + r.total, 0);
  const budget = all.reduce((s, r) => s + r.budget, 0);
  const variance = budget - actual;

  const cards = document.querySelectorAll(".budget-card");
  if (!cards.length) return;

  // Budget card
  cards[0].querySelector("strong").textContent = formatCurrency(budget);
  
  // Actual card
  cards[1].querySelector("strong").textContent = formatCurrency(actual);
  cards[1].classList.toggle("red", actual > budget);
  
  // Variance card
  cards[2].querySelector("strong").textContent = (variance >= 0 ? "+" : "") + formatCurrency(variance);
  cards[2].classList.toggle("red", variance < 0);
  
  const vNote = cards[2].lastChild;
  if (vNote) {
    vNote.textContent = variance < 0 
      ? `Over budget by ${formatCurrency(Math.abs(variance))} (Loss)` 
      : `${formatCurrency(variance)} savings against target.`;
  }
}

/* ── CHARTS ───────────────────────────────────────── */

export function renderCostBreakdown(viewMode) {
  const container = document.querySelector(".bars");
  if (!container) return;

  DashboardState.currentView = viewMode;
  let data = [];

  const all = FinanceDB.energyCosts;

  if (viewMode === "energy") {
    data = [
      { label: "Electricity", value: all.reduce((s, r) => s + r.electricity, 0) },
      { label: "Gas",         value: all.reduce((s, r) => s + r.gas, 0) },
      { label: "Water",       value: all.reduce((s, r) => s + r.water, 0) },
      { label: "Wastewater",  value: all.reduce((s, r) => s + (r.wastewater || 0), 0) },
      { label: "Demand",      value: all.reduce((s, r) => s + r.demand, 0), isDemand: true }
    ];
  } else if (viewMode === "building") {
    const buildings = [...new Set(all.map(r => r.scopeLabel))];
    data = buildings.map(b => ({
      label: b.split(" – ")[0],
      value: all.filter(r => r.scopeLabel === b).reduce((s, r) => s + r.total, 0)
    }));
  } else if (viewMode === "time") {
    const periods = [...new Set(all.map(r => r.period))].sort();
    data = periods.map(p => ({
      label: p,
      value: all.filter(r => r.period === p).reduce((s, r) => s + r.total, 0)
    }));
  }

  const maxVal = Math.max(...data.map(d => d.value)) || 1;
  const chartHeight = 160;

  container.innerHTML = data.map(d => {
    const totalH = (d.value / maxVal) * chartHeight;
    const isMax = d.value === maxVal && d.value > 0;
    
    // Stacked Logic
    let baseH = totalH * 0.85;
    let taxH = totalH * 0.15;
    
    if (d.label === "Demand" || d.isDemand) {
      baseH = 0; 
      taxH = 0; // Pure gray for demand
    }

    return `
      <div class="bar-group" style="${isMax ? 'border: 2px solid #059669; border-radius: 8px; padding: 6px; margin-top: -10px; background: rgba(5, 150, 105, 0.05);' : ''}">
        <div class="stacked-bar" style="height:${totalH}px; width:44px; overflow:hidden; position:relative; display:flex; flex-direction:column-reverse; border-radius:4px;">
          ${(d.label === "Demand" || d.isDemand) 
            ? `<div class="bar bg-gray" style="height:100%; width:100%"></div>` 
            : `
              <div class="bar bg-green"  style="height:${(baseH/totalH)*100}%; width:100%" title="Base: ${formatCurrency(d.value * 0.85)}"></div>
              <div class="bar bg-yellow" style="height:${(taxH/totalH)*100}%; width:100%" title="Taxes: ${formatCurrency(d.value * 0.15)}"></div>
            `
          }
        </div>
        <div class="bar-label" style="font-weight:${isMax ? '700' : '500'}; color:${isMax ? '#0f8f63' : '#8a95a2'}">${d.label}</div>
      </div>
    `;
  }).join("");
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── EXPORT NAMESPACE ─────────────────────────────── */
const CostModule = { renderCostTable, viewCostRecord, openAddCostModal, _toggleScopeSelect, editCostRecord, deleteCostRecord, updateCostSummary, renderCostBreakdown, DashboardState };
window.CostModule = CostModule;
export default CostModule;
