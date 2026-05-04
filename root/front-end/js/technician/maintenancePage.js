/**
 * maintenancePage.js
 * Handles interactivity for the Fault Detection & Diagnostics page.
 * CRUD: select acknowledged alert, run diagnostic, log result, flag repair.
 */
import TechDB from './data/mockData.js';
import { showToast, openModal } from './utils/utils.js';

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

    // Select first active fault by default
    if (TechDB.faults.length) {
        selectFault(TechDB.faults[0].id);
    }
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
    const fault = TechDB.getFault(faultId);
    if (!fault) return;

    // Highlight active tile
    document.querySelectorAll('.alert-tile').forEach(t => t.classList.remove('active'));
    document.querySelector(`.alert-tile[data-fault-id="${faultId}"]`)?.classList.add('active');

    // Update workspace header
    setEl('workspaceTitle',    `Active Diagnostics · ${fault.alertId}`);
    setEl('workspaceAsset',    fault.asset);
    setEl('diagnosticFaultTypeBadge',  fault.type);
    
    const severityEl = document.getElementById('diagnosticSeverityBadge');
    if (severityEl) {
        severityEl.textContent = fault.severity;
        severityEl.className = `badge ${severityClass(fault.severity)}`;
    }

    // Update Prelim Notes UI
    if (fault.prelimNotes) {
        document.getElementById('prelimViewMode').style.display = 'block';
        document.getElementById('prelimEditMode').style.display = 'none';
        setEl('prelimSavedText', fault.prelimNotes);
    } else {
        document.getElementById('prelimViewMode').style.display = 'none';
        document.getElementById('prelimEditMode').style.display = 'block';
        document.getElementById('prelimTextarea').value = '';
    }

    // Update Quickfix Notes UI
    if (fault.quickfixNotes) {
        document.getElementById('quickfixViewMode').style.display = 'block';
        document.getElementById('quickfixEditMode').style.display = 'none';
        setEl('quickfixSavedText', fault.quickfixNotes);
    } else {
        document.getElementById('quickfixViewMode').style.display = 'none';
        document.getElementById('quickfixEditMode').style.display = 'block';
        document.getElementById('quickfixTextarea').value = '';
    }
}

