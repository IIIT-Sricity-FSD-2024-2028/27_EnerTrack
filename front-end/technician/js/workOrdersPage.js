/**
 * workOrdersPage.js
 * Handles interactivity for the Maintenance Work Orders page.
 * CRUD: create new WO, update type/priority/status, close WO, kanban board render.
 */
import TechDB from './data/mockData.js';
import { showToast, openModal, generateId } from './utils/utils.js';

<<<<<<< HEAD
const SS_KEY = 'enertrack.tech.workorders';
=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
let selectedWOId = null;
let selectedType = 'scheduled';

document.addEventListener("DOMContentLoaded", () => {
    try {
        initWorkOrders();
        console.log("TechWorkOrders: Initialized.");
    } catch (err) {
        console.error("TechWorkOrders: Init error:", err);
    }
});

function initWorkOrders() {
<<<<<<< HEAD
    // Restore persisted state
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '{}'); } catch { return {}; } })();
    if (saved.selectedType) selectedType = saved.selectedType;

=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
    renderBoard();
    renderArchive();
    wireTypeSelector();
    wireNewWOForm();
    wireInitiateBtn();

<<<<<<< HEAD
    // Restore active type button
    document.querySelectorAll('.wo-type-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.type === selectedType);
    });

    // Restore selected WO or default to first
    const restoredWO = saved.selectedWOId && TechDB.getWorkOrder(saved.selectedWOId);
    const first = TechDB.workOrders.find(w => w.status !== 'closed');
    if (restoredWO) selectWorkOrder(restoredWO.id);
    else if (first) selectWorkOrder(first.id);
=======
    // Select first WO by default
    const first = TechDB.workOrders.find(w => w.status !== 'closed');
    if (first) selectWorkOrder(first.id);
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
}

/* ─── Kanban Board Render ────────────────────────── */
function renderBoard() {
    renderColumn('woColNew',        'new');
    renderColumn('woColInProgress', 'inprogress');
    renderColumn('woColReview',     'review');
    updateColumnCounts();
}

function renderColumn(containerId, status) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const orders = TechDB.workOrders.filter(w => w.status === status);
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
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        Parts: ${wo.parts ? 'Available' : 'Needed'}
                    </span>
                </div>
        </div>
    `).join('') || `<div style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">No work orders</div>`;

    container.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('click', () => selectWorkOrder(card.dataset.woId));
    });
}

function updateColumnCounts() {
    const counts = { new: 0, inprogress: 0, review: 0 };
    TechDB.workOrders.forEach(w => { if (counts[w.status] !== undefined) counts[w.status]++; });
    setEl('countNew', counts.new);
    setEl('countInProgress', counts.inprogress);
    setEl('countReview', counts.review);
}

/* ─── Select a Work Order ────────────────────────── */
function selectWorkOrder(id) {
    selectedWOId = id;
<<<<<<< HEAD
    // Persist selection
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ selectedWOId: id, selectedType })); } catch (_) {}
=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
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
    const checkSvg = `<svg width="14" height="14" style="vertical-align:middle; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    const crossSvg = `<svg width="14" height="14" style="vertical-align:middle; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    setEl('selectedWOParts', wo.parts ? `${checkSvg} Available` : `${crossSvg} Parts Needed`);

    // Update action buttons visibility
    const submitBtn      = document.getElementById('btnSubmitForReview');
    const closeBtn       = document.getElementById('btnCloseWO');
    const orderPartsBtn  = document.getElementById('btnOrderParts');

    if (submitBtn) submitBtn.onclick = () => moveWOStatus(id, 'review');
    if (closeBtn)  closeBtn.onclick  = () => confirmCloseWO(id);
    if (orderPartsBtn) {
        orderPartsBtn.onclick = () => {
            showToast(`Parts order initiated for ${id}.`, 'info');
        };
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
<<<<<<< HEAD
            // Persist type selection
            try { sessionStorage.setItem(SS_KEY, JSON.stringify({ selectedWOId, selectedType })); } catch (_) {}
=======
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
        });
    });
}

/* ─── Create New WO form ─────────────────────────── */
function wireNewWOForm() {
    const form = document.getElementById('newWOForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const asset      = document.getElementById('inputAsset')?.value.trim();
        const window_    = document.getElementById('inputWindow')?.value.trim();
        const tech       = document.getElementById('inputTechnician')?.value;
        const priority   = document.getElementById('inputPriority')?.value;
        const parts      = document.getElementById('inputParts')?.value === 'yes';

        if (!asset || !tech) {
            showToast('Please fill in asset and assign a technician.', 'warning');
            return;
        }

        const newWO = {
            id: generateId('WO'),
            title: `${cap(selectedType)} maintenance: ${asset}`,
            type: selectedType,
            priority,
            technician: tech,
            parts,
            status: 'new',
            linkedFault: null,
        };

        TechDB.addWorkOrder(newWO);
        showToast(`Work order ${newWO.id} created successfully.`, 'success');
        form.reset();
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
    if (String(val).includes('<svg')) el.innerHTML = val;
    else el.textContent = val;
}
