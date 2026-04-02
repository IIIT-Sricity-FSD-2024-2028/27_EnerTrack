/**
 * alertsPage.js
 * Handles interactivity for the Real-Time Anomaly Alerts page.
 * CRUD: acknowledge alerts, change status, view details dynamically.
 */
import TechDB from './data/mockData.js';
import { showToast, openModal } from './utils/utils.js';

<<<<<<< HEAD
const SS_KEY = 'enertrack.tech.alerts';
=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
let selectedAlertId = null;

document.addEventListener("DOMContentLoaded", () => {
    try {
        initAlerts();
        console.log("TechAlerts: Initialized.");
    } catch (err) {
        console.error("TechAlerts: Init error:", err);
    }
});

function initAlerts() {
    renderQueue();
    renderHistoryLog();

<<<<<<< HEAD
    // Restore persisted alert selection, else select first open alert
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '{}'); } catch { return {}; } })();
    const target = saved.selectedAlertId && TechDB.alerts.find(a => a.id === saved.selectedAlertId && a.status === 'open');
    const firstOpen = TechDB.alerts.find(a => a.status === 'open');
    if (target) selectAlert(target.id);
    else if (firstOpen) selectAlert(firstOpen.id);
=======
    // Select first open alert by default
    const firstOpen = TechDB.alerts.find(a => a.status === 'open');
    if (firstOpen) selectAlert(firstOpen.id);
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
}

/* ─── Render alert queue table ────────────────────── */
function renderQueue() {
    const tbody = document.getElementById('alertQueueBody');
    if (!tbody) return;

    const openAlerts = TechDB.alerts.filter(a => a.status === 'open');
    if (!openAlerts.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:20px;">No open alerts <svg width="14" height="14" style="vertical-align:middle; margin-left:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></td></tr>`;
        return;
    }

    tbody.innerHTML = openAlerts.map(a => `
        <tr data-alert-id="${a.id}" class="${a.id === selectedAlertId ? 'selected' : ''}">
            <td>${a.id}</td>
            <td><span class="badge ${a.severity}">${cap(a.severity)}</span></td>
            <td>${a.timestamp}</td>
            <td><span class="badge open">Open</span></td>
        </tr>
    `).join('');

    // Wire row clicks
    tbody.querySelectorAll('tr[data-alert-id]').forEach(row => {
        row.addEventListener('click', () => selectAlert(row.dataset.alertId));
    });
}

/* ─── Render historical log ───────────────────────── */
function renderHistoryLog() {
    const tbody = document.getElementById('historyLogBody');
    if (!tbody) return;

    const resolved = TechDB.alerts.filter(a => a.status === 'resolved');
    tbody.innerHTML = resolved.map(a => `
        <tr>
            <td>${a.id}</td>
            <td>${a.description}</td>
            <td><span class="badge ${a.severity}">${cap(a.severity)}</span></td>
            <td>${a.timestamp}</td>
            <td>${a.actionTaken || '—'}</td>
            <td><span class="badge resolved">Resolved</span></td>
        </tr>
    `).join('');
}

/* ─── Select an alert and populate detail panel ───── */
function selectAlert(id) {
    selectedAlertId = id;
<<<<<<< HEAD
    // Persist selection
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ selectedAlertId: id })); } catch (_) {}
=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
    const alert = TechDB.getAlert(id);
    if (!alert) return;

    // Highlight row
    document.querySelectorAll('#alertQueueBody tr').forEach(r => r.classList.remove('selected'));
    document.querySelector(`#alertQueueBody tr[data-alert-id="${id}"]`)?.classList.add('selected');

    // Update detail panel
    setEl('detailAlertId',      `Alert ${alert.id} Details`);
    setEl('detailSeverityBadge', `<span class="badge ${alert.severity}">${cap(alert.severity)}</span>`);
    setEl('detailDescription',   alert.description);
    setEl('detailZone',          alert.zone || 'Unknown Zone');

    // Wire action buttons
    const btnEmergency = document.getElementById('btnInitiateEmergency');
    const btnSchedule  = document.getElementById('btnScheduleInspection');
    const btnAcknowledge = document.getElementById('btnAcknowledge');

    if (btnEmergency) {
        btnEmergency.onclick = () => acknowledgeAlert(id, 'Emergency Response Initiated');
    }
    if (btnSchedule) {
        btnSchedule.onclick = () => acknowledgeAlert(id, 'Inspection Scheduled');
    }
    if (btnAcknowledge) {
        btnAcknowledge.onclick = () => {
            openModal({
                title: 'Acknowledge Alert',
                bodyHTML: `<p>Are you sure you want to acknowledge <strong>${id}</strong> without further escalation?</p>`,
                confirmLabel: 'Acknowledge',
                cancelLabel: 'Cancel',
                onConfirm: () => acknowledgeAlert(id, 'Acknowledged — No further action')
            });
        };
    }
}

/* ─── Acknowledge an alert (Write) ───────────────── */
function acknowledgeAlert(id, actionTaken) {
    TechDB.acknowledgeAlert(id, actionTaken);
    showToast(`Alert ${id} acknowledged. Action: ${actionTaken}`, 'success');
    renderQueue();
    renderHistoryLog();

    // Select next open alert
    const next = TechDB.alerts.find(a => a.status === 'open');
    if (next) selectAlert(next.id);
    else {
        setEl('detailAlertId', 'No open alerts');
        setEl('detailDescription', 'All alerts have been resolved.');
    }
}

/* ─── Helpers ─────────────────────────────────────── */
function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function setEl(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    if (html.startsWith('<')) el.innerHTML = html;
    else el.textContent = html;
}
