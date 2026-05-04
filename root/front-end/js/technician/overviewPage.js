/**
 * overviewPage.js
 * Handles interactivity for the Technician Overview page.
 */
import TechDB from './data/mockData.js';
import { showToast } from './utils/utils.js';

document.addEventListener("DOMContentLoaded", () => {
    try {
        initOverview();
        initWorkflow1();
        initActiveWorkOrders();
        console.log("TechOverview: Initialized.");
    } catch (err) {
        console.error("TechOverview: Init error:", err);
    }
});

function initOverview() {
    const s = TechDB.summary;
    const feed = TechDB.feed;

    // Populate stat cards
    setEl('statActiveAlerts',      s.activeAlerts);
    setEl('statOpenFaults',        s.openFaults);
    setEl('statPendingWorkOrders', s.pendingWorkOrders);
    setEl('statResolvedToday',     s.resolvedToday);

    // Populate feed
    const feedList = document.getElementById('activityFeed');
    if (feedList && feed.length) {
        feedList.innerHTML = feed.map(item => `
            <div class="feed-item">
                <div class="feed-icon ${item.type}">${item.icon}</div>
                <div class="feed-content">
                    <div class="feed-title">${item.title}</div>
                    <div class="feed-desc">${item.desc}</div>
                </div>
                <div class="feed-time">${item.time}</div>
            </div>
        `).join('');
    }

    // Open Queue button
    document.getElementById('btnOpenQueue')?.addEventListener('click', () => {
        window.location.href = 'technician_work_orders.html';
    });
}

function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ── TECH ADMIN: TRIAGE & DISPATCH ──────────────────────
function initWorkflow1() {
    const srs = TechDB.serviceRequests;
    const technicians = TechDB.technicians;

    // Triage Feed logic has been migrated to Maintenance Work Orders.

    // Verify Feed — items completed by technician
    const pendingVerifySRs = srs.filter(sr => sr.status === 'Work Complete (Awaiting Validation)');
    const pendingVerifyWOs = TechDB.workOrders.filter(wo => wo.status === 'review');
    const verifyFeed    = document.getElementById('verifyFeed');

    if (verifyFeed) {
        if (pendingVerifySRs.length === 0 && pendingVerifyWOs.length === 0) {
            verifyFeed.innerHTML = '<div style="padding:16px;color:#6b7280;font-size:14px;">No completed jobs awaiting verification.</div>';
        } else {
            let html = '';
            
            html += pendingVerifySRs.map(sr => `
                <div style="padding:16px;border-bottom:1px solid var(--border);">
                    <h4 style="margin:0 0 4px;">${sr.id} — ${sr.location} (${sr.category})</h4>
                    <p style="margin:0 0 8px;font-size:13px;color:#555;">
                        Completed by <strong>${sr.assignedTo || 'Technician'}</strong>. Awaiting quality check.
                    </p>
                    <button class="btn btn-dark" onclick="verifyJob('${sr.id}')">
                        Verify & Authorize Payment
                    </button>
                </div>
            `).join('');

            html += pendingVerifyWOs.map(wo => `
                <div style="padding:16px;border-bottom:1px solid var(--border);">
                    <h4 style="margin:0 0 4px;">${wo.id} — ${wo.title} (${wo.type})</h4>
                    <p style="margin:0 0 8px;font-size:13px;color:#555;">
                        Completed by <strong>${wo.technician || 'Technician'}</strong>. Awaiting quality check.
                    </p>
                    <button class="btn btn-dark" onclick="verifyWO('${wo.id}')">
                        Verify & Close Work Order
                    </button>
                </div>
            `).join('');

            verifyFeed.innerHTML = html;
        }
    }
}



window.verifyJob = function(id) {
    const sr = TechDB.serviceRequests.find(s => s.id === id);
    if (sr) {
        sr.status = 'Validated (Awaiting Payment)';
        TechDB.save();
        initWorkflow1();
        showToast('Work verified. Sent to Financial Analyst for payment.', 'success');
    }
};

window.verifyWO = function(id) {
    const wo = TechDB.workOrders.find(w => w.id === id);
    if (wo) {
        TechDB.closeWorkOrder(id);
        initWorkflow1();
        initOverview(); // Update stats
        initActiveWorkOrders(); // Refresh list
        showToast('Work order verified and closed.', 'success');
    }
};

function initActiveWorkOrders() {
    const list = document.getElementById('activeWOsList');
    if (!list) return;

    // Filter for work orders that are NOT closed/archived
    const active = TechDB.workOrders.filter(wo => wo.status !== 'closed');

    if (active.length === 0) {
        list.parentElement.style.display = 'none';
        return;
    }

    list.parentElement.style.display = 'block';
    
    list.innerHTML = active.slice(0, 6).map(wo => `
        <div style="padding:14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 6px;">
                <span style="font-size:12px; font-weight:700; color:#111827;">${wo.id}</span>
                <span class="badge ${wo.status === 'new' ? 'new' : wo.status === 'review' ? 'review' : 'inprogress'}" style="font-size:10px;">${wo.status.toUpperCase()}</span>
            </div>
            <h4 style="margin:0 0 4px; font-size:13px; color:#111827; line-height:1.4;">${wo.title}</h4>
            <div style="font-size:11px; color:#6b7280; display:flex; align-items:center; gap:8px; margin-top:8px;">
                <span style="display:inline-flex; align-items:center; gap:3px;">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${wo.technician || 'Unassigned'}
                </span>
                <span style="display:inline-flex; align-items:center; gap:3px; color:${wo.priority === 'high' ? '#b91c1c' : '#6b7280'}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    ${wo.priority}
                </span>
            </div>
        </div>
    `).join('');
}
