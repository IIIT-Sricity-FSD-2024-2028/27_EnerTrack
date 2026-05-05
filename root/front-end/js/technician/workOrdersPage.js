/**
 * workOrdersPage.js
 * Handles interactivity for the Maintenance Work Orders page.
 * CRUD: create new WO, update type/priority/status, close WO, kanban board render.
 * Backend-wired: /api/users, /api/service-requests, /api/work-orders
 */
import TechDB from "./data/mockData.js";
import { showToast, openModal, generateId } from "./utils/utils.js";

let selectedWOId = null;
let selectedType = "scheduled";
let backendTechs = []; // cached from /api/users
let backendSRs = []; // cached from /api/service-requests

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
  const select = document.getElementById("inputTechnician");
  const reassignSelect = document.getElementById("reassignTechSelect");

  // Try backend first
  try {
    if (window.api) {
      const users = await window.api.get("/users");
      if (Array.isArray(users)) {
        backendTechs = users.filter(
          (u) =>
            u.role === "Technician" || u.role === "Technician Administrator",
        );
        const opts =
          `<option value="">— Select —</option>` +
          backendTechs
            .map(
              (t) =>
                `<option value="${t.user_id}" data-name="${t.name}">${t.name}</option>`,
            )
            .join("");
        if (select) select.innerHTML = opts;
        if (reassignSelect)
          reassignSelect.innerHTML =
            `<option value="">-- Select Alternate Tech --</option>` +
            backendTechs
              .map(
                (t) =>
                  `<option value="${t.user_id}" data-name="${t.name}">${t.name}</option>`,
              )
              .join("");
        console.log(
          "[TechAdmin] Loaded",
          backendTechs.length,
          "technicians from backend",
        );
        return;
      }
    }
  } catch (err) {
    console.warn(
      "[TechAdmin] Backend tech lookup failed, using localStorage:",
      err.message,
    );
  }

  // Fallback: localStorage registeredUsers
  const KNOWN_TECHNICIANS = [
    {
      name: "Teja",
      email: "teja@gmail.com",
      phone: "9876543214",
      password: "Teja@123",
      role: "Technician",
      user_id: "550e8400-0004-4000-8000-000000000004",
    },
  ];
  let registeredUsers = JSON.parse(
    localStorage.getItem("registeredUsers") || "[]",
  );
  let dirty = false;
  KNOWN_TECHNICIANS.forEach((kt) => {
    if (
      !registeredUsers.some(
        (u) => u.email.toLowerCase() === kt.email.toLowerCase(),
      )
    ) {
      registeredUsers.push(kt);
      dirty = true;
    }
  });
  if (dirty)
    localStorage.setItem("registeredUsers", JSON.stringify(registeredUsers));

  // Build backendTechs from fallback registeredUsers so form submission can find technicians
  backendTechs = registeredUsers.filter(
    (u) => u.role === "Technician" || u.role === "Technician Administrator",
  );

  const techs = registeredUsers.filter(
    (u) => u.role === "Technician" || u.role === "Technician Administrator",
  );
  const optionsHTML =
    `<option value="">— Select —</option>` +
    techs.map((t) => `<option value="${t.user_id || t.name}">${t.name}</option>`).join("");
  if (select) select.innerHTML = optionsHTML;
  if (reassignSelect)
    reassignSelect.innerHTML =
      `<option value="">-- Select Alternate Tech --</option>` +
      techs.map((t) => `<option value="${t.user_id || t.name}">${t.name}</option>`).join("");
}

