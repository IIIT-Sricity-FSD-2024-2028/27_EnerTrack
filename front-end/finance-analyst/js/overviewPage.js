/**
 * overviewPage.js
 * Entry-point for the Finance Overview page (finance_overview.html).
 * Initialises session, renders activity log, and summary metrics.
 */

import FinanceDB      from "./data/mockData.js";
import SessionModule  from "./modules/session.js";
import { renderActivityList } from "./modules/activity.js";
import { formatCurrency, showToast, openModal, closeModal, validateForm } from "./utils/utils.js";
import { renderBellIcon, notifyOnStateChange } from '../../shared/notifications.js';

const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

/* ── BOOT ─────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  // Expose DB globally (needed by can() helper and role-switcher)
  window.FinanceDB = FinanceDB;

  SessionModule.initSession();
  renderActivityList();
  renderSummaryCards();
  renderDeptBars();
  renderFinanceWorkflow();
  renderWastageReviewQueue();
  wireNavigation();

  // Render notification bell
  renderBellIcon('notif-container', currentUser.email);

  // Cross-tab sync: re-render when SO forwards a report
  window.addEventListener('storage', (e) => {
    if (e.key === 'enertrack_universal_v1') {
      renderWastageReviewQueue();
    }
    if (e.key && e.key.indexOf('enertrack_notifications_') === 0) {
      renderBellIcon('notif-container', currentUser.email);
    }
  });
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

/* ══════════════════════════════════════════════════════
   WORKFLOW 2 — Sustainability Wastage Review (Steps 9-12)
   Finance Analyst receives, reviews, annotates cost-impact,
   and returns reports to the Sustainability Officer.
   ══════════════════════════════════════════════════════ */

function _readWastageReports() {
  try {
    const raw = localStorage.getItem('enertrack_universal_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.workflow?.wastageReports || [];
    }
  } catch (e) { /* fallback */ }
  return [];
}

function _writeWastageReports(reports) {
  try {
    const raw = localStorage.getItem('enertrack_universal_v1');
    const data = raw ? JSON.parse(raw) : {};
    if (!data.workflow) data.workflow = {};
    data.workflow.wastageReports = reports;
    localStorage.setItem('enertrack_universal_v1', JSON.stringify(data));
  } catch (e) {
    console.error('Failed to persist wastage reports', e);
  }
}

const TYPE_COLORS = { Energy: '#f59e0b', Water: '#3b82f6', Emissions: '#8b5cf6', Food: '#ef4444' };
const TYPE_ICONS = {
  Energy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  Water: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
  Emissions: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 18l4-8 4 8"/><path d="M3 20h18"/><path d="M12 2v4"/></svg>',
  Food: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>'
};

function renderWastageReviewQueue() {
  const container = document.getElementById('wastageReviewFeed');
  const countBadge = document.getElementById('wastageReviewCount');
  if (!container) return;

  const allReports = _readWastageReports();
  // Show reports forwarded to finance OR with cost impact added (waiting to be sent back)
  const actionable = allReports.filter(r =>
    r.status === 'Forwarded to Finance' || r.status === 'Cost Impact Added'
  );

  if (countBadge) {
    countBadge.textContent = actionable.length > 0 ? `${actionable.length} pending` : '';
  }

  if (actionable.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:28px;color:#9ca3af;font-size:14px;border:2px dashed #e5e7eb;border-radius:10px;">No sustainability reports pending cost review.</div>`;
    return;
  }

  container.innerHTML = actionable
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map(r => _buildReportCard(r))
    .join('');
}

