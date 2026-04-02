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
    wirePeriodSelector();
    renderRecentHighlights();
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

/* ── Period Selector for Overview Chart ───────────── */

function wirePeriodSelector() {
    const selector = document.getElementById('overviewPeriodSelector');
    if (!selector) return;

    selector.querySelectorAll('.pill-item').forEach(pill => {
        pill.addEventListener('click', () => {
            // Toggle active styles
            selector.querySelectorAll('.pill-item').forEach(p => {
                p.style.background = '#f3f4f6';
                p.style.color = '#6b7280';
                p.style.fontWeight = '500';
                p.classList.remove('active');
            });
            pill.style.background = '#e6f4ec';
            pill.style.color = '#0f9f6f';
            pill.style.fontWeight = '600';
            pill.classList.add('active');

            updateOverviewChart(pill.dataset.period);
        });
    });
}

function updateOverviewChart(period) {
    const history = SustDB.data?.monitoring?.history?.[period];
    if (!history) return;

    const chartContainer = document.querySelector('.chart-container');
    const labelContainer = document.querySelector('.chart-labels');
    if (!chartContainer || !labelContainer) return;

    // Build bar groups dynamically
    const maxE = Math.max(...history.e);
    const maxW = Math.max(...history.w);
    const maxM = Math.max(...history.m);
    const globalMax = Math.max(maxE, maxW, maxM) || 1;

    let groupsHTML = '';
    for (let i = 0; i < history.e.length; i++) {
        const eH = Math.round((history.e[i] / globalMax) * 90);
        const wH = Math.round((history.w[i] / globalMax) * 90);
        const mH = Math.round((history.m[i] / globalMax) * 90);
        groupsHTML += `
            <div class="chart-group">
                <div class="bar energy" style="height: ${eH}%;"></div>
                <div class="bar water" style="height: ${wH}%;"></div>
                <div class="bar emissions" style="height: ${mH}%;"></div>
            </div>`;
    }
    chartContainer.innerHTML = groupsHTML;

    // Update labels
    labelContainer.innerHTML = history.labels.map(l => `<span>${l}</span>`).join('');
}

/* ── Dynamic Recent Highlights ───────────────────── */

function renderRecentHighlights() {
    const container = document.getElementById('global-highlights-list');
    if (!container) return;

    // Must reload latest highlights directly internally 
    const highlights = SustDB.data.highlights || [];
    if (highlights.length === 0) {
        container.innerHTML = `<div class="highlight-item"><p style="color:#6b7280; font-size: 14px; margin: 0;">No recent highlights to show.</p></div>`;
        return;
    }

    // Take the most recent 5
    const recent = highlights.slice(0, 5);
    
    container.innerHTML = recent.map((h, index) => {
        // Simple color mappings
        const colorHex = h.color === 'green' ? '#10b981' : h.color === 'yellow' ? '#f59e0b' : h.color === 'gray' ? '#6b7280' : '#3b82f6';
        
        // Relative time formatting
        const timeStr = new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="highlight-item" style="display:flex; flex-direction:column; gap: 8px; margin-bottom: 12px; border: none; padding: 0;">
                <div style="display:flex; gap: 12px; align-items:flex-start; width: 100%;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${colorHex}; margin-top: 6px; flex-shrink: 0;"></div>
                    <div style="flex-grow: 1;">
                        <h4 style="margin-bottom: 4px; font-size: 14px; font-weight: 600; color: #111827; display: flex; justify-content: space-between; align-items: center;">
                            ${h.title} <span style="font-weight: 400; color: #9ca3af; font-size: 12px; margin-left: 12px;">${timeStr}</span>
                        </h4>
                        <p style="margin: 0; font-size: 13px; color: #4b5563;">${h.desc}</p>
                        
                        <div style="margin-top: 4px;">
                            <button class="btn-mark-read" data-index="${index}">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                                Mark as read
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.btn-mark-read').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const indexStr = e.currentTarget.dataset.index;
            if (indexStr !== undefined) {
                const idx = parseInt(indexStr, 10);
                SustDB.removeHighlightIndex(idx);
                renderRecentHighlights();
            }
        });
    });
}

function setText(id, value, fallbackSuffix = "") {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = value + fallbackSuffix;
}