/* ─── Sync backend work orders into TechDB ───────── */
async function syncBackendWorkOrders() {
  try {
    if (!window.api) return;
    const backendWOs = await window.api.get("/work-orders");
    if (!Array.isArray(backendWOs)) return;

    // Merge backend WOs into TechDB (avoid duplicates by work_order_id)
    backendWOs.forEach((bwo) => {
      const existing = TechDB.workOrders.find(
        (w) => w.id === bwo.work_order_id || w.work_order_id === bwo.work_order_id
      );
      if (!existing) {
        // Resolve technician name for display
        let techName = bwo.assigned_to_id || "Unassigned";
        if (techName.startsWith("uuuu")) {
          const found = backendTechs.find((t) => t.user_id === techName);
          techName = found ? found.name : techName;
        }

        TechDB.workOrders.push({
          id: bwo.work_order_id,
          work_order_id: bwo.work_order_id,
          title: bwo.title,
          type: bwo.details?.type || "scheduled",
          priority: bwo.priority,
          technician: techName,
          assigned_to_id: bwo.assigned_to_id,
          description: bwo.details?.description || "",
          estimateRequired: bwo.details?.estimateRequired || false,
          estimate: bwo.details?.estimate || null,
          resolution_notes: bwo.details?.resolution_notes || null,
          status: bwo.status,
          linkedFault: bwo.linked_fault_id || null,
          sourceRequest: bwo.source_request_id || null,
        });
      } else {
        // Update existing record with the latest state
        existing.status = bwo.status;
        existing.estimate = bwo.details?.estimate || existing.estimate;
        existing.resolution_notes = bwo.details?.resolution_notes || existing.resolution_notes;
      }
    });

    console.log("[TechAdmin] Synced", backendWOs.length, "work orders from backend.");
  } catch (err) {
    console.warn("[TechAdmin] Backend WO sync failed:", err.message);
  }
}

async function initWorkOrders() {
  await syncBackendWorkOrders();
  renderBoard();
  renderArchive();
  await renderServiceRequests();
  wireTypeSelector();
  wireNewWOForm();

  // Select first WO by default
  const first = TechDB.workOrders.find((w) => w.status !== "closed");
  if (first) selectWorkOrder(first.id);
}

/* ─── Kanban Board Render ────────────────────────── */
function renderBoard() {
  renderColumn("woColNew", "new");
  renderColumn("woColApproval", "approval");
  renderColumn("woColInProgress", "inprogress");
  renderColumn("woColReview", "review");
  updateColumnCounts();
}

function renderColumn(containerId, status) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const orders = TechDB.workOrders.filter((w) => w.status === status);
  container.innerHTML =
    orders
      .map((wo) => {
        // Resolve tech name
        let techName = wo.technician || "Unassigned";
        if (techName.startsWith("uuuu")) {
          const found = backendTechs.find((t) => t.user_id === techName);
          techName = found ? found.name : "Assigned Tech";
        }
        
        // Resolve asset (fallback to description or type if missing)
        const assetName = wo.description || wo.asset || "General Maintenance";

        return `
        <div class="task-card ${wo.id === selectedWOId ? "selected-task" : ""}" data-wo-id="${wo.id}" style="${wo.rejected ? "border: 1.5px solid #ef4444; background: #fff1f2;" : ""}">
            <div class="task-title">
                ${formatWOId(wo.id)}
                <span class="priority-tag priority-${wo.priority}">${cap(wo.priority)}</span>
            </div>
            <div>${wo.title}</div>
                <div style="margin-top:8px; font-size:11px; color:var(--muted); display:flex; flex-direction:column; gap:6px;">
                    <span style="display:inline-flex;align-items:center;gap:6px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <strong>Tech:</strong> ${techName}
                    </span>
                    <span style="display:inline-flex;align-items:center;gap:6px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <strong>Asset:</strong> ${assetName}
                    </span>
                    <span style="display:inline-flex;align-items:center;gap:6px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        <strong>Estimate:</strong> ${wo.estimate ? "Submitted" : "Needed"}
                    </span>
                </div>
        </div>
    `;
      })
      .join("") ||
    `<div style="font-size:12px; color:var(--muted); text-align:center; padding:14px;">No work orders</div>`;

  container.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("click", () => selectWorkOrder(card.dataset.woId));
  });
}

function updateColumnCounts() {
  const counts = { new: 0, approval: 0, inprogress: 0, review: 0 };
  TechDB.workOrders.forEach((w) => {
    if (counts[w.status] !== undefined) counts[w.status]++;
  });
  setEl("countNew", counts.new);
  setEl("countApproval", counts.approval);
  setEl("countInProgress", counts.inprogress);
  setEl("countReview", counts.review);
}

