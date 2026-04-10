/**
 * overviewPage.js
 * Handles rendering dynamic state for Sust Overview page.
 */
import SustDB from './data/mockData.js';
import SessionModule from './modules/session.js';
import { injectIcons } from './utils/icons.js';

import { showToast, openModal } from './utils/utils.js';

document.addEventListener("DOMContentLoaded", () => {
    SessionModule.initSession();
    injectIcons();
    renderOverview();
    wirePeriodSelector();
    renderRecentHighlights();
    renderWastageAuditQueue();

    // Auto-refresh queue if another tab (End User) submits a report
    window.addEventListener('storage', (e) => {
        if (e.key === 'enertrack_universal_v1') {
            renderWastageAuditQueue();
        }
    });
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
    // const highlights = SustDB.data.highlights || [];
    const highlights = SustDB?.data?.highlights || [];
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

/* ── Wastage Audit Queue (Steps 6-8) ──────────────── */

function renderWastageAuditQueue() {
    const container = document.getElementById('wastageAuditContainer');
    const countBadge = document.getElementById('wastageQueueCount');
    const section = document.getElementById('wastageAuditSection');
    if (!container) return;

    // const reports = SustDB.wastageReports;
    // const raw = localStorage.getItem('enertrack_universal_v1');
    // alert("DIAGNOSTIC: Queue has " + (reports ? reports.length : 0) + " items. localStorage len = " + (raw ? raw.length : "NULL"));
    const raw = localStorage.getItem('enertrack_universal_v1');
    const universalData = raw ? JSON.parse(raw) : null;
    const reports = universalData?.workflow?.wastageReports || [];

    const pendingReports = reports.filter(r => r.status === 'Reported' || r.status === 'Validated');
    const allActionable = reports.filter(r => r.status !== 'Dismissed');

    if (countBadge) countBadge.textContent = `${pendingReports.length} pending`;

    if (allActionable.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:32px;color:#9ca3af;font-size:14px;border:2px dashed #e5e7eb;border-radius:10px;">No wastage reports have been submitted yet.</div>`;
        return;
    }

    const TYPE_COLORS = { Energy: '#f59e0b', Water: '#3b82f6', Emissions: '#8b5cf6', Food: '#ef4444' };
    const TYPE_ICONS = {
        Energy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        Water: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
        Emissions: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 18l4-8 4 8"/><path d="M3 20h18"/><path d="M12 2v4"/></svg>',
        Food: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>'
    };

    container.innerHTML = allActionable.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(r => {
        const color = TYPE_COLORS[r.type] || '#6b7280';
        const icon = TYPE_ICONS[r.type] || '';
        const sd = r.systemData || {};
        const spec = r.specificData || {};

        // Derive user observation summary
        let userSummary = '';
        let userLocation = '';
        if (r.type === 'Energy') { userSummary = spec.observation || '—'; userLocation = spec.building || '—'; }
        else if (r.type === 'Water') { userSummary = spec.nature || '—'; userLocation = spec.location || '—'; }
        else if (r.type === 'Emissions') { userSummary = spec.observation || '—'; userLocation = spec.location || '—'; }
        else if (r.type === 'Food') { userSummary = `${spec.typeOfWastage || '—'} (~${spec.estimatedAmount || '?'}kg)`; userLocation = spec.cafeteria || '—'; }

        // Status styling
        let statusBg = '#fef3c7'; let statusColor = '#92400e'; let statusLabel = r.status;
        if (r.status === 'Validated') { statusBg = '#dcfce7'; statusColor = '#166534'; }
        else if (r.status === 'Forwarded to Finance') { statusBg = '#dbeafe'; statusColor = '#1e40af'; }
        else if (r.status === 'Cost Impact Added') { statusBg = '#e0e7ff'; statusColor = '#3730a3'; statusLabel = 'Cost Impact Added (at Finance)'; }
        else if (r.status === 'Returned to SO') { statusBg = '#fef3c7'; statusColor = '#92400e'; statusLabel = 'Returned with Cost Data'; }
        else if (r.status === 'Finalized') { statusBg = '#d1fae5'; statusColor = '#065f46'; }
        else if (r.status === 'Target Set') { statusBg = '#dbeafe'; statusColor = '#1e40af'; statusLabel = '✓ Target Set'; }
        else if (r.status === 'Dismissed') { statusBg = '#f1f5f9'; statusColor = '#475569'; }

        // Cost impact display (from Finance Analyst — Steps 13)
        let costImpactHTML = '';
        if (r.costImpact && (r.status === 'Returned to SO' || r.status === 'Finalized' || r.status === 'Target Set')) {
            const ci = r.costImpact;
            const formatCurr = (v) => '$' + Number(v).toLocaleString();
            costImpactHTML = `
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin-bottom:14px;">
                <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#92400e;margin:0 0 10px 0;">💰 Finance Cost Impact Assessment</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Est. Financial Loss</div>
                        <div style="font-size:16px;font-weight:700;color:#dc2626;">${formatCurr(ci.estimatedLoss)}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Remediation Cost</div>
                        <div style="font-size:16px;font-weight:700;color:#111827;">${formatCurr(ci.remediationCost)}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Projected Savings</div>
                        <div style="font-size:16px;font-weight:700;color:#059669;">${formatCurr(ci.projectedSavings)}</div>
                    </div>
                </div>
                ${ci.notes ? `<div style="margin-top:8px;font-size:12px;color:#6b7280;font-style:italic;">"${ci.notes}"</div>` : ''}
                <div style="margin-top:6px;font-size:11px;color:#9ca3af;">Added by ${ci.addedBy || 'Finance'} • ${ci.addedAt ? new Date(ci.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>`;
        }

        // Metric target display (from Step 15)
        let targetHTML = '';
        if (r.metricTarget && r.status === 'Target Set') {
            const mt = r.metricTarget;
            targetHTML = `
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin-bottom:14px;">
                <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#1e40af;margin:0 0 8px 0;">🎯 New Metric Target</h4>
                <div style="display:flex;gap:20px;align-items:center;">
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Target Value</div>
                        <div style="font-size:18px;font-weight:700;color:#1e40af;">${mt.value} <small>${mt.unit}</small></div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Deadline</div>
                        <div style="font-size:14px;font-weight:600;color:#374151;">${new Date(mt.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                </div>
                ${mt.justification ? `<div style="margin-top:6px;font-size:12px;color:#6b7280;">"${mt.justification}"</div>` : ''}
            </div>`;
        }

        // Action buttons (only for actionable statuses)
        let actionsHTML = '';
        if (r.status === 'Reported') {
            actionsHTML = `
                <button onclick="window._auditAction('${r.id}','validate')" style="padding:6px 14px;border-radius:6px;border:none;background:#059669;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">✓ Validate</button>
                <button onclick="window._auditAction('${r.id}','dismiss')" style="padding:6px 14px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#6b7280;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">✗ Dismiss</button>`;
        } else if (r.status === 'Validated') {
            actionsHTML = `
                <button onclick="window._auditAction('${r.id}','forward')" style="padding:6px 14px;border-radius:6px;border:none;background:#3b82f6;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">→ Forward to Finance</button>`;
        } else if (r.status === 'Returned to SO') {
            actionsHTML = `
                <button onclick="window._finalizeReport('${r.id}')" style="padding:8px 16px;border-radius:6px;border:none;background:#111827;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">✓ Finalize Report</button>
                <button onclick="window._openTargetModal('${r.id}')" style="padding:8px 16px;border-radius:6px;border:none;background:#2563eb;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">🎯 Set New Target</button>`;
        } else if (r.status === 'Finalized') {
            actionsHTML = `
                <button onclick="window._openTargetModal('${r.id}')" style="padding:8px 16px;border-radius:6px;border:none;background:#2563eb;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">🎯 Set New Target</button>`;
        }

        const anomalyTag = sd.anomalyDetected
            ? `<span style="background:#fef2f2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">⚠ Anomaly Detected</span>`
            : `<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Normal Range</span>`;

        return `
        <div style="background:#fdfdfd;border:1px solid #e5e7eb;border-left:4px solid ${color};border-radius:10px;padding:20px;margin-bottom:14px;transition:box-shadow .2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseout="this.style.boxShadow='none'">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:${color}">${icon}</span>
                    <strong style="font-size:14px;color:#111827;">#${r.id}</strong>
                    <span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${r.type} Wastage</span>
                    <span style="font-size:12px;color:#9ca3af;">by ${r.reporterName}</span>
                </div>
                <span style="background:${statusBg};color:${statusColor};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${statusLabel}</span>
            </div>

            ${costImpactHTML}
            ${targetHTML}

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
                        <span style="font-size:11px;padding:2px 6px;border-radius:4px;font-weight:600;background:${r.priority === 'High' ? '#fef2f2;color:#991b1b' : r.priority === 'Medium' ? '#fffbeb;color:#92400e' : '#f0fdf4;color:#166534'}">${r.priority} Priority</span>
                    </div>
                </div>

                <!-- System Sensor Data -->
                <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px;">
                    <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#0369a1;margin:0 0 10px 0;">Sensor Reading (${sd.sensorId || '—'})</h4>
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

            <div style="display:flex;gap:8px;align-items:center;">
                ${actionsHTML}
                <span style="margin-left:auto;font-size:11px;color:#9ca3af;">${new Date(r.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>`;
    }).join('');
}

// Global action handler for audit buttons
// window._auditAction = function (reportId, action) {
//     if (action === 'validate') {
//         SustDB.updateWastageReport(reportId, { status: 'Validated', validatedAt: new Date().toISOString() });
//         SustDB.addHighlight('Wastage Report Validated', `Report #${reportId} confirmed by Sustainability Officer.`, 'green');
//         showToast('Report validated successfully.', 'success', 2000);
//     } else if (action === 'dismiss') {
//         SustDB.updateWastageReport(reportId, { status: 'Dismissed', dismissedAt: new Date().toISOString() });
//         SustDB.addHighlight('Wastage Report Dismissed', `Report #${reportId} dismissed as false alarm.`, 'gray');
//         showToast('Report dismissed.', 'info', 2000);
//     } else if (action === 'forward') {
//         SustDB.updateWastageReport(reportId, { status: 'Forwarded to Finance', forwardedAt: new Date().toISOString() });
//         SustDB.addHighlight('Report Forwarded to Finance', `Report #${reportId} sent for cost impact analysis.`, 'blue');
//         showToast('Report forwarded to Finance Analyst.', 'success', 2000);
//     }
//     renderWastageAuditQueue();
//     renderRecentHighlights();
// };

window._auditAction = function (reportId, action) {
    const raw = localStorage.getItem('enertrack_universal_v1');
    if (!raw) return;
    const universalData = JSON.parse(raw);
    const reports = universalData.workflow.wastageReports || [];
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    if (action === 'validate') {
        report.status = 'Validated';
        report.validatedAt = new Date().toISOString();
        showToast('Report validated successfully.', 'success', 2000);
    } else if (action === 'dismiss') {
        report.status = 'Dismissed';
        report.dismissedAt = new Date().toISOString();
        showToast('Report dismissed.', 'info', 2000);
    } else if (action === 'forward') {
        report.status = 'Forwarded to Finance';
        report.forwardedAt = new Date().toISOString();
        showToast('Report forwarded to Finance Analyst.', 'success', 2000);
    }

    localStorage.setItem('enertrack_universal_v1', JSON.stringify(universalData));
    renderWastageAuditQueue();
    renderRecentHighlights();
};

/* ══════════════════════════════════════════════════════
   Steps 13-15: SO Finalization & Target Setting
   ══════════════════════════════════════════════════════ */

/* ── Step 14: Finalize Report ─────────────────────── */

window._finalizeReport = function (reportId) {
    const raw = localStorage.getItem('enertrack_universal_v1');
    if (!raw) return;
    const universalData = JSON.parse(raw);
    const reports = universalData.workflow.wastageReports || [];
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    report.status = 'Finalized';
    report.finalizedAt = new Date().toISOString();
    report.finalizedBy = 'Sustainability Officer';

    localStorage.setItem('enertrack_universal_v1', JSON.stringify(universalData));

    // Add highlight
    SustDB.addHighlight(
        'Wastage Report Finalized',
        `Report #${reportId} (${report.type}) finalized with Finance cost-impact data.`,
        'green'
    );

    showToast('Report finalized and archived.', 'success', 2500);
    renderWastageAuditQueue();
    renderRecentHighlights();
};

/* ── Step 15: Set New Metric Target ───────────────── */

const METRIC_UNITS = { Energy: 'GWh', Water: 'ML', Emissions: 'tCO₂e', Food: 'kg' };
const METRIC_FIELDS = { Energy: 'energyConsumed', Water: 'waterUsage', Emissions: 'emissions', Food: null };

window._openTargetModal = function (reportId) {
    const raw = localStorage.getItem('enertrack_universal_v1');
    if (!raw) return;
    const universalData = JSON.parse(raw);
    const reports = universalData.workflow.wastageReports || [];
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    const metricType = report.type || 'Energy';
    const unit = METRIC_UNITS[metricType] || 'units';
    const metricField = METRIC_FIELDS[metricType];
    const currentValue = metricField ? (universalData.sust?.metrics?.[metricField] || '—') : '—';
    const existing = report.metricTarget || {};

    // Build today's date string for min attribute
    const todayStr = new Date().toISOString().split('T')[0];

    const bodyHTML = `
        <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:14px;">
                <div>
                    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Current ${metricType} Value</div>
                    <div style="font-size:22px;font-weight:700;color:#059669;">${currentValue} <small style="font-size:13px;">${unit}</small></div>
                </div>
                <div style="font-size:12px;color:#6b7280;text-align:right;">Report #${report.id}<br>${report.type} Wastage</div>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">New Target Value (${unit}) *</label>
                <input type="number" id="mt-value" min="0" step="0.01" placeholder="e.g. ${metricType === 'Energy' ? '4.2' : metricType === 'Water' ? '16.0' : '1100'}" value="${existing.value || ''}" style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Target Deadline *</label>
                <input type="date" id="mt-deadline" min="${todayStr}" value="${existing.deadline || ''}" style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Justification (optional)</label>
                <textarea id="mt-justification" rows="2" placeholder="Based on Finance cost-impact analysis..." style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;resize:vertical;font-family:inherit;box-sizing:border-box;">${existing.justification || ''}</textarea>
            </div>
        </div>
    `;

    openModal({
        title: '🎯 Set New ' + metricType + ' Target',
        bodyHTML,
        confirmLabel: 'Set Target',
        cancelLabel: 'Cancel',
        onConfirm: () => {
            const valueStr = document.getElementById('mt-value')?.value?.trim();
            const deadline = document.getElementById('mt-deadline')?.value?.trim();
            const justification = document.getElementById('mt-justification')?.value?.trim();

            // Validate
            if (!valueStr || isNaN(Number(valueStr)) || Number(valueStr) <= 0) {
                showToast('Please enter a valid positive target value.', 'warning');
                return false; // modal stays open
            }
            if (!deadline) {
                showToast('Please select a target deadline.', 'warning');
                return false;
            }

            // Re-read fresh from storage
            const freshRaw = localStorage.getItem('enertrack_universal_v1');
            if (!freshRaw) return;
            const freshData = JSON.parse(freshRaw);
            const freshReports = freshData.workflow.wastageReports || [];
            const target = freshReports.find(r => r.id === reportId);
            if (!target) return;

            // Save target to report
            target.metricTarget = {
                value: parseFloat(valueStr),
                unit: unit,
                deadline: deadline,
                justification: justification || '',
                setAt: new Date().toISOString()
            };
            target.status = 'Target Set';
            target.targetSetAt = new Date().toISOString();

            // Update system-wide metrics if applicable (Step 16-17 system behavior)
            if (metricField && freshData.sust?.metrics) {
                // Store the reduction target as a dedicated field
                freshData.sust.metrics[metricField + 'Target'] = parseFloat(valueStr);
                freshData.sust.metrics[metricField + 'TargetDeadline'] = deadline;
            }

            localStorage.setItem('enertrack_universal_v1', JSON.stringify(freshData));

            // Highlight
            SustDB.addHighlight(
                `New ${metricType} Target Set`,
                `Target: ${valueStr} ${unit} by ${new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (Report #${reportId}).`,
                'blue'
            );

            showToast(`${metricType} target set to ${valueStr} ${unit}.`, 'success', 2500);
            renderWastageAuditQueue();
            renderRecentHighlights();
        }
    });
};
