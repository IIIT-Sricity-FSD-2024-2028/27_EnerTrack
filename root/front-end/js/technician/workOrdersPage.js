/**
 * workOrdersPage.js
 * Handles interactivity for the Maintenance Work Orders page.
 * CRUD: create new WO, update type/priority/status, close WO, kanban board render.
 * Backend-wired: /api/users, /api/service-requests, /api/work-orders
 */
import TechDB from './data/mockData.js';
import { showToast, openModal, generateId } from './utils/utils.js';

let selectedWOId = null;
let selectedType = 'scheduled';
let backendTechs = [];   // cached from /api/users
let backendSRs   = [];   // cached from /api/service-requests

document.addEventListener("DOMContentLoaded", async () => {
    await populateTechnicianDropdown();
    try {
        await initWorkOrders();
        console.log("TechWorkOrders: Initialized.");
    } catch (err) {
        console.error("TechWorkOrders: Init error:", err);
    }
});


async function populateTechnicianDropdown() {
    const select = document.getElementById('inputTechnician');
    const reassignSelect = document.getElementById('reassignTechSelect');

    // Try backend first
    try {
        if (window.api) {
            const users = await window.api.get('/users');
            if (Array.isArray(users)) {
                backendTechs = users.filter(u =>
                    u.role === 'Technician' || u.role === 'Technician Administrator'
                );
                const opts = `<option value="">— Select —</option>` +
                    backendTechs.map(t => `<option value="${t.user_id}" data-name="${t.name}">${t.name}</option>`).join('');
                if (select) select.innerHTML = opts;
                if (reassignSelect) reassignSelect.innerHTML =
                    `<option value="">-- Select Alternate Tech --</option>` +
                    backendTechs.map(t => `<option value="${t.user_id}" data-name="${t.name}">${t.name}</option>`).join('');
                console.log('[TechAdmin] Loaded', backendTechs.length, 'technicians from backend');
                return;
            }
        }
    } catch (err) {
        console.warn('[TechAdmin] Backend tech lookup failed, using localStorage:', err.message);
    }

    // Fallback: localStorage registeredUsers
    const KNOWN_TECHNICIANS = [
        { name: 'Teja', email: 'teja@gmail.com', phone: '9876543214', password: 'Teja@123', role: 'Technician' }
    ];
    let registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    let dirty = false;
    KNOWN_TECHNICIANS.forEach(kt => {
        if (!registeredUsers.some(u => u.email.toLowerCase() === kt.email.toLowerCase())) {
            registeredUsers.push(kt);
            dirty = true;
        }
    });
    if (dirty) localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));

    const techs = registeredUsers.filter(u =>
        u.role === 'Technician' || u.role === 'Technician Administrator'
    );
    const optionsHTML = `<option value="">— Select —</option>` +
        techs.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    if (select) select.innerHTML = optionsHTML;
    if (reassignSelect) reassignSelect.innerHTML =
        `<option value="">-- Select Alternate Tech --</option>` +
        techs.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
}



async function initWorkOrders() {
    renderBoard();
    renderArchive();
    await renderServiceRequests();
    wireTypeSelector();
    wireNewWOForm();
    wireInitiateBtn();

    // Select first WO by default
    const first = TechDB.workOrders.find(w => w.status !== 'closed');
    if (first) selectWorkOrder(first.id);
}

/* ─── Kanban Board Render ────────────────────────── */
function renderBoard() {
    renderColumn('woColNew', 'new');
    renderColumn('woColApproval', 'approval');
    renderColumn('woColInProgress', 'inprogress');
    renderColumn('woColReview', 'review');
    updateColumnCounts();
}

