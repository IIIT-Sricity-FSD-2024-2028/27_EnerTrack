/**
 * initiativesPage.js
 * Handles CRUD and UI rendering for the Sustainability Initiatives page.
 */
import SustDB from './data/mockData.js';
import SessionModule from './modules/session.js';
import { showToast, openModal, generateId } from './utils/utils.js';
import { injectIcons } from './utils/icons.js';

document.addEventListener("DOMContentLoaded", () => {
  SessionModule.initSession();
  injectIcons();
  renderInitiatives();
  wireForm();
});

// State flow for forward/backward transitions
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

// Render the entire pipeline based on SustDB
function renderInitiatives() {
  const initiatives = SustDB.initiatives;

  const proposedCols = document.getElementById("col-proposed");
  const inProgressCols = document.getElementById("col-in-progress");
  const approvedCols = document.getElementById("col-approved");
  const completedCols = document.getElementById("col-completed");

  if (!proposedCols || !inProgressCols || !approvedCols || !completedCols) return;

  // Clear existing
  proposedCols.innerHTML = "";
  inProgressCols.innerHTML = "";
  approvedCols.innerHTML = "";
  completedCols.innerHTML = "";

  let counts = { proposed: 0, "in-progress": 0, approved: 0, completed: 0 };

  initiatives.forEach(init => {
    const card = buildCard(init);
    counts[init.status]++;
    
    if (init.status === "proposed") {
      proposedCols.appendChild(card);
    } else if (init.status === "in-progress") {
      inProgressCols.appendChild(card);
    } else if (init.status === "approved") {
      approvedCols.appendChild(card);
    } else if (init.status === "completed") {
      completedCols.appendChild(card);
    }
  });

  // Toggle Visibility of Column Headers
  const toggleHeader = (colId, show) => {
    const el = document.getElementById(colId);
    if (el && el.previousElementSibling) {
        el.previousElementSibling.style.display = show ? "block" : "none";
    }
  };

  toggleHeader("col-proposed", counts.proposed > 0);
  toggleHeader("col-in-progress", counts["in-progress"] > 0);
  toggleHeader("col-approved", counts.approved > 0);
  toggleHeader("col-completed", counts.completed > 0);
}

function buildCard(init) {
  const div = document.createElement("div");
  div.className = `kanban-card ${init.onTrack === false ? 'offtrack' : ''}`;
  div.dataset.id = init.id;

  // Description
  const descHtml = init.description ? `<p class="kanban-desc">${init.description}</p>` : '';

  // Body: stats or outcomes
  let bodyHtml = "";
  if (init.status === "completed" && init.outcomes) {
    bodyHtml = `
      <div class="kanban-outcomes">
        ${init.outcomes.map(o => `<div class="outcome-pill">${o}</div>`).join('')}
      </div>
    `;
  } else {
    bodyHtml = `
      <div class="kanban-stats">
        <div class="kanban-stats-label">Target</div>
        <div class="kanban-stats-val">${init.target || '—'}</div>
        <div class="kanban-stats-label">Cost</div>
        <div class="kanban-stats-val">${init.cost || '—'}</div>
        <div class="kanban-stats-label">Timeline</div>
        <div class="kanban-stats-val">${(init.timeline || '—').split(' - ')[0]}</div>
      </div>
    `;
  }

  // On Track / Off Track toggle
  const trackHtml = init.status !== "completed" ? `
    <div class="kanban-track-toggle">
      <button class="track-btn ${init.onTrack !== false ? 'active on' : ''}" data-track="on">On Track</button>
      <button class="track-btn ${init.onTrack === false ? 'active off' : ''}" data-track="off">Off Track</button>
    </div>
  ` : '';

  // State transition buttons
  const nextState = getNextState(init.status);
  const prevState = getPrevState(init.status);

  let stateButtonsHtml = '';
  if (prevState) {
    stateButtonsHtml += `<button class="btn-state btn-state-prev" data-to="${prevState}">← ${formatStatus(prevState)}</button>`;
  }
  if (nextState) {
    stateButtonsHtml += `<button class="btn-state btn-state-next" data-to="${nextState}">${formatStatus(nextState)} →</button>`;
  }

  // Action buttons
  let actionButtonsHtml = `
    <button class="btn-action btn-edit-action">Edit</button>
  `;
  if (init.status === "completed") {
    actionButtonsHtml += `<button class="btn-action btn-archive-action">Archive</button>`;
  }
  actionButtonsHtml += `<button class="btn-action btn-delete-action">Delete</button>`;

  div.innerHTML = `
    <div class="kanban-header">
      <h5>${init.title}</h5>
    </div>
    ${descHtml}
    ${bodyHtml}
    ${trackHtml}
    <div class="kanban-state-row">
      ${stateButtonsHtml}
    </div>
    <div class="kanban-actions">
      ${actionButtonsHtml}
    </div>
  `;

  // Bind track toggle
  div.querySelectorAll('.track-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOn = btn.dataset.track === 'on';
      SustDB.updateInitiative(init.id, { onTrack: isOn });
      showToast(isOn ? "Marked 'On Track'" : "Marked 'Off Track'", isOn ? "success" : "warning");
      renderInitiatives();
    });
  });

  // Bind state transitions
  div.querySelectorAll('.btn-state').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newStatus = btn.dataset.to;
      SustDB.updateInitiative(init.id, { status: newStatus });
      SustDB.addHighlight("Status Update", `${init.title} → ${formatStatus(newStatus)}`, "blue");
      showToast(`Moved to ${formatStatus(newStatus)}`, "success");
      renderInitiatives();
    });
  });

  // Bind actions
  const bindAction = (selector, actionCallback) => {
      const btn = div.querySelector(selector);
      if (btn) {
          btn.addEventListener("click", (e) => {
              e.stopPropagation();
              actionCallback(e);
          });
      }
  };

  bindAction(".btn-edit-action", () => openEditModal(init));
  bindAction(".btn-archive-action", () => archiveInitiative(init.id));
  bindAction(".btn-delete-action", () => confirmDelete(init.id));

  return div;
}