function _buildReportCard(r) {
  const color = TYPE_COLORS[r.type] || '#6b7280';
  const icon = TYPE_ICONS[r.type] || '';
  const sd = r.systemData || {};
  const spec = r.specificData || {};

  // Derive user observation summary
  let userSummary = '', userLocation = '';
  if (r.type === 'Energy')    { userSummary = spec.observation || '—'; userLocation = spec.building || '—'; }
  else if (r.type === 'Water')     { userSummary = spec.nature || '—'; userLocation = spec.location || '—'; }
  else if (r.type === 'Emissions') { userSummary = spec.observation || '—'; userLocation = spec.location || '—'; }
  else if (r.type === 'Food')      { userSummary = `${spec.typeOfWastage || '—'} (~${spec.estimatedAmount || '?'}kg)`; userLocation = spec.cafeteria || '—'; }

  // Anomaly tag
  const anomalyTag = sd.anomalyDetected
    ? `<span style="background:#fef2f2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">⚠ Anomaly Detected</span>`
    : `<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Normal Range</span>`;

  // Status badge
  let statusBg, statusColor, statusLabel;
  if (r.status === 'Forwarded to Finance') {
    statusBg = '#dbeafe'; statusColor = '#1e40af'; statusLabel = 'Pending Review';
  } else {
    statusBg = '#d1fae5'; statusColor = '#065f46'; statusLabel = 'Cost Impact Added';
  }

  // Validation timestamp (from SO)
  const validatedAt = r.validatedAt
    ? new Date(r.validatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  let costImpactHTML = '';
  if (r.costImpact) {
    const ci = r.costImpact;
    const payback = ci.projectedSavings > 0 ? (ci.remediationCost / ci.projectedSavings) : null;
    const roi = ci.remediationCost > 0 ? (((ci.projectedSavings - ci.remediationCost) / ci.remediationCost) * 100) : null;
    costImpactHTML = `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin-top:14px;">
        <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#92400e;margin:0 0 10px 0;">Cost Impact (Added)</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div>
            <div style="font-size:11px;color:#6b7280;">Est. Financial Loss</div>
            <div style="font-size:16px;font-weight:700;color:#dc2626;">${formatCurrency(ci.estimatedLoss)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#6b7280;">Remediation Cost</div>
            <div style="font-size:16px;font-weight:700;color:#111827;">${formatCurrency(ci.remediationCost)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#6b7280;">Projected Savings</div>
            <div style="font-size:16px;font-weight:700;color:#059669;">${formatCurrency(ci.projectedSavings)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;padding-top:10px;border-top:1px dashed #fde68a;">
          <div>
            <div style="font-size:11px;color:#6b7280;">ROI</div>
            <div style="font-size:16px;font-weight:700;color:${roi !== null && roi >= 0 ? '#059669' : '#dc2626'};">${roi !== null ? roi.toFixed(1) + '%' : '—'}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#6b7280;">Payback Period</div>
            <div style="font-size:16px;font-weight:700;color:#1e40af;">${payback !== null ? payback.toFixed(1) + ' yrs' : '—'}</div>
          </div>
        </div>
        ${ci.notes ? `<div style="margin-top:8px;font-size:12px;color:#6b7280;font-style:italic;">${ci.notes}</div>` : ''}
      </div>`;
  }

  // Revision request from SO (shown when report is sent back)
  let revisionHTML = '';
  if (r.revisionRequest && r.status === 'Forwarded to Finance') {
    const rr = r.revisionRequest;
    revisionHTML = `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-top:14px;">
        <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#991b1b;margin:0 0 8px 0;">⚠ Revision Requested by SO</h4>
        <p style="font-size:13px;color:#374151;margin:0 0 4px 0;line-height:1.5;">${rr.reason}</p>
        ${rr.notes ? `<p style="font-size:12px;color:#6b7280;margin:0;font-style:italic;">Note: "${rr.notes}"</p>` : ''}
        <div style="margin-top:6px;font-size:11px;color:#9ca3af;">Requested at ${rr.requestedAt ? new Date(rr.requestedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
      </div>`;
  }

  // Action buttons
  let actionsHTML = '';
  if (r.status === 'Forwarded to Finance') {
    actionsHTML = `
      <button onclick="window._openCostImpactModal('${r.id}')" style="flex:1;padding:8px 16px;border-radius:6px;border:none;background:#111827;color:white;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">💰 Add Cost Impact</button>`;
  } else if (r.status === 'Cost Impact Added') {
    actionsHTML = `
      <button onclick="window._openCostImpactModal('${r.id}')" style="padding:8px 16px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#374151;font-size:12px;font-weight:600;cursor:pointer;transition:background .2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">✏ Edit Cost Impact</button>
      <button onclick="window._sendBackToSO('${r.id}')" style="flex:1;padding:8px 16px;border-radius:6px;border:none;background:#059669;color:white;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">← Return to Sustainability Officer</button>`;
  }

  return `
  <div style="background:#fdfdfd;border:1px solid #e5e7eb;border-left:4px solid ${color};border-radius:10px;padding:20px;margin-bottom:14px;transition:box-shadow .2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseout="this.style.boxShadow='none'">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:${color}">${icon}</span>
        <strong style="font-size:14px;color:#111827;">#${r.id}</strong>
        <span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${r.type} Wastage</span>
        <span style="font-size:12px;color:#9ca3af;">by ${r.reporterName || 'End User'}</span>
      </div>
      <span style="background:${statusBg};color:${statusColor};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${statusLabel}</span>
    </div>

    <!-- Two-column: User Observation + Sensor Data -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;">
      <!-- User Observation -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
        <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin:0 0 10px 0;">User Observation</h4>
        <p style="font-size:13px;color:#374151;margin:0 0 6px 0;line-height:1.5;">${userSummary}</p>
        <div style="font-size:12px;color:#6b7280;display:flex;align-items:center;gap:4px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${userLocation}
        </div>
        <div style="margin-top:6px;">
          <span style="font-size:11px;padding:2px 6px;border-radius:4px;font-weight:600;background:${r.priority === 'High' ? '#fef2f2;color:#991b1b' : r.priority === 'Medium' ? '#fffbeb;color:#92400e' : '#f0fdf4;color:#166534'}">${r.priority || 'Normal'} Priority</span>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#9ca3af;">Validated by SO: ${validatedAt}</div>
      </div>

      <!-- System Sensor Data -->
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px;">
        <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#0369a1;margin:0 0 10px 0;">${r.type === 'Food' ? 'Wastage Assessment' : r.type === 'Water' ? 'Flow Monitoring' : r.type === 'Emissions' ? 'Emissions Monitoring' : 'Energy Meter Reading'} (${sd.sensorId || '—'})</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <div style="font-size:11px;color:#6b7280;">Current</div>
            <div style="font-size:18px;font-weight:700;color:#111827;">${sd.readingValue || '—'} <small style="font-size:12px;">${sd.readingUnit || ''}</small></div>
          </div>
          <div>
            <div style="font-size:11px;color:#6b7280;">Baseline</div>
            <div style="font-size:18px;font-weight:700;color:#6b7280;">${sd.baselineValue || '—'} <small style="font-size:12px;">${sd.readingUnit || ''}</small></div>
          </div>
        </div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
          ${anomalyTag}
          <span style="font-size:11px;color:#6b7280;">Confidence: ${sd.confidence ? (sd.confidence * 100).toFixed(0) + '%' : '—'}</span>
        </div>
        <div style="margin-top:4px;font-size:11px;color:#9ca3af;">${sd.deviation ? sd.deviation + '% above baseline' : ''}</div>
      </div>
    </div>

    ${costImpactHTML}
    ${revisionHTML}

    <!-- Comment Thread -->
    ${(() => {
        const comments = r.comments || [];
        const commentListHTML = comments.map(c => {
            const roleBadge = c.role === 'Sustainability Officer' ? 'SO' : c.role === 'Finance Analyst' ? 'FA' : 'CV';
            const roleBg = c.role === 'Sustainability Officer' ? '#059669' : c.role === 'Finance Analyst' ? '#6366f1' : '#6b7280';
            return `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6;">
                <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${roleBg};color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${roleBadge}</div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:12px;font-weight:600;color:#111827;">${c.author}</span><span style="font-size:10px;color:#9ca3af;">${new Date(c.timestamp).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span></div>
                    <p style="font-size:12px;color:#374151;margin:2px 0 0 0;line-height:1.5;">${c.text}</p>
                </div>
            </div>`;
        }).join('');
        return `
        <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;" onclick="const el=this.nextElementSibling;el.style.display=el.style.display==='none'?'block':'none';this.querySelector('.cmt-toggle').textContent=el.style.display==='none'?'Show':'Hide';">
                <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#6b7280;font-weight:600;">Comments (${comments.length})</span>
                <span class="cmt-toggle" style="font-size:11px;color:#059669;font-weight:600;">Show</span>
            </div>
            <div style="display:none;">
                ${commentListHTML || '<p style="font-size:12px;color:#9ca3af;margin:8px 0;">No comments yet.</p>'}
                <div style="display:flex;gap:8px;margin-top:8px;">
                    <input type="text" id="fa-cmt-${r.id}" placeholder="Add a comment..." style="flex:1;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;color:#1f2937;">
                    <button onclick="window._addFAComment('${r.id}')" style="padding:6px 12px;border-radius:6px;border:none;background:#111827;color:white;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">Send</button>
                </div>
            </div>
        </div>`;
    })()}

    <!-- Actions -->
    <div style="display:flex;gap:8px;align-items:center;margin-top:14px;">
      ${actionsHTML}
      <span style="margin-left:auto;font-size:11px;color:#9ca3af;">${r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
    </div>
  </div>`;
}

// Finance Comment Handler
window._addFAComment = function (reportId) {
    const input = document.getElementById(`fa-cmt-${reportId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const reports = _readWastageReports();
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    if (!report.comments) report.comments = [];
    report.comments.push({
        author: currentUser.name || 'Finance Analyst',
        role: 'Finance Analyst',
        text: text,
        timestamp: new Date().toISOString()
    });
    _writeWastageReports(reports);
    renderWastageReviewQueue();
};

/* ── Cost Impact Modal ────────────────────────────── */

window._openCostImpactModal = function(reportId) {
  const allReports = _readWastageReports();
  const report = allReports.find(r => r.id === reportId);
  if (!report) return;

  const existing = report.costImpact || {};

  const bodyHTML = `
    <div style="margin-bottom:6px;font-size:13px;color:#6b7280;">Add financial figures for <strong>${report.type} Wastage Report #${report.id}</strong></div>
    <div class="fm-group">
      <label>Estimated Financial Loss (₹) *</label>
      <input type="number" id="ci-loss" min="0" step="0.01" placeholder="e.g. 12500" value="${existing.estimatedLoss || ''}">
      <div style="font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.4;">The total projected monetary loss if this wastage continues unchecked over a year. Include direct resource costs, operational inefficiency, and any regulatory penalties.</div>
    </div>
    <div class="fm-group">
      <label>Remediation Cost (₹) *</label>
      <input type="number" id="ci-remediation" min="0" step="0.01" placeholder="e.g. 3200" value="${existing.remediationCost || ''}">
      <div style="font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.4;">One-time expenditure required to fix the root cause — e.g. equipment repair, process redesign, staff training, or infrastructure upgrades.</div>
    </div>
    <div class="fm-group">
      <label>Projected Annual Savings (₹) *</label>
      <input type="number" id="ci-savings" min="0" step="0.01" placeholder="e.g. 8400" value="${existing.projectedSavings || ''}">
      <div style="font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.4;">Expected yearly savings after remediation. This is the difference between current wastage cost and the projected cost after implementing corrective measures.</div>
    </div>
    <div class="fm-group">
      <label>Notes (optional)</label>
      <textarea id="ci-notes" rows="3" style="padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;color:#1f2937;resize:vertical;font-family:inherit;" placeholder="Any additional context, assumptions, or justification...">${existing.notes || ''}</textarea>
    </div>
  `;

  openModal({
    title: '💰 Add Cost Impact Assessment',
    bodyHTML,
    confirmLabel: 'Save Cost Impact',
    cancelLabel: 'Cancel',
    onConfirm: () => {
      const lossVal   = document.getElementById('ci-loss')?.value?.trim();
      const remVal    = document.getElementById('ci-remediation')?.value?.trim();
      const savVal    = document.getElementById('ci-savings')?.value?.trim();
      const notesVal  = document.getElementById('ci-notes')?.value?.trim();

      // Validate required fields
      const rules = {
        loss: { required: true, positiveNumber: true },
        remediation: { required: true, positiveNumber: true },
        savings: { required: true, positiveNumber: true }
      };
      const result = validateForm(
        { loss: lossVal, remediation: remVal, savings: savVal },
        rules
      );
      if (!result.valid) {
        const firstError = Object.values(result.errors)[0];
        showToast(firstError || 'Please fill all required fields.', 'warning');
        return false; // prevent modal close
      }

      // Attach cost impact to the report
      const freshReports = _readWastageReports();
      const target = freshReports.find(r => r.id === reportId);
      if (!target) return;

      target.costImpact = {
        estimatedLoss: parseFloat(lossVal),
        remediationCost: parseFloat(remVal),
        projectedSavings: parseFloat(savVal),
        roi: parseFloat(remVal) > 0 ? +(((parseFloat(savVal) - parseFloat(remVal)) / parseFloat(remVal)) * 100).toFixed(1) : 0,
        paybackPeriod: parseFloat(savVal) > 0 ? +(parseFloat(remVal) / parseFloat(savVal)).toFixed(2) : 0,
        notes: notesVal || '',
        addedBy: 'Finance Analyst',
        addedAt: new Date().toISOString()
      };
      target.status = 'Cost Impact Added';

      _writeWastageReports(freshReports);
      showToast('Cost impact saved. Review and return to SO when ready.', 'success');
      notifyOnStateChange(target, 'cost_added', 'Finance Analyst');
      renderBellIcon('notif-container', currentUser.email);
      renderWastageReviewQueue();
    }
  });
};

/* ── Send Back to SO ──────────────────────────────── */

window._sendBackToSO = function(reportId) {
  const freshReports = _readWastageReports();
  const target = freshReports.find(r => r.id === reportId);
  if (!target) return;

  if (!target.costImpact) {
    showToast('Please add cost impact figures before returning.', 'warning');
    return;
  }

  target.status = 'Returned to SO';
  target.returnedAt = new Date().toISOString();

  _writeWastageReports(freshReports);
  showToast('Report sent back to Sustainability Officer with cost figures.', 'success');
  notifyOnStateChange(target, 'returned_to_so', 'Finance Analyst');
  renderBellIcon('notif-container', currentUser.email);
  renderWastageReviewQueue();
};
