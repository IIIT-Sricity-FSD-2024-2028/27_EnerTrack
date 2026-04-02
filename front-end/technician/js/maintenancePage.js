/**
 * maintenancePage.js
 * Handles interactivity for the Fault Detection & Diagnostics page.
 * CRUD: select acknowledged alert, run diagnostic, log result, flag repair.
 */
import TechDB from './data/mockData.js';
import { showToast, openModal } from './utils/utils.js';

<<<<<<< HEAD
const SS_KEY = 'enertrack.tech.maintenance';
=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
let selectedFaultId = null;

document.addEventListener("DOMContentLoaded", () => {
    try {
        initMaintenance();
        console.log("TechMaintenance: Initialized.");
    } catch (err) {
        console.error("TechMaintenance: Init error:", err);
    }
});

function initMaintenance() {
    renderAlertSelector();
    wireRunDiagnostics();

<<<<<<< HEAD
    // Restore persisted fault selection, else select first active fault
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '{}'); } catch { return {}; } })();
    const restoredFault = saved.selectedFaultId && TechDB.faults.find(f => f.id === saved.selectedFaultId);
    if (restoredFault) selectFault(restoredFault.id);
    else if (TechDB.faults.length) selectFault(TechDB.faults[0].id);
=======
    // Select first active fault by default
    if (TechDB.faults.length) {
        selectFault(TechDB.faults[0].id);
    }
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
}

/* ─── Render acknowledged alert selector tiles ─────── */
function renderAlertSelector() {
    const grid = document.getElementById('alertSelectorGrid');
    if (!grid) return;

    const activeFaults = TechDB.faults.filter(f => f.status === 'active' || f.status === 'pending');
    grid.innerHTML = activeFaults.map(f => `
        <div class="alert-tile ${f.id === selectedFaultId ? 'active' : ''}" data-fault-id="${f.id}">
            <span class="badge ${severityClass(f.severity)}">${cap(f.severity)}</span>
            <div class="alert-tile-id">${f.alertId} / ${f.id}</div>
            <div class="alert-tile-desc">${f.type} — ${f.asset}</div>
            <div class="alert-tile-meta">Assigned to ${f.assignedTo}</div>
        </div>
    `).join('');

    grid.querySelectorAll('.alert-tile').forEach(tile => {
        tile.addEventListener('click', () => selectFault(tile.dataset.faultId));
    });
}

/* ─── Select a fault and load the workspace ─────────── */
function selectFault(faultId) {
    selectedFaultId = faultId;
<<<<<<< HEAD
    // Persist selection
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ selectedFaultId: faultId })); } catch (_) {}
=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
    const fault = TechDB.getFault(faultId);
    if (!fault) return;

    // Highlight active tile
    document.querySelectorAll('.alert-tile').forEach(t => t.classList.remove('active'));
    document.querySelector(`.alert-tile[data-fault-id="${faultId}"]`)?.classList.add('active');

    // Update workspace header
    setEl('workspaceTitle',    `Active Diagnostics · ${fault.alertId}`);
    setEl('workspaceAsset',    fault.asset);
    setEl('diagnosticFaultType',  fault.type);
    setEl('diagnosticSeverity',   fault.severity);
}

/* ─── Run diagnostic test button ──────────────────── */
function wireRunDiagnostics() {
    const btn = document.getElementById('btnRunDiagnostic');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (!selectedFaultId) {
            showToast('Select an alert first.', 'warning');
            return;
        }

        const loadingSvg = `<svg class="spin" width="14" height="14" style="vertical-align:middle; margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;
        const playSvg = `<svg width="14" height="14" style="vertical-align:middle; margin-right:6px;" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

        btn.innerHTML = `${loadingSvg} Running...`;
        btn.disabled = true;

        setTimeout(() => {
            btn.innerHTML = `${playSvg} Run Diagnostic Test`;
            btn.disabled = false;
            showToast('Diagnostic test completed. Review results below.', 'success');
        }, 2000);
    });
}

/* ─── Log Resolution & Close ──────────────────────── */
document.addEventListener('click', e => {
    // Log Resolution
    if (e.target.id === 'btnLogResolution') {
        if (!selectedFaultId) return;
        openModal({
            title: 'Log Resolution',
            bodyHTML: `<p>Confirm fault <strong>${selectedFaultId}</strong> has been resolved and close the diagnostic workspace?</p>`,
            confirmLabel: 'Log & Close',
            onConfirm: () => {
                TechDB.updateFault(selectedFaultId, { status: 'resolved' });
                showToast(`Fault ${selectedFaultId} resolved and logged.`, 'success');
                renderAlertSelector();
                selectedFaultId = null;
                setEl('workspaceTitle', 'Select an alert to begin diagnostics.');
            }
        });
    }

    // Flag Scheduled Maintenance
    if (e.target.id === 'btnFlagScheduled') {
        if (!selectedFaultId) return;
        TechDB.updateFault(selectedFaultId, { repairType: 'scheduled' });
        showToast('Flagged for scheduled maintenance window.', 'info');
    }

    // Flag Immediate Repair
    if (e.target.id === 'btnFlagImmediate') {
        if (!selectedFaultId) return;
        TechDB.updateFault(selectedFaultId, { repairType: 'immediate' });
        showToast('Flagged for immediate field repair.', 'warning');
    }

    // Continue Diagnostics
    if (e.target.id === 'btnContinueDiagnostics') {
        showToast('Full diagnostic workflow loaded.', 'info');
    }
});

/* ─── Helpers ─────────────────────────────────────── */
function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
function setEl(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (String(val).includes('<svg')) el.innerHTML = val;
    else el.textContent = val;
}
function severityClass(s) {
    if (s === 'high') return 'critical';
    if (s === 'moderate') return 'moderate';
    return 'low';
}