function switchStatus(id, newStatus, msg) {
    const init = SustDB.initiatives.find(i => i.id === id);
    if (init) SustDB.addHighlight("Status Update", `${init.title} moved to ${newStatus}`, "blue");
    SustDB.updateInitiative(id, { status: newStatus });
    renderInitiatives();
    showToast(msg, "success");
}

function archiveInitiative(id) {
    const init = SustDB.initiatives.find(i => i.id === id);
    openModal({
        title: "Archive Initiative",
        bodyHTML: "<p>Archiving will remove this completed initiative from active view. Continue?</p>",
        confirmLabel: "Archive",
        danger: false,
        onConfirm: () => {
            if (init) {
                SustDB.addHighlight("Initiative Archived", init.title, "gray");

                // Read fresh from localStorage to get the full data tree
                const raw = localStorage.getItem('enertrack_universal_v1');
                const fullData = raw ? JSON.parse(raw) : {};

                if (fullData.sust) {
                    if (!Array.isArray(fullData.sust.initiativeArchives)) {
                        fullData.sust.initiativeArchives = [];
                    }
                    fullData.sust.initiativeArchives.unshift({
                        ...init,
                        archivedAt: new Date().toISOString(),
                        archiveType: 'initiative'
                    });

                    // Remove from active initiatives in the same data object
                    fullData.sust.initiatives = (fullData.sust.initiatives || []).filter(i => i.id !== id);

                    // Single atomic write
                    localStorage.setItem('enertrack_universal_v1', JSON.stringify(fullData));

                    // Sync in-memory state by reloading the page
                    showToast("Initiative archived", "info");
                    window.location.href = 'sust_archives.html';
                    return;
                }
            }
            SustDB.deleteInitiative(id);
            renderInitiatives();
            showToast("Initiative archived", "info");
            window.location.href = 'sust_archives.html';
        }
    });
}

function wireForm() {
    const btnPropose = document.querySelector(".btn-propose");
    if (!btnPropose) return;

    btnPropose.addEventListener("click", () => {
        const titleEl = document.getElementById("new-init-title");
        const descEl = document.getElementById("new-init-desc");
        const targetEl = document.getElementById("new-init-target");
        const costEl = document.getElementById("new-init-cost");
        const timelineEl = document.querySelector("#new-init-timeline .select-value");

        // ── Validation ──
        const title = titleEl ? titleEl.value.trim() : "";
        const desc = descEl ? descEl.value.trim() : "";
        const target = targetEl ? targetEl.value.trim() : "";
        const cost = costEl ? costEl.value.trim() : "";

        if (!title) {
            showToast("Title is required.", "error");
            return;
        }
        if (!desc) {
            showToast("Description is required.", "error");
            return;
        }
        if (!target) {
            showToast("Target Energy Reduction is required.", "error");
            return;
        }
        if (isNaN(parseFloat(target)) || !isFinite(target.replace('%', ''))) {
            showToast("Target Energy must be a valid number (e.g. 7.5).", "error");
            return;
        }
        if (!cost) {
            showToast("Estimated Cost is required.", "error");
            return;
        }
        // Strip $ and commas for validation
        const costClean = cost.replace(/[$,]/g, '');
        if (isNaN(parseFloat(costClean)) || !isFinite(costClean)) {
            showToast("Estimated Cost must be a valid number (e.g. 56500).", "error");
            return;
        }

        const newInit = {
            id: "init_" + generateId(),
            title: title,
            description: desc,
            target: target.includes('%') ? target : target + '%',
            cost: cost.startsWith('₹') ? cost : '₹' + cost,
            timeline: timelineEl ? timelineEl.textContent.trim() : "",
            status: "proposed",
            feasible: true,
            onTrack: true 
        };

        SustDB.addInitiative(newInit);
        SustDB.addHighlight("Initiative Proposed", title, "blue");
        
        showToast("Initiative proposed successfully!", "success");
        renderInitiatives();
        
        // Reset form
        titleEl.value = "";
        descEl.value = "";
        targetEl.value = "";
        costEl.value = "";
    });
}