function renderColumn(containerId, status) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const orders = TechDB.workOrders.filter(w => w.status === status);
    container.innerHTML = orders.map(wo => `
        <div class="task-card ${wo.id === selectedWOId ? 'selected-task' : ''}" data-wo-id="${wo.id}" style="${wo.rejected ? 'border: 1.5px solid #ef4444; background: #fff1f2;' : ''}">
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
    TechDB.workOrders.forEach(w => { if (counts[w.status] !== undefined) counts[w.status]++; });
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
    // Status logic removed per request


    // Technician field updates dynamically
    setEl('selectedWOTechnician', wo.technician ? wo.technician : '<span style="color:#ef4444;font-style:italic">Unassigned (Rejected)</span>');

    // Update action buttons visibility
    const submitBtn = document.getElementById('btnSubmitForReview');
    const closeBtn = document.getElementById('btnCloseWO');
    const orderPartsBtn = document.getElementById('btnOrderParts');
    const reassignBlock = document.getElementById('reassignBlock');
    const reassignSelect = document.getElementById('reassignTechSelect');
    const reassignBtn = document.getElementById('btnReassign');

    if (reassignBlock) {
        if (wo.rejected) {
            reassignBlock.style.display = 'block';
            reassignBtn.onclick = () => {
                if (reassignSelect && reassignSelect.value) {
                    TechDB.updateWorkOrder(id, { technician: reassignSelect.value, rejected: false });
                    showToast(`Assigned ${id} to ${reassignSelect.value}`, 'success');
                    renderBoard();
                    selectWorkOrder(id);
                } else {
                    showToast('Please select a technician.', 'warning');
                }
            };
        } else {
            reassignBlock.style.display = 'none';
        }
    }

    const notesBlock = document.getElementById('woCompletionNotesDisplay');
    if (notesBlock) {
        notesBlock.style.display = 'none';
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


    if (submitBtn) submitBtn.onclick = () => {
        const notes = document.getElementById('completionNotes')?.value;
        TechDB.updateWorkOrder(id, { status: 'review', completionNotes: notes || '' });
        showToast(`Work order ${id} moved to Review.`, 'success');
        renderBoard();
        selectWorkOrder(id);
    };
    if (closeBtn) closeBtn.onclick = () => confirmCloseWO(id);
    // orderPartsBtn logic handled by btnShowForm above


    // Task execution flow
    updateTaskFlow(wo.status);
}

function updateTaskFlow(status) {
    const steps = ['new', 'approval', 'inprogress', 'review'];
    const activeIndex = status === 'new' ? 0 : status === 'approval' ? 1 : status === 'inprogress' ? 2 : 3;
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

window.addEventListener('load', () => {
    const btn = document.getElementById('btnSubmitCostEst');
    if (btn) {
        btn.addEventListener('click', () => { 
            if (selectedWOId) window.submitCostEstimate(selectedWOId); 
        });
    }
});

/* ─── Confirm close WO ────────────────────────────── */
function confirmCloseWO(id) {
    openModal({
        title: 'Close Work Order',
        bodyHTML: `<p>Are you sure you want to close <strong>${id}</strong> and move it to the archive?</p>`,
        confirmLabel: 'Close Work Order',
        cancelLabel: 'Cancel',
        danger: true,
        onConfirm: () => {
            TechDB.closeWorkOrder(id);
            showToast(`Work order ${id} closed and archived.`, 'success');
            renderBoard();
            renderArchive();
            selectedWOId = null;
            setEl('selectedWOTitle', 'Select a work order from the board');
        }
    });
}

/* ─── Type Selector ──────────────────────────────── */
function wireTypeSelector() {
    document.querySelectorAll('.wo-type-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.wo-type-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedType = opt.dataset.type;
        });
    });
}

window.triageRequest = function (id) {
    const sr = TechDB.serviceRequests.find(s => s.id === id);
    if (!sr) return;

    // Automatically open and scroll to the new work order form
    document.getElementById('newWOSetup')?.scrollIntoView({ behavior: 'smooth' });

    // Fill the form fields
    const assetInput = document.getElementById('inputAsset');
    if (assetInput) {
        assetInput.value = `${sr.location} - ${sr.description}`;
    }

    const priorityInput = document.getElementById('inputPriority');
    if (priorityInput && sr.priority) {
        let p = sr.priority.toLowerCase();
        if (p === 'critical') p = 'high';
        priorityInput.value = ['low', 'medium', 'high'].includes(p) ? p : 'medium';
    }

    // We add an attribute to the form to track that this is a dispatched SR
    document.getElementById('newWOForm').dataset.linkedSrId = id;
};

/* ─── Create New WO form ─────────────────────────── */
function wireNewWOForm() {
    const form = document.getElementById('newWOForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const asset    = document.getElementById('inputAsset')?.value.trim();
        const tech     = document.getElementById('inputTechnician')?.value;  // user_id or name
        const priority = document.getElementById('inputPriority')?.value;
        const estReq   = document.getElementById('inputEstimateReq')?.value === 'yes';

        if (!asset || !tech) {
            showToast('Please fill in asset and assign a technician.', 'warning');
            return;
        }

        const linkedSrId = form.dataset.linkedSrId || null;

        // Try posting to backend
        try {
            if (window.api) {
                // Resolve tech name from backendTechs cache if using UUIDs
                const techObj = backendTechs.find(t => t.user_id === tech);
                const techName = techObj ? techObj.name : tech;

                const payload = {
                    assigned_technician_id: techObj ? tech : null,
                    campus_id: 'cccc0000-0001-4000-8000-000000000000',
                    service_request_id: linkedSrId || null,
                    title: `${cap(selectedType)} maintenance: ${asset}`,
                    description: asset,
                    priority: priority || 'medium',
                    status: 'open',
                    type: selectedType,
                };

                const woData = await window.api.post('/work-orders', payload);
                if (woData && woData.work_order_id) {
                    console.log('[TechAdmin] Work order created in backend:', woData.work_order_id);
                    showToast(`Work order created (backend).`, 'success');

                    // Dispatch linked SR in backend
                    if (linkedSrId) {
                        await window.api.patch(`/service-requests/${linkedSrId}`, { status: 'in_progress' });
                        form.removeAttribute('data-linked-sr-id');
                    }

                    form.reset();
                    await renderServiceRequests();
                    renderBoard();
                    return;
                } else {
                    console.warn('[TechAdmin] Backend WO creation failed:', woData);
                }
            }
        } catch (err) {
            console.warn('[TechAdmin] Backend unavailable, creating WO locally:', err.message);
        }

        // Fallback: local TechDB
        const newWO = {
            id: generateId('WO'),
            title: `${cap(selectedType)} maintenance: ${asset}`,
            type: selectedType,
            priority,
            technician: tech,
            estimateRequired: estReq,
            status: 'new',
            linkedFault: null,
        };

        if (linkedSrId) {
            const sr = TechDB.serviceRequests.find(s => s.id === linkedSrId);
            if (sr) sr.status = 'Dispatched';
            newWO.sourceRequest = linkedSrId;
            form.removeAttribute('data-linked-sr-id');
        }

        TechDB.addWorkOrder(newWO);
        showToast(`Work order ${newWO.id} created.`, 'success');
        form.reset();
        await renderServiceRequests();
        renderBoard();
    });
}

/* ─── Initiate btn (header) ──────────────────────── */
function wireInitiateBtn() {
    document.getElementById('btnInitiateMaintenance')?.addEventListener('click', () => {
        document.getElementById('newWOSetup')?.scrollIntoView({ behavior: 'smooth' });
    });
}

/* ─── Archive table ──────────────────────────────── */
function renderArchive() {
    const tbody = document.getElementById('archiveBody');
    if (!tbody) return;

    const closed = TechDB.workOrders.filter(w => w.status === 'closed');
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
    if (String(val).includes('<')) el.innerHTML = val;
    else el.textContent = val;
}

/* ─── Service Requests Triage ──────────────────────── */
async function renderServiceRequests() {
    const container = document.getElementById("serviceRequestsContainer");
    if (!container) return;

    let requests = [];

    // Try backend first
    try {
        if (window.api) {
            const srData = await window.api.get('/service-requests');
            if (Array.isArray(srData)) {
                backendSRs = srData;
                requests = backendSRs.filter(sr => sr.status === 'open' || sr.status === 'pending');
                console.log('[TechAdmin] Loaded', requests.length, 'pending SRs from backend');
            }
        }
    } catch (err) {
        console.warn('[TechAdmin] SR backend fetch failed, using TechDB:', err.message);
    }

    // Fallback to TechDB
    if (!requests.length) {
        requests = TechDB.serviceRequests.filter(sr =>
            sr.status === 'Reported' || sr.status === 'Pending Category'
        );
    }

    const countBadge = document.getElementById("pendingRequestsCount");
    if (countBadge) countBadge.textContent = `${requests.length} Pending`;

    if (requests.length === 0) {
        container.parentElement.style.display = 'none';
        return;
    } else {
        container.parentElement.style.display = 'block';
    }

    // Render — handle both backend (service_request_id) and legacy (id) shapes
    container.innerHTML = requests.map(sr => {
        const srId     = sr.service_request_id || sr.id;
        const desc     = sr.description || sr.location || '—';
        const reporter = sr.requested_by_id ? `ID: ${sr.requested_by_id.slice(0,8)}…` : (sr.reporterName || 'Campus User');
        const date     = sr.created_at || sr.timestamp || new Date().toISOString();
        const priority = sr.priority || sr.severity || 'medium';
        return `
      <div class="alert-item card mb-12" style="border-left: 4px solid #f59e0b; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div style="flex:1">
          <h4 style="margin:0 0 4px 0;font-size:14px;color:var(--text-main);">${desc.slice(0, 80)}${desc.length > 80 ? '…' : ''}</h4>
          <div style="font-size:11px;color:#888;margin-top:4px;">Reported by ${reporter} • ${new Date(date).toLocaleDateString()} • Priority: <strong>${priority}</strong></div>
        </div>
        <div>
          <button class="btn btn-dark" style="padding: 6px 12px; font-size: 12px;" onclick="triageRequest('${srId}')">Create Work Order -></button>
        </div>
      </div>`;
    }).join('');
}
