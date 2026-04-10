/**
 * overviewPage.js
 * Handles rendering dynamic state for Sust Overview page.
 */
import SustDB from './data/mockData.js';
import SessionModule from './modules/session.js';
import { injectIcons } from './utils/icons.js';

import { showToast, openModal } from './utils/utils.js';
import { renderBellIcon, notifyOnStateChange } from '../../shared/notifications.js';

const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

document.addEventListener("DOMContentLoaded", () => {
    SessionModule.initSession();
    injectIcons();
    renderOverview();
    wirePeriodSelector();
    renderRecentHighlights();
    renderWastageAuditQueue();

    // Render notification bell
    renderBellIcon('notif-container', currentUser.email);

    // Auto-refresh queue if another tab (Campus Visitor) submits a report
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

    // Auto-archive any delivered reports that weren't already marked
    let needsSave = false;
    reports.forEach(r => {
        if (r.status === 'Delivered' && !r.soArchived) {
            r.soArchived = true;
            r.soArchivedAt = r.deliveredAt || new Date().toISOString();
            needsSave = true;
        }
    });
    if (needsSave && universalData) {
        localStorage.setItem('enertrack_universal_v1', JSON.stringify(universalData));
    }

    const activeReports = reports.filter(r => !r.soArchived);

    const pendingReports = activeReports.filter(r => r.status === 'Reported' || r.status === 'Validated');
    const allActionable = activeReports.filter(r => r.status !== 'Dismissed');

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
        else if (r.status === 'Delivered') { statusBg = '#d1fae5'; statusColor = '#065f46'; statusLabel = 'Delivered to Campus Visitor'; }

        // Cost impact display (from Finance Analyst — Steps 13)
        let costImpactHTML = '';
        if (r.costImpact && (r.status === 'Returned to SO' || r.status === 'Finalized' || r.status === 'Target Set' || r.status === 'Delivered')) {
            const ci = r.costImpact;
            const formatCurr = (v) => '₹' + Number(v).toLocaleString('en-IN');

            // Green box when target is set or finalized; orange when still pending action
            const isTargetDone = r.status === 'Target Set' || r.status === 'Finalized' || r.status === 'Delivered';
            const boxBg    = isTargetDone ? '#f0fdf4' : '#fffbeb';
            const boxBorder = isTargetDone ? '#bbf7d0' : '#fde68a';
            const headColor = isTargetDone ? '#065f46' : '#92400e';
            const headIcon  = isTargetDone ? '✅' : '💰';
            const headLabel = isTargetDone ? 'Finance Assessment — Resolved' : 'Finance Cost Impact Assessment';

            // Embedded target section (only when target is set)
            let embeddedTargetHTML = '';
            if (r.metricTarget && isTargetDone) {
                const mt = r.metricTarget;
                embeddedTargetHTML = `
                <div style="margin-top:14px;padding-top:14px;border-top:1px dashed ${boxBorder};">
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
                    <div style="margin-top:4px;font-size:11px;color:#9ca3af;">Set at ${mt.setAt ? new Date(mt.setAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                </div>`;
            }

            costImpactHTML = `
            <div style="background:${boxBg};border:1px solid ${boxBorder};border-radius:8px;padding:14px;margin-bottom:14px;">
                <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:${headColor};margin:0 0 10px 0;">${headIcon} ${headLabel}</h4>
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
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;padding-top:10px;border-top:1px dashed ${boxBorder};">
                    <div>
                        <div style="font-size:11px;color:#6b7280;">ROI</div>
                        <div style="font-size:16px;font-weight:700;color:${ci.roi != null && ci.roi >= 0 ? '#059669' : '#dc2626'};">${ci.roi != null ? ci.roi.toFixed(1) + '%' : (ci.projectedSavings && ci.remediationCost ? (((ci.projectedSavings - ci.remediationCost) / ci.remediationCost) * 100).toFixed(1) + '%' : '\u2014')}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Payback Period</div>
                        <div style="font-size:16px;font-weight:700;color:#1e40af;">${ci.paybackPeriod != null ? ci.paybackPeriod.toFixed(1) + ' yrs' : (ci.projectedSavings > 0 ? (ci.remediationCost / ci.projectedSavings).toFixed(1) + ' yrs' : '\u2014')}</div>
                    </div>
                </div>
                ${ci.notes ? `<div style="margin-top:8px;font-size:12px;color:#6b7280;font-style:italic;">"${ci.notes}"</div>` : ''}
                <div style="margin-top:6px;font-size:11px;color:#9ca3af;">Added by ${ci.addedBy || 'Finance'} • ${ci.addedAt ? new Date(ci.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                ${embeddedTargetHTML}
            </div>`;
        }

        // Standalone target display is no longer needed — target is now embedded in cost-impact box
        let targetHTML = '';

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
                <button onclick="window._openTargetModal('${r.id}')" style="padding:8px 16px;border-radius:6px;border:none;background:#2563eb;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">🎯 Set New Target</button>
                <button onclick="window._sendBackToFinance('${r.id}')" style="padding:8px 16px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#6b7280;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">↻ Send Back to Finance</button>`;
        } else if (r.status === 'Target Set') {
            actionsHTML = `
                <button onclick="window._finalizeReport('${r.id}')" style="padding:8px 16px;border-radius:6px;border:none;background:#111827;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">✓ Finalize Report</button>
                <button onclick="window._openTargetModal('${r.id}')" style="padding:8px 16px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#374151;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">🎯 Edit Target</button>`;
        } else if (r.status === 'Finalized') {
            actionsHTML = `
                <button onclick="window._sendReportToUser('${r.id}')" style="padding:8px 16px;border-radius:6px;border:none;background:#059669;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">Send Detailed Report to Campus Visitor</button>`;
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
                            <input type="text" id="so-cmt-${r.id}" placeholder="Add a comment..." style="flex:1;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;color:#1f2937;">
                            <button onclick="window._addSOComment('${r.id}')" style="padding:6px 12px;border-radius:6px;border:none;background:#111827;color:white;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">Send</button>
                        </div>
                    </div>
                </div>`;
            })()}

            <div style="display:flex;gap:8px;align-items:center;">
                ${actionsHTML}
                <span style="margin-left:auto;font-size:11px;color:#9ca3af;">${new Date(r.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>`;
    }).join('');
}

// SO Comment Handler
window._addSOComment = function (reportId) {
    const input = document.getElementById(`so-cmt-${reportId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const raw = localStorage.getItem('enertrack_universal_v1');
    if (!raw) return;
    const data = JSON.parse(raw);
    const report = (data.workflow.wastageReports || []).find(r => r.id === reportId);
    if (!report) return;

    if (!report.comments) report.comments = [];
    report.comments.push({
        author: currentUser.name || 'Sustainability Officer',
        role: 'Sustainability Officer',
        text: text,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('enertrack_universal_v1', JSON.stringify(data));
    renderWastageAuditQueue();
};

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
        localStorage.setItem('enertrack_universal_v1', JSON.stringify(universalData));
        showToast('Report validated successfully.', 'success', 2000);
        notifyOnStateChange(report, 'validated', currentUser.name || 'Sustainability Officer');
        renderBellIcon('notif-container', currentUser.email);
        renderWastageAuditQueue();
        renderRecentHighlights();
    } else if (action === 'dismiss') {
        // Open rejection modal instead of direct dismiss
        openModal({
            title: 'Dismiss Wastage Report',
            bodyHTML: `
                <div style="margin-bottom:6px;font-size:13px;color:#6b7280;">Provide a reason for dismissing <strong>Report #${reportId}</strong>.</div>
                <div class="fm-group">
                    <label>Reason *</label>
                    <select id="dismiss-reason" style="padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;color:#1f2937;background:#fff;">
                        <option value="">Select a reason...</option>
                        <option value="False Alarm">False Alarm</option>
                        <option value="Insufficient Evidence">Insufficient Evidence</option>
                        <option value="Already Addressed">Already Addressed</option>
                        <option value="Out of Scope">Out of Scope</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="fm-group">
                    <label>Explanation *</label>
                    <textarea id="dismiss-comment" rows="3" style="padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;color:#1f2937;resize:vertical;font-family:inherit;" placeholder="Provide details (min. 10 characters)..."></textarea>
                </div>
            `,
            confirmLabel: 'Dismiss Report',
            cancelLabel: 'Cancel',
            danger: true,
            onConfirm: () => {
                const reason = document.getElementById('dismiss-reason')?.value;
                const comment = document.getElementById('dismiss-comment')?.value?.trim();
                if (!reason) {
                    showToast('Please select a reason for dismissal.', 'warning');
                    return false;
                }
                if (!comment || comment.length < 10) {
                    showToast('Explanation must be at least 10 characters.', 'warning');
                    return false;
                }
                // Re-read fresh data to avoid stale writes
                const freshRaw = localStorage.getItem('enertrack_universal_v1');
                if (!freshRaw) return;
                const freshData = JSON.parse(freshRaw);
                const freshReport = (freshData.workflow.wastageReports || []).find(r => r.id === reportId);
                if (!freshReport) return;

                freshReport.status = 'Dismissed';
                freshReport.dismissedAt = new Date().toISOString();
                freshReport.dismissReason = reason;
                freshReport.dismissComment = comment;
                localStorage.setItem('enertrack_universal_v1', JSON.stringify(freshData));
                showToast('Report dismissed with reason.', 'info', 2000);
                notifyOnStateChange(freshReport, 'dismissed', currentUser.name || 'Sustainability Officer');
                renderBellIcon('notif-container', currentUser.email);
                renderWastageAuditQueue();
                renderRecentHighlights();
            }
        });
        return; // Don't fall through to save/render below
    } else if (action === 'forward') {
        report.status = 'Forwarded to Finance';
        report.forwardedAt = new Date().toISOString();
        localStorage.setItem('enertrack_universal_v1', JSON.stringify(universalData));
        showToast('Report forwarded to Finance Analyst.', 'success', 2000);
        notifyOnStateChange(report, 'forwarded', currentUser.name || 'Sustainability Officer');
        renderBellIcon('notif-container', currentUser.email);
        renderWastageAuditQueue();
        renderRecentHighlights();
    }
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

    // Sync in-memory universalDB BEFORE calling addHighlight (which calls universalDB.save)
    localStorage.setItem('enertrack_universal_v1', JSON.stringify(universalData));
    // Re-read into universalDB via the SustDB getter which syncs in-memory data
    void SustDB.wastageReports;

    SustDB.addHighlight(
        'Wastage Report Finalized',
        `Report #${reportId} (${report.type}) finalized with Finance cost-impact data.`,
        'green'
    );

    showToast('Report finalized and archived.', 'success', 2500);
    renderWastageAuditQueue();
    renderRecentHighlights();
};

/* ── Send Back to Finance (with revision notes form) ─ */

window._sendBackToFinance = function (reportId) {
    const bodyHTML = `
        <div style="margin-bottom:6px;font-size:13px;color:#6b7280;">Explain what changes are needed for report <strong>#${reportId}</strong>:</div>
        <div style="margin-bottom:12px;">
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">What needs to be revised? *</label>
            <textarea id="sb-reason" rows="3" placeholder="e.g. The remediation cost seems too high, please re-assess..." style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;resize:vertical;font-family:inherit;box-sizing:border-box;"></textarea>
        </div>
        <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Additional notes (optional)</label>
            <input type="text" id="sb-notes" placeholder="Any extra context..." style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;">
        </div>
    `;

    openModal({
        title: '↻ Send Back to Finance Analyst',
        bodyHTML,
        confirmLabel: 'Send Back',
        cancelLabel: 'Cancel',
        onConfirm: () => {
            const reason = document.getElementById('sb-reason')?.value?.trim();
            const notes = document.getElementById('sb-notes')?.value?.trim();

            if (!reason) {
                showToast('Please explain what changes are needed.', 'warning');
                return false; // keep modal open
            }

            const raw = localStorage.getItem('enertrack_universal_v1');
            if (!raw) return;
            const universalData = JSON.parse(raw);
            const reports = universalData.workflow.wastageReports || [];
            const report = reports.find(r => r.id === reportId);
            if (!report) return;

            // Clear cost-impact data and reset status
            delete report.costImpact;
            delete report.returnedAt;
            report.status = 'Forwarded to Finance';
            report.sentBackAt = new Date().toISOString();
            report.revisionRequest = {
                reason: reason,
                notes: notes || '',
                requestedAt: new Date().toISOString(),
                requestedBy: 'Sustainability Officer'
            };

            localStorage.setItem('enertrack_universal_v1', JSON.stringify(universalData));
            // Sync in-memory cache before addHighlight writes back
            void SustDB.wastageReports;

            SustDB.addHighlight(
                'Report Sent Back to Finance',
                `Report #${reportId} sent back for revision: "${reason.substring(0, 60)}${reason.length > 60 ? '...' : ''}"`,
                'yellow'
            );

            showToast('Report sent back to Finance for revision.', 'warning', 2500);
            renderWastageAuditQueue();
            renderRecentHighlights();
        }
    });
};

/* ── Send Detailed Report to End User ─────────────── */

window._sendReportToUser = function (reportId) {
    const raw = localStorage.getItem('enertrack_universal_v1');
    if (!raw) return;
    const universalData = JSON.parse(raw);
    const reports = universalData.workflow.wastageReports || [];
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    report.status = 'Delivered';
    report.deliveredAt = new Date().toISOString();
    report.deliveredBy = 'Sustainability Officer';
    report.soArchived = true;
    report.soArchivedAt = new Date().toISOString();

    localStorage.setItem('enertrack_universal_v1', JSON.stringify(universalData));
    // Sync in-memory cache before addHighlight writes back
    void SustDB.wastageReports;

    SustDB.addHighlight(
        'Report Delivered to Campus Visitor',
        `Full report for #${reportId} (${report.type}) sent to ${report.reporterName}.`,
        'green'
    );

    showToast('Detailed report delivered to the end user.', 'success', 2500);
    notifyOnStateChange(report, 'delivered', 'Sustainability Officer');
    renderBellIcon('notif-container', currentUser.email);
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
            // Sync in-memory cache before addHighlight writes back
            void SustDB.wastageReports;

            // Highlight
            SustDB.addHighlight(
                `New ${metricType} Target Set`,
                `Target: ${valueStr} ${unit} by ${new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (Report #${reportId}).`,
                'blue'
            );

            showToast(`${metricType} target set to ${valueStr} ${unit}.`, 'success', 2500);
            notifyOnStateChange(target, 'target_set', 'Sustainability Officer');
            renderBellIcon('notif-container', currentUser.email);
            renderWastageAuditQueue();
            renderRecentHighlights();
        }
    });
};
