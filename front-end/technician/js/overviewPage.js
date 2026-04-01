/**
 * overviewPage.js
 * Handles interactivity for the Technician Overview page.
 */
import TechDB from './data/mockData.js';
import { showToast } from './utils/utils.js';

document.addEventListener("DOMContentLoaded", () => {
    try {
        initOverview();
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
