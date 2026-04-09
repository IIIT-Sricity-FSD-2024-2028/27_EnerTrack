/**
 * overviewPage.js
 * Entry-point for the Finance Overview page (finance_overview.html).
 * Initialises session, renders activity log, and summary metrics.
 */

import FinanceDB      from "./data/mockData.js";
import SessionModule  from "./modules/session.js";
import { renderActivityList } from "./modules/activity.js";
import { formatCurrency, showToast } from "./utils/utils.js";

/* ── BOOT ─────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  // Expose DB globally (needed by can() helper and role-switcher)
  window.FinanceDB = FinanceDB;

  SessionModule.initSession();
  renderActivityList();
  renderSummaryCards();
  renderDeptBars();
  renderFinanceWorkflow();
  wireNavigation();
});

/* ── WORKFLOW 1 ───────────────────────────────────── */
function renderFinanceWorkflow() {
  const container = document.getElementById("financeWorkflowFeed");
  if (!container) return;

  const srs = FinanceDB.serviceRequests;
  const pendingEstimates = srs.filter(sr => sr.status === 'Awaiting Estimate Approval');
  const internalWOs      = window.FinanceDB.workOrders.filter(w => w.status === 'approval');
  
  const validatedJobs = srs.filter(sr => sr.status === 'Validated (Awaiting Payment)');

  if (pendingEstimates.length === 0 && validatedJobs.length === 0 && internalWOs.length === 0) {
    container.innerHTML = '<div style="padding:20px; color:#8a95a2; font-size:14px; text-align:center;">No pending maintenance or payment authorizations.</div>';
    return;
  }

  let html = '';

  // Render Estimates
  if (pendingEstimates.length > 0) {
    html += pendingEstimates.map(sr => {
      const c = sr.costProposal;
      return `
      <div style="padding:16px; border-bottom:1px solid #d8dde2;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
           <div>
             <h4 style="margin:0 0 4px 0; font-size:15px; color:#111827;">${sr.location} - ${sr.category}</h4>
             <div style="font-size:12px; color:#d97706; font-weight:600;">Cost Estimate Approval</div>
           </div>
           <span class="badge badge-gray" style="font-size:10px;">${c.type.toUpperCase()}</span>
        </div>
        
        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:12px;">
           <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
              <span style="color:#6b7280;">Materials</span>
              <span style="font-weight:500;">${formatCurrency(c.materials)}</span>
           </div>
           <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
              <span style="color:#6b7280;">Labor</span>
              <span style="font-weight:500;">${formatCurrency(c.labor)}</span>
           </div>
           <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:600; border-top:1px dashed #d1d5db; padding-top:8px; margin-top:4px;">
              <span>Total Estimated</span>
              <span>${formatCurrency(c.total)}</span>
           </div>
        </div>

        <div style="display:flex; gap:8px;">
          <button style="flex:1; padding:8px; background:#111827; color:#fff; border:none; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; transition:opacity 0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1" onclick="approveEstimate('${sr.id}')">Approve Estimate</button>
          <button style="padding:8px 16px; background:#fff; border:1px solid #d1d5db; color:#374151; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='#fff'" onclick="rejectEstimate('${sr.id}')">Reject</button>
        </div>
      </div>
      `;
    }).join("");
  }

  // Render Internal WO Estimates
  if (internalWOs.length > 0) {
    html += internalWOs.map(wo => {
      const c = wo.estimate;
      return `
      <div style="padding:16px; border-bottom:1px solid #d8dde2;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
           <div>
             <h4 style="margin:0 0 4px 0; font-size:15px; color:#111827;">${wo.id} - ${wo.title}</h4>
             <div style="font-size:12px; color:#d97706; font-weight:600;">Cost Estimate Approval</div>
           </div>
           <span class="badge badge-gray" style="font-size:10px;">REPAIR / MAINT</span>
        </div>
        
        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:12px;">
           <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
              <span style="color:#6b7280;">Materials</span>
              <span style="font-weight:500;">${formatCurrency(c.materials)}</span>
           </div>
           <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
              <span style="color:#6b7280;">Labor</span>
              <span style="font-weight:500;">${formatCurrency(c.labor)}</span>
           </div>
           <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:600; border-top:1px dashed #d1d5db; padding-top:8px; margin-top:4px;">
              <span>Total Estimated</span>
              <span>${formatCurrency(c.total)}</span>
           </div>
        </div>

        <div style="display:flex; gap:8px;">
          <button style="flex:1; padding:8px; background:#111827; color:#fff; border:none; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; transition:opacity 0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1" onclick="approveWOEstimate('${wo.id}')">Approve Estimate</button>
          <button style="padding:8px 16px; background:#fff; border:1px solid #d1d5db; color:#374151; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='#fff'" onclick="rejectWOEstimate('${wo.id}')">Reject</button>
        </div>
      </div>
      `;
    }).join("");
  }

  // Render Validated Jobs
  if (validatedJobs.length > 0) {
    html += validatedJobs.map(sr => {
      const c = sr.costProposal;
      return `
      <div style="padding:16px; border-bottom:1px solid #d8dde2;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
           <div>
             <h4 style="margin:0 0 4px 0; font-size:15px; color:#111827;">${sr.location} - ${sr.category}</h4>
             <div style="font-size:12px; color:#10b981; font-weight:600;">Payment Authorization (Job Complete & Verified)</div>
           </div>
        </div>
        
        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:12px;">
           <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:600;">
              <span>Final Invoice Total</span>
              <span>${c ? formatCurrency(c.total) : "—"}</span>
           </div>
        </div>

        <div style="display:flex;">
          <button style="flex:1; padding:8px; background:#0f8f63; color:#fff; border:none; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer;" onclick="authorizePayment('${sr.id}')">Authorize Payment / Close Job</button>
        </div>
      </div>
      `;
    }).join("");
  }

  container.innerHTML = html;
}

