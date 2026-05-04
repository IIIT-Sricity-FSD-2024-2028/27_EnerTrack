/**
 * maintenancePage.js
 * Handles interactivity for the Fault Detection & Diagnostics page.
 * Data source: backend /faults endpoint (via window.api).
 */
import { showToast, openModal } from "./utils/utils.js";

let selectedFaultId = null;
let _faults = [];
let _users = [];

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initMaintenance();
    console.log("TechMaintenance: Initialized.");
  } catch (err) {
    console.error("TechMaintenance: Init error:", err);
  }
});

async function initMaintenance() {
  try {
    if (window.api) {
      [_faults, _users] = await Promise.all([
        window.api.get("/faults").catch(() => []),
        window.api.get("/users").catch(() => []),
      ]);
    }
  } catch (err) {
    console.warn("[TechMaintenance] Backend unavailable:", err.message);
  }
  renderAlertSelector();
  if (_faults.length) selectFault(_faults[0].fault_id || _faults[0].id);
}

/* ─── Render acknowledged alert selector tiles ─────── */
function renderAlertSelector() {
  const grid = document.getElementById("alertSelectorGrid");
  if (!grid) return;

  const activeFaults = _faults.filter((f) => {
    const s = (f.status || "").toLowerCase();
    return s === "active" || s === "pending" || s === "open";
  });
  grid.innerHTML = activeFaults
    .map((f) => {
      const id = f.fault_id || f.id;
      return `
        <div class="alert-tile ${id === selectedFaultId ? "active" : ""}" data-fault-id="${id}">
            <span class="badge ${severityClass(f.severity)}">${cap(f.severity)}</span>
            <div class="alert-tile-id">${f.alert_id || "—"} / ${id}</div>
            <div class="alert-tile-desc">${f.fault_type || f.type || "—"} — ${f.asset || f.description || "—"}</div>
            <div class="alert-tile-meta">Assigned to ${f.assigned_to || f.assignedTo || "Unassigned"}</div>
        </div>`;
    })
    .join("");

  grid.querySelectorAll(".alert-tile").forEach((tile) => {
    tile.addEventListener("click", () => selectFault(tile.dataset.faultId));
  });
}

