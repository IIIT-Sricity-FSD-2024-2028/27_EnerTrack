/**
 * alertsPage.js
 * Handles interactivity for the Real-Time Anomaly Alerts page.
 * Data source: backend /alerts and /faults endpoints (via window.api).
 */
import { showToast, openModal } from './utils/utils.js';

let selectedAlertId = null;
let _alerts = [];

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadAlerts();
        console.log("TechAlerts: Initialized.");
    } catch (err) {
        console.error("TechAlerts: Init error:", err);
    }
});

async function loadAlerts() {
    try {
        if (window.api) {
            _alerts = await window.api.get('/alerts');
            if (!Array.isArray(_alerts)) _alerts = [];
        }
    } catch (err) {
        console.warn('[TechAlerts] Backend unavailable:', err.message);
        _alerts = [];
    }

    renderQueue();
    renderHistoryLog();

    window.resolveAlertFn = async function(id) {
        try {
            if (window.api) await window.api.patch(`/alerts/${id}`, { status: 'resolved' });
            const a = _alerts.find(x => x.alert_id === id || x.id === id);
            if (a) a.status = 'resolved';
        } catch (err) { console.warn(err); }
        showToast(`Alert ${id} resolved.`, 'success');
        renderQueue();
        renderHistoryLog();
    };

    const firstOpen = _alerts.find(a => (a.status || '').toLowerCase() === 'open');
    if (firstOpen) selectAlert(firstOpen.alert_id || firstOpen.id);
}

/* ─── Render alert queue table ────────────────────── */
function renderQueue() {
    const tbody = document.getElementById('alertQueueBody');
    if (!tbody) return;

    const openAlerts = _alerts.filter(a => (a.status || '').toLowerCase() === 'open');
    if (!openAlerts.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:20px;">No open alerts <svg width="14" height="14" style="vertical-align:middle; margin-left:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></td></tr>`;
        return;
    }

    tbody.innerHTML = openAlerts.map(a => {
        const id = a.alert_id || a.id;
        const severity = a.severity || a.type || 'low';
        const ts = a.created_at || a.timestamp || '—';
        return `
        <tr data-alert-id="${id}" class="${id === selectedAlertId ? 'selected' : ''}">
            <td>${id}</td>
            <td><span class="badge ${severity}">${cap(severity)}</span></td>
            <td>${ts}</td>
            <td><span class="badge open">Open</span></td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-alert-id]').forEach(row => {
        row.addEventListener('click', () => selectAlert(row.dataset.alertId));
    });
}

/* ─── Render historical log ───────────────────────── */
function renderHistoryLog() {
    const tbody = document.getElementById('historyLogBody');
    if (!tbody) return;

    const historyAlerts = _alerts.filter(a => {
        const s = (a.status || '').toLowerCase();
        return s === 'acknowledged' || s === 'resolved';
    });

    const sevScore = { 'critical': 3, 'high': 3, 'moderate': 2, 'medium': 2, 'low': 1 };
    historyAlerts.sort((a, b) => (sevScore[b.severity] || 0) - (sevScore[a.severity] || 0));

    tbody.innerHTML = historyAlerts.map(a => {
        const id = a.alert_id || a.id;
        const severity = a.severity || 'low';
        const ts = a.created_at || a.timestamp || '—';
        const s = (a.status || '').toLowerCase();
        return `
        <tr>
            <td>${id}</td>
            <td>${a.description || a.message || '—'}</td>
            <td><span class="badge ${severity}">${cap(severity)}</span></td>
            <td>${ts}</td>
            <td>${a.actionTaken || '—'}</td>
            <td>
                ${s === 'resolved'
                    ? `<span class="badge resolved">Resolved</span>`
                    : `<button class="btn btn-dark" style="padding: 4px 10px; font-size: 11px;" onclick="window.resolveAlertFn('${id}')">Resolve</button>`
                }
            </td>
        </tr>`;
    }).join('');
}

/* ─── Select an alert and populate detail panel ───── */
function selectAlert(id) {
    selectedAlertId = id;
    const alert = _alerts.find(a => (a.alert_id || a.id) === id);
    if (!alert) return;

    document.querySelectorAll('#alertQueueBody tr').forEach(r => r.classList.remove('selected'));
    document.querySelector(`#alertQueueBody tr[data-alert-id="${id}"]`)?.classList.add('selected');

    setEl('detailAlertId', `Alert ${id} Details`);
    setEl('detailSeverityBadge', `<span class="badge ${alert.severity || 'low'}">${cap(alert.severity || 'low')}</span>`);
    setEl('detailDescription', alert.description || alert.message || '—');
    setEl('detailZone', alert.zone || alert.location || 'Unknown Zone');

    const btnEmergency = document.getElementById('btnInitiateEmergency');
    const btnSchedule = document.getElementById('btnScheduleInspection');
    const btnAcknowledge = document.getElementById('btnAcknowledge');

    if (btnEmergency) btnEmergency.onclick = () => acknowledgeAlert(id, 'Emergency Response Initiated');
    if (btnSchedule) btnSchedule.onclick = () => acknowledgeAlert(id, 'Inspection Scheduled');
    if (btnAcknowledge) {
        btnAcknowledge.onclick = () => {
            openModal({
                title: 'Resolve Alert',
                bodyHTML: `<p>Are you sure you want to resolve <strong>${id}</strong>?</p>`,
                confirmLabel: 'Resolve',
                cancelLabel: 'Cancel',
                onConfirm: () => {
                    window.resolveAlertFn(id);
                    const next = _alerts.find(a => (a.status || '').toLowerCase() === 'open');
                    if (next) selectAlert(next.alert_id || next.id);
                    else {
                        setEl('detailAlertId', 'No open alerts');
                        setEl('detailSeverityBadge', '');
                        setEl('detailDescription', 'All alerts have been resolved or acknowledged.');
                    }
                }
            });
        };
    }
}

/* ─── Acknowledge an alert ───────────────────────── */
async function acknowledgeAlert(id, actionTaken) {
    try {
        if (window.api) await window.api.patch(`/alerts/${id}`, { status: 'acknowledged' });
        const a = _alerts.find(x => (x.alert_id || x.id) === id);
        if (a) { a.status = 'acknowledged'; a.actionTaken = actionTaken; }
    } catch (err) { console.warn(err); }

    showToast(`Alert ${id} acknowledged. Action: ${actionTaken}`, 'success');
    renderQueue();
    renderHistoryLog();

    const next = _alerts.find(a => (a.status || '').toLowerCase() === 'open');
    if (next) selectAlert(next.alert_id || next.id);
    else {
        setEl('detailAlertId', 'No open alerts');
        setEl('detailDescription', 'All alerts have been resolved.');
    }
}

/* ─── Helpers ─────────────────────────────────────── */
function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function setEl(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    if (String(html).startsWith('<')) el.innerHTML = html;
    else el.textContent = html;
}
