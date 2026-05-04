/**
 * initiativesPage.js — Sustainability Officer Initiatives
 * Fully wired to the NestJS backend via window.api.
 *
 * Backend field mapping:
 *   initiative_id   → card id
 *   created_by_id   → resolved from currentUser
 *   title           → card title
 *   status          → kanban column (proposed/approved/in-progress/completed)
 *   feasible        → boolean
 *   target_reduction → target %
 *   outcomes        → string[]
 */

import SessionModule from './modules/session.js';
import { showToast, openModal } from './utils/utils.js';
import { injectIcons } from './utils/icons.js';

const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

/* ─── State ────────────────────────────────────── */
var allInitiatives = [];

/* ─── Boot ──────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  SessionModule.initSession();
  injectIcons();
  loadInitiatives();
  wireForm();
});

/* ─── Load from backend ─────────────────────────── */
async function loadInitiatives() {
  try {
    const res = await window.api.get('/initiatives');
    if (res && !res.error) {
      allInitiatives = Array.isArray(res) ? res : (res.data || []);
      renderInitiatives();
    } else {
      showToast('Failed to load initiatives', 'error');
    }
  } catch (err) {
    console.error('[Initiatives] Load failed:', err);
    showToast('Could not connect to backend.', 'error');
  }
}

/* ─── State flow ────────────────────────────────── */
const STATE_ORDER = ["proposed", "approved", "in-progress", "completed"];

function getNextState(status) {
  const idx = STATE_ORDER.indexOf(status);
  return idx < STATE_ORDER.length - 1 ? STATE_ORDER[idx + 1] : null;
}
function getPrevState(status) {
  const idx = STATE_ORDER.indexOf(status);
  return idx > 0 ? STATE_ORDER[idx - 1] : null;
}
function formatStatus(status) {
  const map = { "proposed": "Proposed", "approved": "Approved", "in-progress": "In Progress", "completed": "Completed" };
  return map[status] || status;
}

/* ─── Render kanban ─────────────────────────────── */
function renderInitiatives() {
  const cols = {
    proposed:     document.getElementById("col-proposed"),
    "in-progress":document.getElementById("col-in-progress"),
    approved:     document.getElementById("col-approved"),
    completed:    document.getElementById("col-completed"),
  };

  Object.values(cols).forEach(c => { if (c) c.innerHTML = ""; });
  const counts = { proposed: 0, "in-progress": 0, approved: 0, completed: 0 };

  allInitiatives.forEach(init => {
    const card = buildCard(init);
    counts[init.status] = (counts[init.status] || 0) + 1;
    if (cols[init.status]) cols[init.status].appendChild(card);
  });

  // Toggle column headers
  Object.entries(cols).forEach(([key, el]) => {
    if (el && el.previousElementSibling) {
      el.previousElementSibling.style.display = counts[key] > 0 ? "block" : "none";
    }
  });
}

/* ─── Build card ────────────────────────────────── */
function buildCard(init) {
  const div = document.createElement("div");
  div.className = `kanban-card ${init.onTrack === false ? 'offtrack' : ''}`;
  div.dataset.id = init.initiative_id;

  const nextState = getNextState(init.status);
  const prevState = getPrevState(init.status);

  let stateButtonsHtml = '';
  if (prevState) stateButtonsHtml += `<button class="btn-state btn-state-prev" data-to="${prevState}">← ${formatStatus(prevState)}</button>`;
  if (nextState) stateButtonsHtml += `<button class="btn-state btn-state-next" data-to="${nextState}">${formatStatus(nextState)} →</button>`;

  const trackHtml = init.status !== "completed" ? `
    <div class="kanban-track-toggle">
      <button class="track-btn ${init.onTrack !== false ? 'active on' : ''}" data-track="on">On Track</button>
      <button class="track-btn ${init.onTrack === false ? 'active off' : ''}" data-track="off">Off Track</button>
    </div>` : '';

  let bodyHtml = '';
  if (init.status === "completed" && init.outcomes) {
    bodyHtml = `<div class="kanban-outcomes">${(init.outcomes || []).map(o => `<div class="outcome-pill">${o}</div>`).join('')}</div>`;
  } else {
    bodyHtml = `
      <div class="kanban-stats">
        <div class="kanban-stats-label">Target Reduction</div>
        <div class="kanban-stats-val">${init.target_reduction || '—'}</div>
        <div class="kanban-stats-label">Feasible</div>
        <div class="kanban-stats-val">${init.feasible ? 'Yes' : 'No'}</div>
      </div>`;
  }

  div.innerHTML = `
    <div class="kanban-header"><h5>${init.title}</h5></div>
    ${bodyHtml}
    ${trackHtml}
    <div class="kanban-state-row">${stateButtonsHtml}</div>
    <div class="kanban-actions">
      <button class="btn-action btn-edit-action">Edit</button>
      ${init.status === "completed" ? '<button class="btn-action btn-archive-action">Archive</button>' : ''}
      <button class="btn-action btn-delete-action">Delete</button>
    </div>
  `;

  // Track toggle
  div.querySelectorAll('.track-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isOn = btn.dataset.track === 'on';
      await patchInitiative(init.initiative_id, { feasible: isOn });
      showToast(isOn ? "Marked 'On Track'" : "Marked 'Off Track'", isOn ? "success" : "warning");
    });
  });

  // State transitions
  div.querySelectorAll('.btn-state').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await patchInitiative(init.initiative_id, { status: btn.dataset.to });
      showToast(`Moved to ${formatStatus(btn.dataset.to)}`, "success");
    });
  });

  // Action buttons
  const bindAction = (selector, cb) => {
    const b = div.querySelector(selector);
    if (b) b.addEventListener('click', (e) => { e.stopPropagation(); cb(); });
  };
  bindAction('.btn-edit-action', () => openEditModal(init));
  bindAction('.btn-archive-action', () => archiveInitiative(init.initiative_id));
  bindAction('.btn-delete-action', () => confirmDelete(init.initiative_id));

  return div;
}

