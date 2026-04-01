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

let currentSelectedId = null;

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

  initiatives.forEach(init => {
    const card = buildCard(init);
    
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

  // Default selection
  if (!currentSelectedId && initiatives.length > 0) {
    selectInitiative(initiatives[0].id);
  } else if (currentSelectedId) {
    selectInitiative(currentSelectedId);
  }

  updateActiveCount();
}

function updateActiveCount() {
  const activeCount = SustDB.initiatives.filter(i => i.status !== "completed").length;
  const badge = document.querySelector(".badge-outline-green");
  if (badge) {
    badge.innerHTML = `<span style="display:inline-flex;width:14px;height:14px;margin-right:4px;" data-icon="compile"></span> ${activeCount} Active Initiatives`;
    injectIcons();
  }
}

function buildCard(init) {
  const div = document.createElement("div");
  div.className = `kanban-card ${currentSelectedId === init.id ? 'selected' : ''}`;
  div.dataset.id = init.id;

  const badgeClass = init.feasible ? "badge-feasible" : "badge-not-feasible";
  const badgeText = init.feasible ? "Feasible" : "Not Feasible";

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
        <div class="kanban-stats-val">${init.target || '0%'}</div>
        <div class="kanban-stats-label">Cost</div>
        <div class="kanban-stats-val">${init.cost || '$0'}</div>
        <div class="kanban-stats-label">Timeline</div>
        <div class="kanban-stats-val">${init.timeline || 'N/A'}</div>
      </div>
    `;
  }

  div.innerHTML = `
    <div class="kanban-header">
      <h5>${init.title}</h5>
      <span class="${badgeClass}">${badgeText}</span>
    </div>
    ${bodyHtml}
    <div class="kanban-actions">
      <button class="btn-edit" data-id="${init.id}">Edit</button>
      <button class="btn-delete" data-id="${init.id}">Delete</button>
    </div>
  `;

  // Attach events
  div.querySelector(".btn-edit").addEventListener("click", (e) => {
    e.stopPropagation();
    openEditModal(init);
  });
  div.querySelector(".btn-delete").addEventListener("click", (e) => {
    e.stopPropagation();
    confirmDelete(init.id);
  });
  
  div.addEventListener("click", () => {
    selectInitiative(init.id);
  });

  return div;
}

function selectInitiative(id) {
    const init = SustDB.initiatives.find(i => i.id === id);
    if (!init) return;

    currentSelectedId = id;

    // UI Feedback
    document.querySelectorAll(".kanban-card").forEach(c => c.classList.remove("selected"));
    const card = document.querySelector(`.kanban-card[data-id="${id}"]`);
    if (card) card.classList.add("selected");

    // Populate panel
    const panelTitle = document.querySelector(".col-span-2.flex-col-gap .panel-title");
    if (panelTitle) panelTitle.textContent = `${init.title}`;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = val;
    };

    setVal("sel-targets", `Targets<br>${init.target || "N/A"} reduction • Evaluated at all facility sub-meters • Project scope confirmed`);
    setVal("sel-progress", init.status === "completed" ? "100% complete — All installation and tuning phases finalized" : "On track for implementation schedule • No delays reported");
    setVal("sel-evaluation", `Initial evaluation<br>${init.target || "6%"} projected monthly kWh reduction across monitored buildings`);
    setVal("sel-resources", `Allocated Resources<br>On-site facilities team • External HVAC vendor • Replacement materials delivered`);
    setVal("sel-timeline", `Schedule state<br>Currently in ${init.status} phase • Progress matching baseline ${init.timeline || 'projections'}`);
    setVal("sel-impact", `Sustainability Impact<br>Forecasted at ${parseFloat(init.target || 0) * 8.2} tCO₂e reduced per month post-implementation`);
    setVal("sel-risks", "No critical risks identified. Supply chain for replacement units is cleared. Implementation team is fully staffed.");
    setVal("sel-cost", `${init.cost || "$0"} baseline cost • ROI verified at ~2.1 years based on local utility rates`);

    // Status track updates
    const badgeTrack = document.querySelector(".badge-track");
    if (badgeTrack) {
        badgeTrack.textContent = init.onTrack === false ? "Off Track" : "On Track";
        badgeTrack.style.background = init.onTrack === false ? "#dc2626" : "#0f9f6f";
    }
}



function wireForm() {
    const btnPropose = document.querySelector(".btn-dark");
    if (!btnPropose) return;

    btnPropose.addEventListener("click", () => {
        const titleEl = document.getElementById("new-init-title");
        const descEl = document.getElementById("new-init-desc");
        const targetEl = document.getElementById("new-init-target");
        const costEl = document.getElementById("new-init-cost");
        const timelineEl = document.querySelector("#new-init-timeline .select-value");
        
        if (!titleEl || !titleEl.value.trim()) {
            showToast("Title is required", "error");
            return;
        }

        const newInit = {
            id: "init_" + generateId(),
            title: titleEl.value.trim(),
            description: descEl ? descEl.value.trim() : "",
            target: targetEl ? targetEl.value.trim() : "",
            cost: costEl ? costEl.value.trim() : "",
            timeline: timelineEl ? timelineEl.textContent.trim() : "",
            status: "proposed",
            feasible: true,
            onTrack: true 
        };

        SustDB.addInitiative(newInit);
        showToast("Initiative proposed successfully!", "success");
        renderInitiatives();
        
        // Reset form
        titleEl.value = "";
        descEl.value = "";
        targetEl.value = "";
        costEl.value = "";
    });

    // Wire selection buttons
    const btnOnTrack = document.getElementById("btn-set-ontrack");
    const btnOffTrack = document.getElementById("btn-set-offtrack");

    if (btnOnTrack) {
        btnOnTrack.addEventListener("click", () => {
            if (!currentSelectedId) return;
            SustDB.updateInitiative(currentSelectedId, { onTrack: true });
            selectInitiative(currentSelectedId);
            showToast("Strategy updated to 'On Track'", "success");
        });
    }
    if (btnOffTrack) {
        btnOffTrack.addEventListener("click", () => {
            if (!currentSelectedId) return;
            SustDB.updateInitiative(currentSelectedId, { onTrack: false });
            selectInitiative(currentSelectedId);
            showToast("Strategy marked 'Off Track'", "warning");
        });
    }
}

function openEditModal(init) {
    const formHtml = `
      <div style="display:flex; flex-direction:column; gap: 10px;">
        <label>Title</label>
        <input type="text" id="edit-init-title" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;" value="${init.title}">
        
        <label>Status</label>
        <select id="edit-init-status" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="proposed" ${init.status === "proposed" ? "selected" : ""}>Proposed</option>
            <option value="approved" ${init.status === "approved" ? "selected" : ""}>Approved</option>
            <option value="in-progress" ${init.status === "in-progress" ? "selected" : ""}>In Progress</option>
            <option value="completed" ${init.status === "completed" ? "selected" : ""}>Completed</option>
        </select>
        
        <label>Feasibility</label>
        <select id="edit-init-feasible" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="true" ${init.feasible ? "selected" : ""}>Feasible</option>
            <option value="false" ${!init.feasible ? "selected" : ""}>Not Feasible</option>
        </select>
        
        <label>Target (%)</label>
        <input type="text" id="edit-init-target" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;" value="${init.target || ''}">
      </div>
    `;

    openModal({
        title: "Edit Initiative",
        bodyHTML: formHtml,
        confirmLabel: "Save Changes",
        onConfirm: () => {
            const title = document.getElementById("edit-init-title").value;
            const status = document.getElementById("edit-init-status").value;
            const feasible = document.getElementById("edit-init-feasible").value === "true";
            const target = document.getElementById("edit-init-target").value;

            if (!title) {
                showToast("Title is required", "error");
                return;
            }

            SustDB.updateInitiative(init.id, { title, status, feasible, target });
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
            SustDB.deleteInitiative(id);
            showToast("Initiative deleted", "success");
            renderInitiatives();
        }
    });
}