/* ─── Select a Work Order ────────────────────────── */
function selectWorkOrder(id) {
  selectedWOId = id;
  const wo = TechDB.getWorkOrder(id);
  if (!wo) return;

  // Highlight selected card
  document
    .querySelectorAll(".task-card")
    .forEach((c) => c.classList.remove("selected-task"));
  document
    .querySelector(`.task-card[data-wo-id="${id}"]`)
    ?.classList.add("selected-task");

  // Update detail panel
  setEl("selectedWOTitle", `Selected Work Order — ${formatWOId(wo.id)}`);
  setEl("selectedWOStatus", wo.status);
  setEl("selectedWOType", wo.type || "Maintenance");
  setEl("selectedWOPriority", wo.priority);
  setEl("selectedWOTechnician", wo.technician || "Unassigned");

  // Update Cost Estimate Display
  const costStatusEl = document.getElementById("selectedWOCost");
  if (costStatusEl) {
    if (wo.estimate) {
      costStatusEl.innerHTML = `<span style="color:#10b981; font-weight:600;">Submitted (₹${wo.estimate.total})</span>`;
    } else {
      costStatusEl.innerHTML = `<span style="color:#ef4444; font-weight:600;">Required / Not Submitted</span>`;
    }
  }

  // System Operational Check Panel Update
  const actionTitle = document.getElementById("actionPanelTitle");
  const actionOptions = document.getElementById("actionPanelOptions");
  if (actionTitle && actionOptions) {
    if (wo.status === "review" || wo.status === "closed") {
      actionTitle.textContent = "Resolution Details";
      actionOptions.innerHTML = `
        <div class="option active" style="grid-column: span 2;">
          <b>Technician Comments</b>
          <p style="margin-top:4px; padding:10px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:4px; font-size:13px; color:#374151;">
            ${wo.resolution_notes || "No notes provided."}
          </p>
        </div>
      `;
    } else {
      actionTitle.textContent = "System Operational Check";
      actionOptions.innerHTML = `
        <div class="option active">
          <b>Operational</b>
          <p>Document completion and submit for review.</p>
          <textarea id="completionNotes" placeholder="Enter resolution details..." style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; padding: 6px; font-size: 12px; margin-bottom: 6px; resize: vertical; min-height: 40px;"></textarea>
          <button class="btn btn-dark btn-full" id="btnSubmitForReview">Submit for Review</button>
        </div>
        <div class="option">
          <b>Not Operational</b>
          <p>Keep WO in-progress pending further work.</p>
          <button class="btn btn-light btn-full" onclick="showToast('Task marked on hold.', 'info')">Mark On Hold</button>
        </div>
      `;
    }
  }
  // Status logic removed per request

  // Technician field updates dynamically
  setEl(
    "selectedWOTechnician",
    wo.technician
      ? wo.technician
      : '<span style="color:#ef4444;font-style:italic">Unassigned (Rejected)</span>',
  );

  // Update action buttons visibility
  const submitBtn = document.getElementById("btnSubmitForReview");
  const closeBtn = document.getElementById("btnCloseWO");
  const orderPartsBtn = document.getElementById("btnOrderParts");
  const reassignBlock = document.getElementById("reassignBlock");
  const reassignSelect = document.getElementById("reassignTechSelect");
  const reassignBtn = document.getElementById("btnReassign");

  if (reassignBlock) {
    if (wo.rejected) {
      reassignBlock.style.display = "block";
      reassignBtn.onclick = async () => {
        if (reassignSelect && reassignSelect.value) {
          try {
            if (window.api) {
              await window.api.patch(`/work-orders/${id}`, {
                assigned_to_id: reassignSelect.value,
                status: "new"
              });
            }
          } catch(e) { console.warn("Backend reassign failed:", e); }

          TechDB.updateWorkOrder(id, {
            technician: reassignSelect.value,
            rejected: false,
            status: "new"
          });
          showToast(`Assigned ${id} to ${reassignSelect.value}`, "success");
          renderBoard();
          selectWorkOrder(id);
        } else {
          showToast("Please select a technician.", "warning");
        }
      };
    } else {
      reassignBlock.style.display = "none";
    }
  }

  const notesBlock = document.getElementById("woCompletionNotesDisplay");
  if (notesBlock) {
    notesBlock.style.display = "none";
  }

  // Toggle Cost Form
  const btnShowForm = document.getElementById("btnShowCostForm");
  const costEstBlock = document.getElementById("costEstimateBlock");
  if (btnShowForm && costEstBlock) {
    costEstBlock.style.display = "none";
    btnShowForm.onclick = () => {
      costEstBlock.style.display =
        costEstBlock.style.display === "none" ? "block" : "none";
    };
  }

  if (submitBtn)
    submitBtn.onclick = () => {
      const notes = document.getElementById("completionNotes")?.value;
      TechDB.updateWorkOrder(id, {
        status: "review",
        completionNotes: notes || "",
      });
      showToast(`Work order ${id} moved to Review.`, "success");
      renderBoard();
      selectWorkOrder(id);
    };
  if (closeBtn) closeBtn.onclick = () => confirmCloseWO(id);
  // orderPartsBtn logic handled by btnShowForm above

  // Task execution flow
  updateTaskFlow(wo.status);
}

