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

  // Default selection
  if (!currentSelectedId && initiatives.length > 0) {
    selectInitiative(initiatives[0].id);
  } else if (currentSelectedId) {
    // Make sure we select an existing initiative, otherwise select the first
    if (!SustDB.initiatives.find(i=>i.id === currentSelectedId)) {
        if(initiatives.length > 0) selectInitiative(initiatives[0].id);
    } else {
        selectInitiative(currentSelectedId);
    }
  }

  updateActiveCount();
}

function updateActiveCount() {
  const activeCount = SustDB.initiatives.filter(i => i.status === "approved" || i.status === "in-progress").length;
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
        <div class="kanban-stats-val">${init.cost || '₹0'}</div>
        <div class="kanban-stats-label">Timeline</div>
        <div class="kanban-stats-val">${init.timeline || 'N/A'}</div>
      </div>
    `;
  }

  let actionButtonsHtml = '';
  if (init.status === "proposed") {
      actionButtonsHtml += `<button class="btn-approve" style="color:#0f8f63; background:#ebf7f3; border: 1px solid #0f8f63; padding: 4px 8px; border-radius: 4px;">Approve</button>`;
  } else if (init.status === "approved") {
      actionButtonsHtml += `<button class="btn-start" style="color:#2e89ff; background:#ebf3ff; border: 1px solid #2e89ff; padding: 4px 8px; border-radius: 4px;">Start</button>`;
  } else if (init.status === "in-progress") {
      actionButtonsHtml += `<button class="btn-complete" style="color:#0f8f63; background:#ebf7f3; border: 1px solid #0f8f63; padding: 4px 8px; border-radius: 4px;">Complete</button>`;
  }

  if (init.status !== "completed") {
      actionButtonsHtml += `<button class="btn-edit" style="color:#374151; background:#f4f6f8; border: 1px solid #d8dde2; padding: 4px 8px; border-radius: 4px;">Edit</button>`;
  } else {
      actionButtonsHtml += `<button class="btn-archive" style="color:#8a95a2; background:#f4f6f8; border: 1px solid #d8dde2; padding: 4px 8px; border-radius: 4px;">Archive</button>`;
  }
  
  actionButtonsHtml += `<button class="btn-delete" style="color:#dc2626; background:#fef2f2; border: 1px solid #fca5a5; padding: 4px 8px; border-radius: 4px;">Delete</button>`;

  div.innerHTML = `
    <div class="kanban-header">
      <h5>${init.title}</h5>
      <span class="${badgeClass}">${badgeText}</span>
    </div>
    ${bodyHtml}
    <div class="kanban-actions" style="display: flex; gap: 8px; margin-top: 12px;">
      ${actionButtonsHtml}
    </div>
  `;

  // Action Event Attachment Utility
  const bindAction = (selector, actionCallback) => {
      const btn = div.querySelector(selector);
      if (btn) {
          btn.addEventListener("click", (e) => {
              e.stopPropagation();
              actionCallback(e);
          });
      }
  };

  bindAction(".btn-approve", () => switchStatus(init.id, "approved", "Initiative approved!"));
  bindAction(".btn-start", () => switchStatus(init.id, "in-progress", "Initiative moved to in-progress!"));
  bindAction(".btn-complete", () => switchStatus(init.id, "completed", "Initiative marked resolved!"));
  
  bindAction(".btn-edit", () => openEditModal(init));
  bindAction(".btn-archive", () => archiveInitiative(init.id));
  bindAction(".btn-delete", () => confirmDelete(init.id));

  div.addEventListener("click", () => {
    selectInitiative(init.id);
  });

  return div;
}

function switchStatus(id, newStatus, msg) {
    import('./utils/utils.js').then(utils => {
        const init = SustDB.initiatives.find(i => i.id === id);
        if (init) SustDB.addHighlight("Status Update", `${init.title} moved to ${newStatus}`, "blue");
        
        SustDB.updateInitiative(id, { status: newStatus });
        renderInitiatives();
        utils.showToast(msg, "success");
    });
}

function archiveInitiative(id) {
    import('./utils/utils.js').then(utils => {
        const init = SustDB.initiatives.find(i => i.id === id);
        utils.openModal({
            title: "Archive Initiative",
            bodyHTML: "<p>Archiving will remove this completed initiative from active view. Continue?</p>",
            confirmLabel: "Archive",
            danger: false,
            onConfirm: () => {
                if (init) SustDB.addHighlight("Initiative Archived", init.title, "gray");
                SustDB.deleteInitiative(id); // Treat archive as delete for mockData
                renderInitiatives();
                utils.showToast("Initiative archived", "info");
            }
        });
    });
}

function selectInitiative(id) {
    const init = SustDB.initiatives.find(i => i.id === id);
    if (!init) return;

    currentSelectedId = id;

    // UI Feedback for Kanban Cards
    document.querySelectorAll(".kanban-card").forEach(c => c.classList.remove("selected"));
    const card = document.querySelector(`.kanban-card[data-id="${id}"]`);
    if (card) card.classList.add("selected");

    // Populate panel title
    const panelTitle = document.querySelector(".col-span-2.flex-col-gap .panel-title");
    if (panelTitle) panelTitle.textContent = `${init.title}`;

    const setItem = (id, title, icon, contentHtml) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = `
            <div class="box-icon" data-icon="${icon}"></div>
            <div class="box-content">
                <h5>${title}</h5>
                ${contentHtml}
            </div>
        `;
    };

    // 1. Implementation tracking
    setItem("sel-targets", "Implementation tracking", "monitoring", `
        <p>${init.target || "N/A"} reduction goal established. Monitoring sub-feeders for baseline verification.</p>
    `);

    // 2. Progress (with bar)
    const progVal = init.status === "completed" ? 100 : (init.status === "in-progress" ? 65 : 15);
    setItem("sel-progress", "Progress", "compile", `
        <p>${progVal}% complete — ${init.status === "completed" ? "All phases finalized" : "On track for schedule"}</p>
        <div class="progress-mini"><div class="progress-mini-fill" style="width: ${progVal}%"></div></div>
    `);

    // 3. Initial evaluation (with bar)
    const evalTarget = parseFloat(init.target || 8);
    setItem("sel-evaluation", "Initial evaluation", "performance", `
        <p>${evalTarget}% projected monthly reduction across monitored sites.</p>
        <div class="progress-mini"><div class="progress-mini-fill" style="width: ${evalTarget * 5}%"></div></div>
    `);

    // 4. Resources
    setItem("sel-resources", "Resources", "technician", `
        <p><span class="status-dot green"></span>On-site facilities team assigned • External HVAC vendor approved.</p>
    `);

    // 5. Timeline
    setItem("sel-timeline", "Timeline", "calendar", `
        <p>Current: ${init.status} phase<br>Baseline: ${init.timeline || '5 weeks'}</p>
    `);

    // 6. Environmental impact
    const impact = parseFloat(init.target || 0) * 8.2;
    setItem("sel-impact", "Environmental impact", "carbon", `
        <p>Forecasted: <strong>${impact.toFixed(1)} tCO₂e</strong> monthly reduction post-implementation.</p>
    `);

    // 7. Risks
    setItem("sel-risks", "Risks", "alerts", `
        <p><span class="status-dot green"></span>No critical blockers. Supply chain for units is cleared.</p>
    `);

    // 8. Cost benefit
    setItem("sel-cost", "Cost benefit", "finance", `
        <p>${init.cost || "₹0"} baseline cost. ROI forecast ~2.1 years.</p>
    `);

    // Status track updates
    const badgeTrack = document.querySelector(".badge-track");
    if (badgeTrack) {
        badgeTrack.textContent = init.onTrack === false ? "Off Track" : "On Track";
        badgeTrack.style.background = init.onTrack === false ? "#dc2626" : "#0f9f6f";
    }

    // Toggle button states
    const btnOn = document.getElementById("btn-set-ontrack");
    const btnOff = document.getElementById("btn-set-offtrack");
    if (btnOn && btnOff) {
        btnOn.classList.toggle("active", init.onTrack !== false);
        btnOff.classList.toggle("active", init.onTrack === false);
    }

    injectIcons();
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
            SustDB.addHighlight("Initiative Edited", title, "yellow");
            
            showToast("Initiative updated", "success");
            renderInitiatives();
        }
    });
}

function confirmDelete(id) {
    // Need utils for openModal, but we already have it in scope if openModal is globally imported or directly referenced
    // Actually we are inside confirmDelete which calls openModal.
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