/* ─── Log Resolution & Close ──────────────────────── */
document.addEventListener('click', e => {
    // Note Management - Preliminary
    if (e.target.id === 'btnSavePrelim') {
        const val = document.getElementById('prelimTextarea').value.trim();
        if (val && selectedFaultId) {
            TechDB.updateFault(selectedFaultId, { prelimNotes: val });
            showToast('Preliminary inspection notes saved.', 'success');
            selectFault(selectedFaultId);
        }
    }
    if (e.target.id === 'btnEditPrelim') {
        document.getElementById('prelimViewMode').style.display = 'none';
        document.getElementById('prelimEditMode').style.display = 'block';
        document.getElementById('prelimTextarea').value = TechDB.getFault(selectedFaultId).prelimNotes;
    }
    if (e.target.id === 'btnDeletePrelim') {
        if (selectedFaultId) {
            TechDB.updateFault(selectedFaultId, { prelimNotes: '' });
            showToast('Notes deleted.', 'info');
            selectFault(selectedFaultId);
        }
    }

    // Note Management - Quick Fix
    if (e.target.id === 'btnSaveQuickfix') {
        const val = document.getElementById('quickfixTextarea').value.trim();
        if (val && selectedFaultId) {
            TechDB.updateFault(selectedFaultId, { quickfixNotes: val });
            showToast('Quick fix logic saved.', 'success');
            selectFault(selectedFaultId);
        }
    }
    if (e.target.id === 'btnEditQuickfix') {
        document.getElementById('quickfixViewMode').style.display = 'none';
        document.getElementById('quickfixEditMode').style.display = 'block';
        document.getElementById('quickfixTextarea').value = TechDB.getFault(selectedFaultId).quickfixNotes;
    }
    if (e.target.id === 'btnDeleteQuickfix') {
        if (selectedFaultId) {
            TechDB.updateFault(selectedFaultId, { quickfixNotes: '' });
            showToast('Quick fix logic deleted.', 'info');
            selectFault(selectedFaultId);
        }
    }

    // Log Resolution
    if (e.target.id === 'btnLogResolution') {
        if (!selectedFaultId) return;
        openModal({
            title: 'Close Fault',
            bodyHTML: `<p>Confirm quick fix was successful and close fault <strong>${selectedFaultId}</strong>?</p>`,
            confirmLabel: 'Close Fault',
            onConfirm: () => {
                const faultToResolve = TechDB.getFault(selectedFaultId);
                
                TechDB.updateFault(selectedFaultId, { status: 'resolved' });
                showToast(`Fault ${selectedFaultId} resolved and logged.`, 'success');
                renderAlertSelector();
                
                // Also resolve the underlying alert if it's still open or acknowledged
                if (faultToResolve && faultToResolve.alertId) {
                    TechDB.resolveAlert(faultToResolve.alertId);
                }

                selectedFaultId = null;
                setEl('workspaceTitle', 'Select an alert to begin diagnostics.');
            }
        });
    }

    // Flag Scheduled Maintenance
    if (e.target.id === 'btnFlagScheduled') {
        if (!selectedFaultId) return;
        const fault = TechDB.getFault(selectedFaultId);
        openModal({
            title: 'Setup Scheduled Work Order',
            bodyHTML: getWOModalHTML(fault, 'scheduled'),
            confirmLabel: 'Create Work Order',
            onConfirm: () => handleWOCreation(selectedFaultId, 'scheduled')
        });
    }

    // Flag Immediate Repair
    if (e.target.id === 'btnFlagImmediate') {
        if (!selectedFaultId) return;
        const fault = TechDB.getFault(selectedFaultId);
        openModal({
            title: 'Setup Immediate Repair Work Order',
            bodyHTML: getWOModalHTML(fault, 'immediate'),
            confirmLabel: 'Create Urgent Work Order',
            danger: true,
            onConfirm: () => handleWOCreation(selectedFaultId, 'immediate')
        });
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
    if (s === 'high' || s === 'critical') return 'critical';
    if (s === 'moderate') return 'moderate';
    return 'low';
}

function getWOModalHTML(fault, type) {
    const techs = TechDB.getRegisteredUsers().filter(u => u.role === 'Technician' || u.role === 'Technician Administrator');
    const techOptions = techs.map(t => 
        `<option value="${t.name}" ${fault.assignedTo === t.name ? 'selected' : ''}>${t.name}</option>`
    ).join('');
    
    // Add default fallback if no techs are registered
    const finalTechOptions = techOptions || `<option value="Marcus Reed">Marcus Reed</option>`;

    let priorityOptions = `<option value="high" selected>High (Emergency)</option>`;
    if (type !== 'immediate') {
        priorityOptions = `
            <option value="high" ${(fault.severity === 'high' || fault.severity === 'critical') ? 'selected' : ''}>High</option>
            <option value="medium" ${fault.severity === 'moderate' ? 'selected' : ''}>Medium</option>
            <option value="low" ${fault.severity === 'low' ? 'selected' : ''}>Low</option>
        `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
         <div>
           <label style="font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.04em; text-transform:uppercase;">Asset</label>
           <input type="text" id="modalWOAsset" value="${fault.asset}" readonly style="width:100%; box-sizing: border-box; padding:10px 12px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; margin-top:6px; font-family:inherit; font-size:14px; color:#475569;">
         </div>
         <div style="display: flex; gap: 16px;">
             <div style="flex: 1;">
               <label style="font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.04em; text-transform:uppercase;">Priority</label>
               <select id="modalWOPriority" style="width:100%; box-sizing: border-box; padding:10px 12px; border-radius:8px; border:1px solid #cbd5e1; margin-top:6px; font-family:inherit; font-size:14px; color:#0f172a;">
                 ${priorityOptions}
               </select>
             </div>
             <div style="flex: 1;">
               <label style="font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.04em; text-transform:uppercase;">Assignee</label>
               <select id="modalWOAssignee" style="width:100%; box-sizing: border-box; padding:10px 12px; border-radius:8px; border:1px solid #cbd5e1; margin-top:6px; font-family:inherit; font-size:14px; color:#0f172a;">
                 ${finalTechOptions}
               </select>
             </div>
         </div>
         <div>
           <label style="font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.04em; text-transform:uppercase;">Diagnostic Notes to Transfer</label>
           <textarea id="modalWONotes" style="width:100%; box-sizing: border-box; padding:10px 12px; border-radius:8px; border:1px solid #cbd5e1; margin-top:6px; font-family:inherit; font-size:14px; min-height: 80px; resize:vertical; color:#0f172a;">${fault.quickfixNotes || fault.prelimNotes || "Diagnostics flagged this fault."}</textarea>
         </div>
      </div>
    `;
}

function handleWOCreation(faultId, type) {
    const fault = TechDB.getFault(faultId);
    if (!fault) return;
    
    const priority = document.getElementById('modalWOPriority').value;
    const assignee = document.getElementById('modalWOAssignee').value;
    const notes = document.getElementById('modalWONotes').value;

    const wo = {
        id: "WO-" + Math.floor(Math.random() * 9000 + 1000),
        title: `${type === 'immediate' ? 'Urgent Repair' : 'Scheduled Maintenance'}: ${fault.asset}`,
        status: "new",
        type: type === 'immediate' ? 'emergency' : 'scheduled',
        priority: priority,
        technician: assignee,
        parts: false,
        asset: fault.asset,
        linkedFault: faultId,
        completionNotes: notes
    };
    
    TechDB.addWorkOrder(wo);
    TechDB.updateFault(faultId, { status: 'flagged', repairType: type });
    
    showToast(`Flagged for ${type} repair. Work order created.`, type === 'immediate' ? 'warning' : 'info');
    renderAlertSelector();
    selectedFaultId = null;
    setEl('workspaceTitle', 'Select an alert to begin diagnostics.');
}
