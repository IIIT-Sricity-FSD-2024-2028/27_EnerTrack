/**
 * overviewPage.js
 * Handles rendering dynamic state for Sust Overview page.
 */
import SustDB from './data/mockData.js';
import SessionModule from './modules/session.js';
import { injectIcons } from './utils/icons.js';

document.addEventListener("DOMContentLoaded", () => {
    SessionModule.initSession();
    injectIcons();
    renderOverview();
});

function renderOverview() {
    // 1. Update Core Metrics
    setText("val-energy", SustDB.metrics.energyConsumed, " <small>GWh</small>");
    setText("val-water", SustDB.metrics.waterUsage, " <small>ML</small>");
    setText("val-emissions", SustDB.metrics.emissions, " <small>tCO₂e</small>");
    
    // Dynamic Initiatives Count
    const activeInitsCount = SustDB.initiatives.filter(i => i.status !== "completed").length;
    setText("val-initiatives", activeInitsCount);

    // 2. Update Quick Stats
    setText("stat-sites", SustDB.metrics.reportingSites);
    setText("stat-alerts", SustDB.metrics.alertsResolved);
    setText("stat-progress", SustDB.metrics.reductionProgress + "%");
    setText("stat-review", SustDB.metrics.nextReviewDays + " days");
}

function setText(id, value, fallbackSuffix = "") {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = value + fallbackSuffix;
}
