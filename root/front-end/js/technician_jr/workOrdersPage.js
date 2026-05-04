/**
 * workOrdersPage.js
 * Handles interactivity for the Maintenance Work Orders page.
 * CRUD: create new WO, update type/priority/status, close WO, kanban board render.
 */
import TechDB from '../../technician/js/data/mockData.js';
import { showToast, openModal, generateId } from '../../technician/js/utils/utils.js';

let currentUser = { role: "Technician", name: "Guest" };

let selectedWOId = null;
let selectedType = 'scheduled';

document.addEventListener("DOMContentLoaded", () => {
    try {
        // Load from localStorage for actual user persistence
        const stored = localStorage.getItem("currentUser");
        if (stored) {
            const user = JSON.parse(stored);
            currentUser.name = user.name;
        } else {
            // Fallback for demo
            currentUser.name = "Elena Park";
        }

        initWorkOrders();
        console.log("TechJrWorkOrders: Initialized for", currentUser.name);
    } catch (err) {
        console.error("TechWorkOrders: Init error:", err);
    }
});

function initWorkOrders() {
    renderBoard();
    renderArchive();
    wireTypeSelector();
    wireNewWOForm();
    wireInitiateBtn();

    // Select first WO visible to this user
    const orders = TechDB.workOrders.filter(w => w.technician === currentUser.name && w.status !== 'closed');
    if (orders.length > 0) selectWorkOrder(orders[0].id);
}

/* ─── Kanban Board Render ────────────────────────── */
function renderBoard() {
    renderColumn('woColNew',        'new');
    renderColumn('woColApproval',   'approval');
    renderColumn('woColInProgress', 'inprogress');
    renderColumn('woColReview',     'review');
    updateColumnCounts();
}

function renderColumn(containerId, status) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const orders = TechDB.workOrders.filter(w => w.status === status && w.technician === currentUser.name);
    container.innerHTML = orders.map(wo => `
        <div class="task-card ${wo.id === selectedWOId ? 'selected-task' : ''}" data-wo-id="${wo.id}">
            <div class="task-title">
                ${wo.id}
                <span class="priority-tag priority-${wo.priority}">${cap(wo.priority)}</span>
            </div>
            <div>${wo.title}</div>
                <div style="margin-top:6px; font-size:11px; color:var(--muted); display:flex; align-items:center; gap:10px;">
                    <span style="display:inline-flex;align-items:center;gap:4px;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        ${wo.technician}
                    </span>
                    <span style="display:inline-flex;align-items:center;gap:4px;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Estimate: ${wo.estimate ? 'Submitted' : 'Needed'}
                    </span>
                </div>
        </div>
    `).join('') || `<div style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">No work orders</div>`;

    container.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('click', () => selectWorkOrder(card.dataset.woId));
    });
}

function updateColumnCounts() {
    const counts = { new: 0, approval: 0, inprogress: 0, review: 0 };
    TechDB.workOrders.filter(w => w.technician === currentUser.name).forEach(w => { if (counts[w.status] !== undefined) counts[w.status]++; });
    setEl('countNew', counts.new);
    setEl('countApproval', counts.approval);
    setEl('countInProgress', counts.inprogress);
    setEl('countReview', counts.review);
}

/* ─── Select a Work Order ────────────────────────── */
function selectWorkOrder(id) {
    selectedWOId = id;
    const wo = TechDB.getWorkOrder(id);
    if (!wo) return;

    // Highlight selected card
    document.querySelectorAll('.task-card').forEach(c => c.classList.remove('selected-task'));
    document.querySelector(`.task-card[data-wo-id="${id}"]`)?.classList.add('selected-task');

    // Update detail panel
    setEl('selectedWOTitle', `Selected Work Order — ${wo.id}`);
    setEl('selectedWOStatus', wo.status);
    setEl('selectedWOType', cap(wo.type));
    setEl('selectedWOPriority', cap(wo.priority));
    setEl('selectedWOTechnician', wo.technician);
    // Update Cost Estimate Display
    const costStatusEl = document.getElementById('selectedWOCost');
    if (costStatusEl) {
        if (wo.estimate) {
            costStatusEl.innerHTML = `<span style="color:#10b981; font-weight:600;">Submitted (₹${wo.estimate.total})</span>`;
        } else {
            costStatusEl.innerHTML = `<span style="color:#ef4444; font-weight:600;">Required / Not Submitted</span>`;
        }
    }

    // Toggle Cost Form
    const btnShowForm = document.getElementById('btnShowCostForm');
    const costEstBlock = document.getElementById('costEstimateBlock');
    if (btnShowForm && costEstBlock) {
        costEstBlock.style.display = 'none';
        btnShowForm.onclick = () => {
            costEstBlock.style.display = costEstBlock.style.display === 'none' ? 'block' : 'none';
        };
    }

    if (actionPanelTitle && actionPanelOptions) {
        if (wo.status === 'new') {
            actionPanelTitle.textContent = "Work Order Assignment";
            
            let techOptions = '<option value="">-- Return to System Admin --</option>';
            const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
            registeredUsers.forEach(u => {
                if ((u.role === 'Technician' || u.role === 'Technician Administrator') && u.name !== currentUser.name) {
                    techOptions += `<option value="${u.name}">${u.name}</option>`;
                }
            });

            actionPanelOptions.innerHTML = `
              <div class="option active">
                <b>Accept Task</b>
                <p>Begin phase execution.</p>
                <button class="btn btn-dark btn-full" onclick="acceptWO('${id}')">Accept Task</button>
              </div>
              <div class="option">
                <b>Reject / Re-assign</b>
                <p>Return or pass to other tech.</p>
                <select id="reassignSelect" style="width:100%; border:1px solid #d1d5db; border-radius:4px; padding:4px; font-size:12px; margin-bottom:6px;">
                  ${techOptions}
                </select>
                <button class="btn btn-light btn-full" style="color:#ef4444; border-color:#ef4444;" onclick="rejectAndReassign('${id}')">Process</button>
              </div>
            `;
        } else if (wo.status === 'inprogress') {
            actionPanelTitle.textContent = "System Operational Check";
            actionPanelOptions.innerHTML = `
              <div class="option active">
                <b>Operational</b>
                <p>Document completion.</p>
                <textarea id="completionNotes" placeholder="Enter resolution details..." style="width:100%; border:1px solid #d1d5db; border-radius:4px; padding:6px; font-size:12px; margin-bottom:6px; resize:vertical; min-height:40px;"></textarea>
                <button class="btn btn-dark btn-full" onclick="submitReviewWithNotes('${id}')">Submit for Review</button>
              </div>
              <div class="option">
                <b>Requires Cost Estimate</b>
                <p>Submit for financial approval.</p>
                <button class="btn btn-light btn-full" onclick="document.getElementById('costEstimateBlock').style.display='block'">Show Cost Form</button>
              </div>
            `;
        } else if (wo.status === 'approval') {
            actionPanelTitle.textContent = "Cost Estimate Approval";
            actionPanelOptions.innerHTML = `
              <div class="option">
                <p style="font-size:13px; color:var(--muted);">Waiting for Finance/Sust Analyst to approve the submitted estimate...</p>
              </div>
            `;
        } else {
            actionPanelTitle.textContent = "System Operational Check";
            actionPanelOptions.innerHTML = `
              <div class="option">
                <p style="font-size:13px; color:var(--muted);">Task is under review.</p>
                ${wo.completionNotes ? `<div style="margin-top:8px; padding:8px; border-left:2px solid #3b82f6; background:#eff6ff; font-size:12px;"><strong>Notes:</strong><br/>${wo.completionNotes}</div>` : ''}
              </div>
            `;
        }
    }

    // Task execution flow
    updateTaskFlow(wo.status);
}