function updateTaskFlow(status) {
  const steps = ["new", "approval", "inprogress", "review"];
  const activeIndex =
    status === "new"
      ? 0
      : status === "approval"
        ? 1
        : status === "inprogress"
          ? 2
          : 3;
  steps.forEach((s, i) => {
    const el = document.getElementById(`step-${s}`);
    if (el) {
      el.classList.toggle("active", i <= activeIndex);
    }
  });
}

/* ─── Move WO to new status ──────────────────────── */
function moveWOStatus(id, newStatus) {
  TechDB.updateWorkOrder(id, { status: newStatus });
  showToast(`Work order ${id} moved to ${cap(newStatus)}.`, "success");
  renderBoard();
  selectWorkOrder(id);
}

window.submitCostEstimate = function (id) {
  const materials = document.getElementById("estMaterials").value;
  const labor = document.getElementById("estLabor").value;
  if (!materials || !labor) {
    showToast("Please enter both materials and labor costs.", "warning");
    return;
  }
  const total = Number(materials) + Number(labor);
  if (total > 0) {
    TechDB.updateWorkOrder(id, {
      status: "approval",
      estimate: {
        materials: Number(materials),
        labor: Number(labor),
        total,
        type: "repair",
      },
    });
    showToast("Cost estimate submitted. Waiting for approval.", "success");
    document.getElementById("costEstimateBlock").style.display = "none";
    renderBoard();
    selectWorkOrder(id);
  }
};

window.addEventListener("load", () => {
  const btn = document.getElementById("btnSubmitCostEst");
  if (btn) {
    btn.addEventListener("click", () => {
      if (selectedWOId) window.submitCostEstimate(selectedWOId);
    });
  }
});

/* ─── Confirm close WO ────────────────────────────── */
function confirmCloseWO(id) {
  openModal({
    title: "Close Work Order",
    bodyHTML: `<p>Are you sure you want to close <strong>${formatWOId(id)}</strong> and move it to the archive?</p>`,
    confirmLabel: "Close Work Order",
    cancelLabel: "Cancel",
    danger: true,
    onConfirm: async () => {
      try {
        const currentWO = TechDB.getWorkOrder(id);
        const linkedRequestId =
          (currentWO &&
            (currentWO.source_request_id ||
              currentWO.sourceRequest ||
              currentWO.source_request)) ||
          null;

        if (window.api && id.includes("-")) {
          await window.api.patch(`/work-orders/${id}`, { status: "closed" });

          // Keep source request lifecycle aligned with the archived work order.
          if (linkedRequestId) {
            await window.api.patch(`/service-requests/${linkedRequestId}`, {
              status: "closed",
            });
          }
        }
      } catch (err) {
        console.warn("Backend close failed:", err);
      }
      TechDB.closeWorkOrder(id);
      showToast(`Work order ${formatWOId(id)} closed and archived.`, "success");
      renderBoard();
      renderArchive();
      await renderServiceRequests();
      selectedWOId = null;
      
      // Clear Detail Panel
      setEl("selectedWOTitle", "Select a work order from the board");
      setEl("selectedWOStatus", "—");
      setEl("selectedWOType", "—");
      setEl("selectedWOPriority", "—");
      setEl("selectedWOTechnician", "—");
      
      const costEl = document.getElementById("selectedWOCost");
      if (costEl) costEl.innerHTML = "—";
      
      const actionTitle = document.getElementById("actionPanelTitle");
      const actionOptions = document.getElementById("actionPanelOptions");
      if (actionTitle && actionOptions) {
          actionTitle.textContent = "System Operational Check";
          actionOptions.innerHTML = "";
      }
      
      document.querySelectorAll(".task-card").forEach((c) => c.classList.remove("selected-task"));
    },
  });
}