window.approveEstimate = function(id) {
  const sr = FinanceDB.serviceRequests.find(s => s.id === id);
  if (sr) {
    sr.status = 'Approved (Executing)';
    FinanceDB.save();
    renderFinanceWorkflow();
    showToast("Estimate approved. Technician can proceed.", "success");
  }
};

window.rejectEstimate = function(id) {
  const sr = FinanceDB.serviceRequests.find(s => s.id === id);
  if (sr) {
    sr.status = 'Accepted'; // Send back to Technician to re-estimate
    FinanceDB.save();
    renderFinanceWorkflow();
    showToast("Estimate rejected. Sent back to technician.", "warning");
  }
};

window.approveWOEstimate = function(id) {
  const wo = FinanceDB.workOrders.find(w => w.id === id);
  if (wo) {
    wo.status = 'inprogress';
    FinanceDB.save();
    renderFinanceWorkflow();
    showToast("Internal Work Order estimate approved.", "success");
  }
};

window.rejectWOEstimate = function(id) {
  const wo = FinanceDB.workOrders.find(w => w.id === id);
  if (wo) {
    // Return to New and notify Tech Admin
    wo.status = 'new';
    wo.technician = '';
    wo.rejected = true;
    FinanceDB.alerts.unshift({
        id: 'ALR-' + Math.floor(Math.random()*10000),
        severity: 'high',
        timestamp: 'Just now',
        status: 'open',
        description: `Cost estimate for Work Order ${id} was REJECTED by Finance. Please inform the end user or revise.`,
        zone: 'Finance'
    });
    FinanceDB.save();
    renderFinanceWorkflow();
    showToast("Internal Work Order estimate rejected. Tech Admin notified.", "warning");
  }
};

window.authorizePayment = function(id) {
  const sr = FinanceDB.serviceRequests.find(s => s.id === id);
  if (sr) {
    sr.status = 'Closed';
    FinanceDB.save();
    renderFinanceWorkflow();
    showToast("Payment authorized. Job closed successfully.", "success");
  }
};

/* ── SUMMARY CARDS ────────────────────────────────── */

function renderSummaryCards() {
  const costs = FinanceDB.energyCosts;
  const reports = FinanceDB.financialReports;
  const invoices = FinanceDB.invoices;

  // Latest month totals
  const allPeriods = [...new Set(costs.map(c => c.period))].sort().reverse();
  const latestPeriod = allPeriods[0] || "—";
  const records = costs.filter(c => c.period === latestPeriod);

  const totalCost  = records.reduce((s, c) => s + c.total, 0);
  const totalBudget = records.reduce((s, c) => s + c.budget, 0);
  const variance = totalBudget - totalCost;
  const totalSavings = records.filter(c => c.variance > 0).reduce((s, c) => s + c.variance, 0);
  const latestROI = reports[0]?.roi ?? 0;

  _setText("card-energy-cost", formatCurrency(totalCost));
  _setText("card-savings",     formatCurrency(totalSavings));
  _setText("card-roi",         latestROI + "%");
  _setText("card-variance",    (variance >= 0 ? "+" : "") + formatCurrency(variance));

  const changeLabels = document.querySelectorAll(".change");
  if (changeLabels[0]) changeLabels[0].textContent = `Latest period (${latestPeriod})`;

  const varEl = document.getElementById("card-variance");
  if (varEl) varEl.style.color = variance >= 0 ? "#22c55e" : "#dc2626";
}

/* ── DEPT BARS ────────────────────────────────────── */

function renderDeptBars() {
  const allPeriods = [...new Set(FinanceDB.energyCosts.map(c => c.period))].sort().reverse();
  const latestPeriod = allPeriods[0];
  const costs = FinanceDB.energyCosts.filter(c => c.scope === "department" && c.period === latestPeriod);
  
  const container = document.getElementById("dept-bars");
  if (!container || costs.length === 0) return;

  const titleEl = container.parentElement.querySelector(".section-title");
  if (titleEl && latestPeriod) {
    titleEl.childNodes[0].textContent = `Cost by Department (${latestPeriod})`;
  }

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