function openEditModal(init) {
    const formHtml = `
      <div style="display:flex; flex-direction:column; gap: 12px;">
        <div>
          <label style="font-size:12px; font-weight:600; color:#6b7280; display:block; margin-bottom:4px;">Title</label>
          <input type="text" id="edit-init-title" style="width:100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" value="${init.title}">
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; color:#6b7280; display:block; margin-bottom:4px;">Description</label>
          <input type="text" id="edit-init-desc" style="width:100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" value="${init.description || ''}">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-size:12px; font-weight:600; color:#6b7280; display:block; margin-bottom:4px;">Target (%)</label>
            <input type="text" id="edit-init-target" style="width:100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" value="${init.target || ''}">
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:#6b7280; display:block; margin-bottom:4px;">Cost</label>
            <input type="text" id="edit-init-cost" style="width:100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" value="${init.cost || ''}">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-size:12px; font-weight:600; color:#6b7280; display:block; margin-bottom:4px;">Timeline</label>
            <select id="edit-init-timeline" style="width:100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #fff;">
                <option value="3 weeks - Assessment -> Procurement -> Install" ${(init.timeline || '').includes('3 weeks') ? 'selected' : ''}>3 weeks</option>
                <option value="6 weeks - Assessment -> Procurement -> Install -> QA" ${(init.timeline || '').includes('6 weeks') ? 'selected' : ''}>6 weeks</option>
                <option value="8 weeks - Assessment -> Procurement -> Install -> Validation" ${(init.timeline || '').includes('8 weeks') ? 'selected' : ''}>8 weeks</option>
                <option value="12 weeks - Multi-phase rollout" ${(init.timeline || '').includes('12 weeks') ? 'selected' : ''}>12 weeks</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:#6b7280; display:block; margin-bottom:4px;">Status</label>
            <select id="edit-init-status" style="width:100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #fff;">
                <option value="proposed" ${init.status === "proposed" ? "selected" : ""}>Proposed</option>
                <option value="approved" ${init.status === "approved" ? "selected" : ""}>Approved</option>
                <option value="in-progress" ${init.status === "in-progress" ? "selected" : ""}>In Progress</option>
                <option value="completed" ${init.status === "completed" ? "selected" : ""}>Completed</option>
            </select>
          </div>
        </div>
      </div>
    `;

    openModal({
        title: "Edit Initiative",
        bodyHTML: formHtml,
        confirmLabel: "Save Changes",
        onConfirm: () => {
            const title = document.getElementById("edit-init-title").value.trim();
            const description = document.getElementById("edit-init-desc").value.trim();
            const status = document.getElementById("edit-init-status").value;
            const target = document.getElementById("edit-init-target").value.trim();
            const cost = document.getElementById("edit-init-cost").value.trim();
            const timeline = document.getElementById("edit-init-timeline").value.trim();

            if (!title) {
                showToast("Title is required.", "error");
                return;
            }
            if (!description) {
                showToast("Description is required.", "error");
                return;
            }
            if (!target) {
                showToast("Target reduction is required.", "error");
                return;
            }
            const targetClean = target.replace('%', '');
            if (isNaN(parseFloat(targetClean)) || !isFinite(targetClean)) {
                showToast("Target must be a valid number (e.g. 7.5).", "error");
                return;
            }
            if (!cost) {
                showToast("Cost is required.", "error");
                return;
            }
            const costClean = cost.replace(/[₹$,]/g, '');
            if (isNaN(parseFloat(costClean)) || !isFinite(costClean)) {
                showToast("Cost must be a valid number (e.g. 56500).", "error");
                return;
            }
            if (!timeline) {
                showToast("Timeline is required.", "error");
                return;
            }

            SustDB.updateInitiative(init.id, { title, description, status, target, cost, timeline });
            SustDB.addHighlight("Initiative Edited", title, "yellow");
            
            showToast("Initiative updated", "success");
            renderInitiatives();
        }
    });
}

function confirmDelete(id) {
    openModal({
        title: "Delete Initiative",
        bodyHTML: "<p>Are you sure you want to permanently remove this initiative?</p>",
        danger: true,
        confirmLabel: "Delete",
        onConfirm: () => {
            const init = SustDB.initiatives.find(i => i.id === id);
            if (init) SustDB.addHighlight("Initiative Deleted", init.title, "gray");
            
            SustDB.deleteInitiative(id);
            showToast("Initiative deleted", "success");
            renderInitiatives();
        }
    });
}