/* ─── Type Selector ──────────────────────────────── */
function wireTypeSelector() {
  document.querySelectorAll(".wo-type-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document
        .querySelectorAll(".wo-type-option")
        .forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      selectedType = opt.dataset.type;
    });
  });
}

window.triageRequest = function (id) {
  const sr = backendSRs.find((s) => s.service_request_id === id) || TechDB.serviceRequests.find((s) => s.id === id);
  if (!sr) return;

  // Automatically open and scroll to the new work order form
  document.getElementById("newWOSetup")?.scrollIntoView({ behavior: "smooth" });

  // Fill the form fields
  const assetInput = document.getElementById("inputAsset");
  if (assetInput) {
    // Backend SRs have description with full details; local TechDB has location and description separate
    const assetText = sr.description || sr.location || "Service Request";
    assetInput.value = assetText;
  }

  const priorityInput = document.getElementById("inputPriority");
  if (priorityInput && sr.priority) {
    let p = sr.priority.toLowerCase();
    if (p === "critical") p = "high";
    priorityInput.value = ["low", "medium", "high"].includes(p) ? p : "medium";
  }

  // We add an attribute to the form to track that this is a dispatched SR
  document.getElementById("newWOForm").dataset.linkedSrId = id;
};

/* ─── Create New WO form ─────────────────────────── */
function wireNewWOForm() {
  const form = document.getElementById("newWOForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const asset = document.getElementById("inputAsset")?.value.trim();
    const tech = document.getElementById("inputTechnician")?.value; // user_id or name
    const priority = document.getElementById("inputPriority")?.value;
    const estReq = document.getElementById("inputEstimateReq")?.value === "yes";

    if (!asset || !tech) {
      showToast("Please fill in asset and assign a technician.", "warning");
      return;
    }

    const linkedSrId = form.dataset.linkedSrId || null;

    // Try posting to backend
    try {
      if (window.api) {
        // Resolve tech object - search by user_id first, then by name
        let techObj = backendTechs.find((t) => t.user_id === tech);
        if (!techObj) {
          techObj = backendTechs.find((t) => t.name === tech);
        }
        const techName = techObj ? techObj.name : tech;
        const techId = techObj ? techObj.user_id : null;

        const payload = {
          assigned_to_id: techId,
          source_request_id: linkedSrId || null,
          title: `${cap(selectedType)} maintenance: ${asset}`,
          priority: priority || "medium",
          status: "new",
          details: {
            description: asset,
            type: selectedType,
            estimateRequired: estReq,
          }
        };

        const woData = await window.api.post("/work-orders", payload);
        if (woData && woData.work_order_id) {
          console.log(
            "[TechAdmin] Work order created in backend:",
            woData.work_order_id,
          );
          showToast(`Work order created (backend).`, "success");

          // Dispatch linked SR in backend
          if (linkedSrId) {
            await window.api.patch(`/service-requests/${linkedSrId}`, {
              status: "in_progress",
            });
            form.removeAttribute("data-linked-sr-id");
          }

          form.reset();
          await renderServiceRequests();
          await syncBackendWorkOrders();
          renderBoard();
          return;
        } else {
          console.warn("[TechAdmin] Backend WO creation failed:", woData);
        }
      }
    } catch (err) {
      console.warn(
        "[TechAdmin] Backend unavailable, creating WO locally:",
        err.message,
      );
    }

    // Fallback: local TechDB
    // Resolve tech object - search by user_id first, then by name
    let techObj = backendTechs.find((t) => t.user_id === tech);
    if (!techObj) {
      techObj = backendTechs.find((t) => t.name === tech);
    }
    const techName = techObj ? techObj.name : tech;
    const techId = techObj ? techObj.user_id : null;

    const newWO = {
      id: generateId("WO"),
      title: `${cap(selectedType)} maintenance: ${asset}`,
      type: selectedType,
      priority,
      technician: techName,
      assigned_to_id: techId,
      estimateRequired: estReq,
      status: "new",
      linkedFault: null,
    };

    if (linkedSrId) {
      const sr = TechDB.serviceRequests.find((s) => s.id === linkedSrId);
      if (sr) sr.status = "Dispatched";
      newWO.sourceRequest = linkedSrId;
      form.removeAttribute("data-linked-sr-id");
    }

    TechDB.addWorkOrder(newWO);
    showToast(`Work order ${newWO.id} created.`, "success");
    form.reset();
    await renderServiceRequests();
    renderBoard();
  });
}


