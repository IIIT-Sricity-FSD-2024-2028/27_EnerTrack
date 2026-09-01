/**
 * maintenancePage.js
 * Handles interactivity for the Fault Detection & Diagnostics page.
 * Data source: backend /faults endpoint (via window.api).
 */
import { showToast, openModal } from "./utils/utils.js";

let selectedFaultId = null;
let _faults = [];
let _users = [];
let _alerts = [];
let _readings = [];
let _meters = [];

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
      [_faults, _users, _alerts, _readings, _meters] = await Promise.all([
        window.api.get("/faults").catch(() => []),
        window.api.get("/users").catch(() => []),
        window.api.get("/alerts").catch(() => []),
        window.api.get("/meter-readings").catch(() => []),
        window.api.get("/meters").catch(() => []),
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
      const assignedUser = _users.find(u => u.user_id === f.assigned_to_id);
      const assignedName = assignedUser ? assignedUser.name : "Unassigned";
      return `
        <div class="alert-tile ${id === selectedFaultId ? "active" : ""}" data-fault-id="${id}">
            <span class="badge ${severityClass(f.severity)}">${cap(f.severity)}</span>
            <div class="alert-tile-id">${f.alert_id || "—"} / ${id}</div>
            <div class="alert-tile-desc">${f.fault_type || f.type || "—"} — ${f.asset_name || "—"}</div>
            <div class="alert-tile-meta">Assigned to ${assignedName}</div>
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
  setEl("workspaceAsset", fault.asset_name || "—");
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

  renderFaultReadout(fault);
}

/* ─── Review Supporting Data: the real reading behind the alert ───── */
function renderFaultReadout(fault) {
  const container = document.getElementById("faultReadout");
  if (!container) return;

  const alert = _alerts.find(
    (a) => (a.alert_id || a.id) === fault.alert_id,
  );
  const readingId = alert?.triggering_reading_id;
  const reading = readingId
    ? _readings.find((r) => (r.reading_id || r.id) === readingId)
    : null;

  if (!reading) {
    container.innerHTML = `<div class="empty-state">No sensor reading is linked to this fault's alert yet.</div>`;
    return;
  }

  const meter = _meters.find(
    (m) => (m.meter_id || m.id) === reading.meter_id,
  );
  const meterLabel = meter
    ? `${meter.meter_code} (${meter.meter_type})`
    : reading.meter_id;
  const ts = reading.timestamp
    ? new Date(reading.timestamp).toLocaleString()
    : "—";

  const faultId = fault.fault_id || fault.id;
  const priorIncidents = _faults.filter(
    (f) =>
      f.asset_name === fault.asset_name &&
      (f.fault_id || f.id) !== faultId,
  ).length;

  // Round to at most 1 decimal so the dial never has to fit more than a
  // handful of characters, and scale the font down further for anything
  // still long (e.g. a 4+ digit reading) rather than letting it overflow.
  const displayValue =
    Number.isInteger(reading.value)
      ? String(reading.value)
      : reading.value.toFixed(1);
  const valueSizeClass =
    displayValue.length > 4
      ? "readout-value--sm"
      : displayValue.length > 3
        ? "readout-value--md"
        : "";

  container.innerHTML = `
    <div class="readout">
      <div class="readout-dial">
        <span class="readout-value ${valueSizeClass}">${displayValue}</span>
        <span class="readout-unit">${reading.unit || ""}</span>
      </div>
      <div class="readout-meta">
        <div class="readout-meta-row"><span>Meter</span><span>${meterLabel}</span></div>
        <div class="readout-meta-row"><span>Reading at</span><span>${ts}</span></div>
      </div>
    </div>
    <div class="readout-note">${priorIncidents} prior fault${priorIncidents === 1 ? "" : "s"} recorded for this asset.</div>
  `;
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
  const asset = fault.asset_name || "Unknown Asset";

  let priorityOptions = `<option value="high" selected>High (Emergency)</option>`;
  if (type !== "immediate") {
    priorityOptions = `
            <option value="high" ${fault.severity === "high" || fault.severity === "critical" ? "selected" : ""}>High</option>
            <option value="medium" ${fault.severity === "moderate" ? "selected" : ""}>Medium</option>
            <option value="low" ${fault.severity === "low" ? "selected" : ""}>Low</option>
        `;
  }

  return `
      <div style="display: flex; flex-direction: column; gap: 4px;">
         <div class="field">
           <label>Asset</label>
           <input type="text" id="modalWOAsset" value="${asset}" readonly>
         </div>
         <div style="display: flex; gap: 16px;">
             <div class="field" style="flex: 1;">
               <label>Priority</label>
               <select id="modalWOPriority">${priorityOptions}</select>
             </div>
             <div class="field" style="flex: 1;">
               <label>Assignee</label>
               <select id="modalWOAssignee">${finalTechOptions}</select>
             </div>
         </div>
         <div class="field">
           <label>Diagnostic Notes to Transfer</label>
           <textarea id="modalWONotes">${fault.quickfixNotes || fault.prelimNotes || "Diagnostics flagged this fault."}</textarea>
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
    title: `${type === "immediate" ? "Urgent Repair" : "Scheduled Maintenance"}: ${fault.asset_name || "Asset"}`,
    status: "new",
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