function updateTaskFlow(status) {
    const steps = ['schedule', 'inspect', 'perform', 'test'];
    const activeIndex = status === 'new' ? 0 : status === 'inprogress' ? 1 : status === 'review' ? 2 : 3;
    steps.forEach((s, i) => {
        const el = document.getElementById(`step-${s}`);
        if (el) {
            el.classList.toggle('active', i <= activeIndex);
        }
    });
}

/* ─── Move WO to new status ──────────────────────── */
function moveWOStatus(id, newStatus) {
    TechDB.updateWorkOrder(id, { status: newStatus });
    showToast(`Work order ${id} moved to ${cap(newStatus)}.`, 'success');
    renderBoard();
    selectWorkOrder(id);
}
window.moveWOStatus = moveWOStatus;

window.submitReviewWithNotes = function(id) {
    const notes = document.getElementById('completionNotes')?.value;
    TechDB.updateWorkOrder(id, { status: 'review', completionNotes: notes || '' });
    showToast(`Work order ${id} moved to Review.`, 'success');
    renderBoard();
    selectWorkOrder(id);
};

window.acceptWO = function(id) {
    TechDB.updateWorkOrder(id, { status: 'inprogress' });
    showToast('Task accepted. Procedural tracking started.', 'success');
    renderBoard();
    selectWorkOrder(id);
};

window.submitCostEstimate = function(id) {
    const materials = document.getElementById('estMaterials').value;
    const labor = document.getElementById('estLabor').value;
    if (!materials || !labor) {
        showToast("Please enter both materials and labor costs.", "warning");
        return;
    }
    const total = Number(materials) + Number(labor);
    if (total > 0) {
        TechDB.updateWorkOrder(id, { 
            status: 'approval', 
            estimate: { materials: Number(materials), labor: Number(labor), total, type: 'repair' } 
        });
        showToast('Cost estimate submitted. Waiting for approval.', 'success');
        document.getElementById('costEstimateBlock').style.display = 'none';
        renderBoard();
        selectWorkOrder(id);
    }
};

window.onload = () => {
    const btn = document.getElementById('btnSubmitCostEst');
    if (btn) btn.addEventListener('click', () => { if (selectedWOId) window.submitCostEstimate(selectedWOId); });
};

window.rejectAndReassign = function(id) {
    const assignedTech = document.getElementById('reassignSelect').value;
    
    if (assignedTech) {
        TechDB.updateWorkOrder(id, { technician: assignedTech, status: 'new' });
        showToast('Work order reassigned directly.', 'success');
    } else {
        TechDB.updateWorkOrder(id, { status: 'new', technician: "", rejected: true });
        showToast('Work order rejected to System Admin queue.', 'info');
    }
    
    renderBoard();
    selectWorkOrder(id);
};

/* ─── Archive table ──────────────────────────────── */
function renderArchive() {
    const tbody = document.getElementById('archiveBody');
    if (!tbody) return;

    const closed = TechDB.workOrders.filter(w => w.status === 'closed' && w.technician === currentUser.name);
    if (!closed.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:20px;">No archived work orders yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = closed.map(wo => `
        <tr>
            <td>${wo.id}</td>
            <td>${wo.title}</td>
            <td><span class="badge ${wo.priority}">${cap(wo.type)}</span></td>
            <td>${wo.technician}</td>
            <td><span class="badge closed">Closed</span></td>
        </tr>
    `).join('');
}

/* ─── Helpers ─────────────────────────────────────── */
function cap(str) { if (!str) return '—'; return str.charAt(0).toUpperCase() + str.slice(1); }
function setEl(id, val) { 
    const el = document.getElementById(id); 
    if (!el) return;
    if (String(val).includes('<svg')) el.innerHTML = val;
    else el.textContent = val;
}