/* ─── Archive table ──────────────────────────────── */
function renderArchive() {
  const tbody = document.getElementById("archiveBody");
  if (!tbody) return;

  const closed = TechDB.workOrders.filter((w) => w.status === "closed");
  if (!closed.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:20px;">No archived work orders yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = closed
    .map(
      (wo) => `
        <tr>
            <td>${formatWOId(wo.id)}</td>
            <td>${wo.title}</td>
            <td><span class="badge ${wo.priority}">${cap(wo.type)}</span></td>
            <td>${wo.technician}</td>
            <td><span class="badge closed">Closed</span></td>
        </tr>
    `,
    )
    .join("");
}

/* ─── Helpers ─────────────────────────────────────── */
function formatWOId(id) {
  if (!id) return "WO-XXXX";
  if (id.startsWith("WO-")) return id;
  const parts = id.split("-");
  if (parts.length > 1) {
    return "WO-" + parts[1].toUpperCase();
  }
  return "WO-" + id.substring(0, 4).toUpperCase();
}
function cap(str) {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function setEl(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (String(val).includes("<")) el.innerHTML = val;
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
      const srData = await window.api.get("/service-requests");
      if (Array.isArray(srData)) {
        backendSRs = srData;
        requests = backendSRs.filter(
          (sr) => sr.status === "open" || sr.status === "pending",
        );
        console.log(
          "[TechAdmin] Loaded",
          requests.length,
          "pending SRs from backend",
        );
      }
    }
  } catch (err) {
    console.warn(
      "[TechAdmin] SR backend fetch failed, using TechDB:",
      err.message,
    );
  }

  // Fallback to TechDB
  if (!requests.length) {
    requests = TechDB.serviceRequests.filter(
      (sr) => sr.status === "Reported" || sr.status === "Pending Category",
    );
  }

  const countBadge = document.getElementById("pendingRequestsCount");
  if (countBadge) countBadge.textContent = `${requests.length} Pending`;

  if (requests.length === 0) {
    container.parentElement.style.display = "none";
    return;
  } else {
    container.parentElement.style.display = "block";
  }

  // Render — handle both backend (service_request_id) and legacy (id) shapes
  container.innerHTML = requests
    .map((sr) => {
      const srId = sr.service_request_id || sr.id;
      const desc = sr.description || sr.location || "—";
      const reporter = sr.requested_by_id
        ? `ID: ${sr.requested_by_id.slice(0, 8)}…`
        : sr.reporterName || "Campus User";
      const date = sr.created_at || sr.timestamp || new Date().toISOString();
      const priority = sr.priority || sr.severity || "medium";
      return `
      <div class="alert-item card mb-12" style="border-left: 4px solid #f59e0b; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div style="flex:1">
          <h4 style="margin:0 0 4px 0;font-size:14px;color:var(--text-main);">${desc.slice(0, 80)}${desc.length > 80 ? "…" : ""}</h4>
          <div style="font-size:11px;color:#888;margin-top:4px;">Reported by ${reporter} • ${new Date(date).toLocaleDateString()} • Priority: <strong>${priority}</strong></div>
        </div>
        <div>
          <button class="btn btn-dark" style="padding: 6px 12px; font-size: 12px;" onclick="triageRequest('${srId}')">Create Work Order -></button>
        </div>
      </div>`;
    })
    .join("");
}
