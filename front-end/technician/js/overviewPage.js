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
        showToast('Work order verified and closed.', 'success');
    }
};