/* ─── API helpers ───────────────────────────────── */
async function patchInitiative(id, patch) {
  try {
    const res = await window.api.patch(`/initiatives/${id}`, patch);
    if (res && !res.error) {
      // Update local cache
      const idx = allInitiatives.findIndex(i => i.initiative_id === id);
      if (idx !== -1) allInitiatives[idx] = { ...allInitiatives[idx], ...patch };
      renderInitiatives();
    } else {
      showToast('Update failed', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Update failed', 'error');
  }
}

async function deleteInitiative(id) {
  try {
    const res = await window.api.delete(`/initiatives/${id}`);
    if (res && !res.error) {
      allInitiatives = allInitiatives.filter(i => i.initiative_id !== id);
      renderInitiatives();
    } else {
      showToast('Delete failed', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Delete failed', 'error');
  }
}

/* ─── Wire form (Propose) ───────────────────────── */
function wireForm() {
  const btn = document.querySelector(".btn-propose");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const titleEl  = document.getElementById("new-init-title");
    const descEl   = document.getElementById("new-init-desc");
    const targetEl = document.getElementById("new-init-target");
    const timelineEl = document.querySelector("#new-init-timeline .select-value");

    const title  = titleEl?.value.trim()  || "";
    const desc   = descEl?.value.trim()   || "";
    const target = targetEl?.value.trim() || "";

    if (!title)  { showToast("Title is required.", "error"); return; }
    if (!desc)   { showToast("Description is required.", "error"); return; }
    if (!target) { showToast("Target Reduction is required.", "error"); return; }

    const payload = {
      created_by_id: currentUser.user_id || 'uuuu0000-0005-4000-8000-000000000000',
      title: title,
      status: "proposed",
      feasible: true,
      target_reduction: target.includes('%') ? target : target + '%',
      outcomes: [],
    };

    try {
      const res = await window.api.post('/initiatives', payload);
      if (res && !res.error) {
        allInitiatives.push(res);
        renderInitiatives();
        showToast("Initiative proposed successfully!", "success");
        if (titleEl)  titleEl.value  = "";
        if (descEl)   descEl.value   = "";
        if (targetEl) targetEl.value = "";
      } else {
        showToast('Failed to propose initiative', 'error');
      }
    } catch (err) {
      showToast('Could not connect to backend.', 'error');
    }
  });
}

/* ─── Edit modal ────────────────────────────────── */
function openEditModal(init) {
  openModal({
    title: "Edit Initiative",
    bodyHTML: `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">Title</label>
          <input type="text" id="edit-init-title" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;" value="${init.title}">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">Target Reduction</label>
          <input type="text" id="edit-init-target" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;" value="${init.target_reduction || ''}">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">Status</label>
          <select id="edit-init-status" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;">
            <option value="proposed"    ${init.status === "proposed"    ? "selected" : ""}>Proposed</option>
            <option value="approved"    ${init.status === "approved"    ? "selected" : ""}>Approved</option>
            <option value="in-progress" ${init.status === "in-progress" ? "selected" : ""}>In Progress</option>
            <option value="completed"   ${init.status === "completed"   ? "selected" : ""}>Completed</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">Feasible</label>
          <select id="edit-init-feasible" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;">
            <option value="true"  ${init.feasible !== false ? "selected" : ""}>Yes</option>
            <option value="false" ${init.feasible === false ? "selected" : ""}>No</option>
          </select>
        </div>
      </div>`,
    confirmLabel: "Save Changes",
    onConfirm: async () => {
      const title  = document.getElementById("edit-init-title")?.value.trim();
      const target = document.getElementById("edit-init-target")?.value.trim();
      const status = document.getElementById("edit-init-status")?.value;
      const feasible = document.getElementById("edit-init-feasible")?.value === "true";
      if (!title) { showToast("Title is required.", "error"); return false; }
      await patchInitiative(init.initiative_id, { title, target_reduction: target, status, feasible });
      showToast("Initiative updated", "success");
    }
  });
}

/* ─── Archive ───────────────────────────────────── */
function archiveInitiative(id) {
    const init = allInitiatives.find(i => i.initiative_id === id);
    if (!init) return;

    openModal({
      title: "Archive Initiative",
      bodyHTML: "<p>Archiving will remove this completed initiative from active view. Continue?</p>",
      confirmLabel: "Archive",
      danger: false,
      onConfirm: async () => {
        try {
          const raw = localStorage.getItem('enertrack_universal_v1');
          const data = raw ? JSON.parse(raw) : { sust: { initiativeArchives: [] } };
          if (!data.sust) data.sust = {};
          if (!data.sust.initiativeArchives) data.sust.initiativeArchives = [];
          
          data.sust.initiativeArchives.push({
            id: init.initiative_id,
            title: init.title,
            status: init.status,
            target: init.target_reduction,
            outcomes: init.outcomes,
            archivedAt: new Date().toISOString()
          });
          
          localStorage.setItem('enertrack_universal_v1', JSON.stringify(data));
        } catch (e) {
          console.warn("Failed to archive locally", e);
        }

        await deleteInitiative(id);
        showToast("Initiative archived", "info");
      }
    });
  }

/* ─── Delete ────────────────────────────────────── */
function confirmDelete(id) {
  openModal({
    title: "Delete Initiative",
    bodyHTML: "<p>Are you sure you want to permanently remove this initiative?</p>",
    danger: true,
    confirmLabel: "Delete",
    onConfirm: async () => {
      await deleteInitiative(id);
      showToast("Initiative deleted", "success");
    }
  });
}