/* ─── Select a fault and load the workspace ─────────── */
function selectFault(faultId) {
  selectedFaultId = faultId;
  const fault = _faults.find((f) => (f.fault_id || f.id) === faultId);
  if (!fault) return;

  document
    .querySelectorAll(".alert-tile")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.alert-tile[data-fault-id="${faultId}"]`)
    ?.classList.add("active");

  setEl("workspaceTitle", `Active Diagnostics — ${fault.alert_id || faultId}`);
  setEl("workspaceAsset", fault.asset || fault.description || "—");
  setEl("diagnosticFaultTypeBadge", fault.fault_type || fault.type || "—");

  const severityEl = document.getElementById("diagnosticSeverityBadge");
  if (severityEl) {
    severityEl.textContent = fault.severity || "—";
    severityEl.className = `badge ${severityClass(fault.severity)}`;
  }

  const prelimNotes = fault.prelim_notes || fault.prelimNotes || "";
  const quickfixNotes = fault.quickfix_notes || fault.quickfixNotes || "";

  if (prelimNotes) {
    document.getElementById("prelimViewMode").style.display = "block";
    document.getElementById("prelimEditMode").style.display = "none";
    setEl("prelimSavedText", prelimNotes);
  } else {
    document.getElementById("prelimViewMode").style.display = "none";
    document.getElementById("prelimEditMode").style.display = "block";
    document.getElementById("prelimTextarea").value = "";
  }

  if (quickfixNotes) {
    document.getElementById("quickfixViewMode").style.display = "block";
    document.getElementById("quickfixEditMode").style.display = "none";
    setEl("quickfixSavedText", quickfixNotes);
  } else {
    document.getElementById("quickfixViewMode").style.display = "none";
    document.getElementById("quickfixEditMode").style.display = "block";
    document.getElementById("quickfixTextarea").value = "";
  }
}

/* ─── Log Resolution & Close ──────────────────────── */
document.addEventListener("click", async (e) => {
  const fault = selectedFaultId
    ? _faults.find((f) => (f.fault_id || f.id) === selectedFaultId)
    : null;

  async function patchFault(id, data) {
    try {
      if (window.api) await window.api.patch(`/faults/${id}`, data);
      const f = _faults.find((x) => (x.fault_id || x.id) === id);
      if (f) Object.assign(f, data);
    } catch (err) {
      console.warn(err);
    }
  }

  if (e.target.id === "btnSavePrelim") {
    const val = document.getElementById("prelimTextarea").value.trim();
    if (val && selectedFaultId) {
      await patchFault(selectedFaultId, { prelim_notes: val });
      showToast("Preliminary inspection notes saved.", "success");
      selectFault(selectedFaultId);
    }
  }
  if (e.target.id === "btnEditPrelim") {
    document.getElementById("prelimViewMode").style.display = "none";
    document.getElementById("prelimEditMode").style.display = "block";
    document.getElementById("prelimTextarea").value =
      fault?.prelim_notes || fault?.prelimNotes || "";
  }
  if (e.target.id === "btnDeletePrelim") {
    if (selectedFaultId) {
      await patchFault(selectedFaultId, { prelim_notes: "" });
      showToast("Notes deleted.", "info");
      selectFault(selectedFaultId);
    }
  }

  if (e.target.id === "btnSaveQuickfix") {
    const val = document.getElementById("quickfixTextarea").value.trim();
    if (val && selectedFaultId) {
      await patchFault(selectedFaultId, { quickfix_notes: val });
      showToast("Quick fix logic saved.", "success");
      selectFault(selectedFaultId);
    }
  }
  if (e.target.id === "btnEditQuickfix") {
    document.getElementById("quickfixViewMode").style.display = "none";
    document.getElementById("quickfixEditMode").style.display = "block";
    document.getElementById("quickfixTextarea").value =
      fault?.quickfix_notes || fault?.quickfixNotes || "";
  }
  if (e.target.id === "btnDeleteQuickfix") {
    if (selectedFaultId) {
      await patchFault(selectedFaultId, { quickfix_notes: "" });
      showToast("Quick fix logic deleted.", "info");
      selectFault(selectedFaultId);
    }
  }

  if (e.target.id === "btnLogResolution") {
    if (!selectedFaultId) return;
    openModal({
      title: "Close Fault",
      bodyHTML: `<p>Confirm quick fix was successful and close fault <strong>${selectedFaultId}</strong>?</p>`,
      confirmLabel: "Close Fault",
      onConfirm: async () => {
        await patchFault(selectedFaultId, { status: "resolved" });
        if (fault?.alert_id && window.api) {
          window.api
            .patch(`/alerts/${fault.alert_id}`, { status: "resolved" })
            .catch(() => {});
        }
        showToast(`Fault ${selectedFaultId} resolved and logged.`, "success");
        renderAlertSelector();
        selectedFaultId = null;
        setEl("workspaceTitle", "Select an alert to begin diagnostics.");
      },
    });
  }

  if (e.target.id === "btnFlagScheduled") {
    if (!selectedFaultId || !fault) return;
    openModal({
      title: "Setup Scheduled Work Order",
      bodyHTML: getWOModalHTML(fault, "scheduled"),
      confirmLabel: "Create Work Order",
      onConfirm: () => handleWOCreation(selectedFaultId, "scheduled"),
    });
  }

  if (e.target.id === "btnFlagImmediate") {
    if (!selectedFaultId || !fault) return;
    openModal({
      title: "Setup Immediate Repair Work Order",
      bodyHTML: getWOModalHTML(fault, "immediate"),
      confirmLabel: "Create Urgent Work Order",
      danger: true,
      onConfirm: () => handleWOCreation(selectedFaultId, "immediate"),
    });
  }
});

/* ─── Helpers ─────────────────────────────────────── */
function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function setEl(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (String(val).includes("<svg")) el.innerHTML = val;
  else el.textContent = val;
}
function severityClass(s) {
  if (s === "high" || s === "critical") return "critical";
  if (s === "moderate") return "moderate";
  return "low";
}

function getWOModalHTML(fault, type) {
  const techs = _users.filter(
    (u) => u.role === "Technician" || u.role === "Technician Administrator",
  );
  const assignedTo = fault.assigned_to || fault.assignedTo || "";
  const techOptions = techs
    .map(
      (t) =>
        `<option value="${t.name}" ${assignedTo === t.name ? "selected" : ""}>${t.name}</option>`,
    )
    .join("");
  const finalTechOptions =
    techOptions || `<option value="Unassigned">Unassigned</option>`;
  const asset = fault.asset || fault.description || "Unknown Asset";

  let priorityOptions = `<option value="high" selected>High (Emergency)</option>`;
  if (type !== "immediate") {
    priorityOptions = `
            <option value="high" ${fault.severity === "high" || fault.severity === "critical" ? "selected" : ""}>High</option>
            <option value="medium" ${fault.severity === "moderate" ? "selected" : ""}>Medium</option>
            <option value="low" ${fault.severity === "low" ? "selected" : ""}>Low</option>
        `;
  }

  return `
      <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
         <div>
           <label style="font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.04em; text-transform:uppercase;">Asset</label>
           <input type="text" id="modalWOAsset" value="${asset}" readonly style="width:100%; box-sizing: border-box; padding:10px 12px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; margin-top:6px; font-family:inherit; font-size:14px; color:#475569;">
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

async function handleWOCreation(faultId, type) {
  const fault = _faults.find((f) => (f.fault_id || f.id) === faultId);
  if (!fault) return;

  const priority = document.getElementById("modalWOPriority").value;
  const assignee = document.getElementById("modalWOAssignee").value;
  const notes = document.getElementById("modalWONotes").value;

  const payload = {
    title: `${type === "immediate" ? "Urgent Repair" : "Scheduled Maintenance"}: ${fault.asset || fault.description}`,
    status: "open",
    type: type === "immediate" ? "emergency" : "scheduled",
    priority,
    assigned_to_id: _users.find((u) => u.name === assignee)?.user_id || null,
    description: notes,
    fault_id: fault.fault_id || fault.id,
  };

  try {
    if (window.api) {
      await window.api.post("/work-orders", payload);
      await window.api.patch(`/faults/${faultId}`, { status: "flagged" });
      const f = _faults.find((x) => (x.fault_id || x.id) === faultId);
      if (f) f.status = "flagged";
    }
  } catch (err) {
    console.warn(err);
  }

  showToast(
    `Flagged for ${type} repair. Work order created.`,
    type === "immediate" ? "warning" : "info",
  );
  renderAlertSelector();
  selectedFaultId = null;
  setEl("workspaceTitle", "Select an alert to begin diagnostics.");
}
