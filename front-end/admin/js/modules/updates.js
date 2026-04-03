/**
 * updates.js
 * CRUD operations for System Updates.
 * Used by: admin_maintain.html, admin_overview.html
 */

import EnerTrackDB from "../data/mockData.js";
import { showToast, openModal, badgeHTML, generateId, validateForm, roleAllowed } from "../utils/utils.js";

/* ── READ ─────────────────────────────────────────── */

export function getUpdates() {
  return EnerTrackDB.systemUpdates;
}

export function getUpdateById(id) {
  return EnerTrackDB.systemUpdates.find(u => u.id === id) ?? null;
}

/* ── RENDER (admin_maintain.html) ─────────────────── */

export function renderUpdates(containerId = "systemUpdatesContainer") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const updates = getUpdates();

  if (updates.length === 0) {
    container.innerHTML = `<p style="color:#6b7280;text-align:center;padding:16px">No system updates found.</p>`;
    return;
  }

  container.innerHTML = updates.map(upd => buildUpdateCard(upd)).join("");
}

function buildUpdateCard(upd) {
  const isApplied = upd.status === "applied";
  const actions = roleAllowed(["admin", "superuser"]) ? `
    <div style="display:flex;gap:6px;justify-content:flex-end">
      ${!isApplied ? `
        <button class="btn-dark clickable"
          onclick="UpdatesModule.applyUpdate('${upd.id}')">Apply this window</button>
      ` : ""}
      <button class="btn-outline clickable"
        onclick="UpdatesModule.editUpdate('${upd.id}')">Edit plan</button>
      <button class="btn-outline clickable" style="color:#dc2626;border-color:#fca5a5"
        onclick="UpdatesModule.deleteUpdate('${upd.id}')">Delete</button>
    </div>
  ` : "";

  return `
    <div class="card-item" data-update-id="${upd.id}">
      <div class="card-header">
        <h4>${upd.title}</h4>
        ${badgeHTML(upd.status)}
      </div>
      <p class="desc">${upd.description}</p>
      <div class="padded-box">
        <div class="card-footer">
          <span>Est. downtime: ${upd.downtimeEst}
            ${upd.changeRequestId ? ` • CR: ${upd.changeRequestId}` : ""}
          </span>
          ${actions}
        </div>
      </div>
    </div>
  `;
}

/* ── RENDER (admin_overview.html) ─────────────────── */

export function renderOverviewUpdates(containerId = "overviewUpdatesContainer") {
  // const container = document.getElementById(containerId);
  // if (!container) return;

  // const updates = getUpdates().filter(u => u.status !== "applied");

  // if (updates.length === 0) {
  //   container.innerHTML = `<p style="color:#6b7280;text-align:center;padding:16px">All updates applied.</p>`;
  //   return;
  // }

  // container.innerHTML = updates.map(upd => `
  //   <div class="update-card" data-update-id="${upd.id}">
  //     <div class="update-header">
  //       <h4>${upd.title}</h4>
  //       ${badgeHTML(upd.status)}
  //     </div>
  //     <p>${upd.details}</p>
  //     <div class="update-footer">
  //       <span>Est. downtime: ${upd.downtimeEst}</span>
  //       <div style="display:flex;gap:8px">
  //         ${roleAllowed(["admin", "superuser"]) ? `
  //           <button class="btn-dark" onclick="UpdatesModule.applyUpdate('${upd.id}')">
  //             Install Now
  //           </button>
  //           <button class="btn-outline" onclick="UpdatesModule.editUpdate('${upd.id}')">Reschedule</button>
  //         ` : ""}
  //       </div>
  //     </div>
  //   </div>
  // `).join("");
  const container = document.getElementById(containerId);
  if (!container) return;

  // Merge pending system updates AND pending backup jobs
  const pendingUpdates = EnerTrackDB.systemUpdates.filter(u => u.status !== "applied");
  const pendingBackups = EnerTrackDB.backupJobs
    .filter(job => job.status === "scheduled")
    .map(job => ({
      id: job.id,
      title: job.name,
      details: `Scope: ${job.scope} • Target: ${job.target}`,
      downtimeEst: job.duration ?? "Unknown",
      status: job.status,
      _isBackup: true   // flag so we know which module to call
    }));

  const all = [...pendingUpdates, ...pendingBackups];

  if (all.length === 0) {
    container.innerHTML = `<p style="color:#6b7280;text-align:center;padding:16px">All updates applied.</p>`;
    return;
  }

  container.innerHTML = all.map(item => `
    <div class="update-card" data-update-id="${item.id}">
      <div class="update-header">
        <h4>${item.title}</h4>
        ${badgeHTML(item.status)}
      </div>
      <p>${item.details}</p>
      <div class="update-footer">
        <span>Est. downtime: ${item.downtimeEst}</span>
        <div style="display:flex;gap:8px">
          ${roleAllowed(["admin", "superuser"]) ? `
            ${!item._isBackup ? `
            <button class="btn-dark" onclick="UpdatesModule.applyUpdate('${item.id}')">
              Install Now
            </button>
            ` : ""}
            <button class="btn-outline" onclick="${item._isBackup
        ? `BackupsModule.editBackupJob('${item.id}')`
        : `UpdatesModule.editUpdate('${item.id}')`
      }">Reschedule</button>
          ` : ""}
        </div>
      </div>
    </div>
  `).join("");
}

/* ── CREATE ───────────────────────────────────────── */

export function openAddUpdateModal() {
  if (!roleAllowed(["admin", "superuser"])) {
    showToast("You do not have permission to add updates.", "error");
    return;
  }

  openModal({
    title: "Add System Update",
    bodyHTML: `
      <div id="add-update-form">
        <div class="et-form-group">
          <label for="au-title">Update Title *</label>
          <input id="au-title" type="text" placeholder="e.g. Nginx Security Patch" maxlength="80">
        </div>
        <div class="et-form-group">
          <label for="au-desc">Short Description *</label>
          <input id="au-desc" type="text" placeholder="e.g. Affects 2 nodes • No reboot" maxlength="100">
        </div>
        <div class="et-form-group">
          <label for="au-details">Details *</label>
          <textarea id="au-details" rows="3" placeholder="Full description of the update..." maxlength="300"></textarea>
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="au-status">Status *</label>
            <select id="au-status">
              <option value="">-- Select --</option>
              <option value="not-applied">Not Applied</option>
              <option value="planned">Planned</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          <div class="et-form-group">
            <label for="au-downtime">Est. Downtime *</label>
            <input id="au-downtime" type="text" placeholder="e.g. 5 min" maxlength="20">
          </div>
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="au-crid">Change Request ID</label>
            <input id="au-crid" type="text" placeholder="e.g. CR-2050" maxlength="20">
          </div>
          <div class="et-form-group">
            <label for="au-nodes">Affected Nodes *</label>
            <input id="au-nodes" type="number" placeholder="e.g. 2" min="1" max="100">
          </div>
        </div>
      </div>
    `,
    confirmLabel: "Add Update",
    onConfirm: () => {
      const data = {
        title: (document.getElementById("au-title")?.value ?? "").trim(),
        description: (document.getElementById("au-desc")?.value ?? "").trim(),
        details: (document.getElementById("au-details")?.value ?? "").trim(),
        status: (document.getElementById("au-status")?.value ?? "").trim(),
        downtimeEst: (document.getElementById("au-downtime")?.value ?? "").trim(),
        changeRequestId: (document.getElementById("au-crid")?.value ?? "").trim() || null,
        affectedNodes: parseInt(document.getElementById("au-nodes")?.value ?? "1", 10)
      };
      addUpdate(data);
    }
  });
}

export function addUpdate(data) {
  const { valid, errors } = validateForm(data, {
    title: { required: true, minLength: 3 },
    description: { required: true, minLength: 3 },
    details: { required: true, minLength: 5 },
    status: { required: true },
    downtimeEst: { required: true, minLength: 1 }
  });

  if (!valid) {
    showToast("Validation failed: " + Object.values(errors).join(" • "), "error", 5000);
    return false;
  }

  if (isNaN(data.affectedNodes) || data.affectedNodes < 1) {
    showToast("Affected nodes must be a number greater than 0.", "error");
    return false;
  }

  EnerTrackDB.systemUpdates.push({
    id: generateId("upd"),
    ...data,
    scheduledWindow: "Pending assignment"
  });

  EnerTrackDB.save(); // Sync to localStorage
  showToast(`Update "${data.title}" added.`, "success");
  renderUpdates();
  renderOverviewUpdates();
  return true;
}

/* ── APPLY ────────────────────────────────────────── */

export function applyUpdate(id) {
  if (!roleAllowed(["admin", "superuser"])) {
    showToast("You do not have permission to apply updates.", "error");
    return;
  }

  const upd = getUpdateById(id);
  if (!upd) { showToast("Update not found.", "error"); return; }

  openModal({
    title: "Apply Update",
    bodyHTML: `
      <p>Apply <strong>${upd.title}</strong>?</p>
      <p style="margin-top:8px;color:#6b7280;font-size:14px">
        Estimated downtime: <strong>${upd.downtimeEst}</strong> •
        Affects <strong>${upd.affectedNodes}</strong> node(s).
        This will be applied during the current maintenance window.
      </p>
    `,
    confirmLabel: "Apply Now",
    onConfirm: () => {
      const idx = EnerTrackDB.systemUpdates.findIndex(u => u.id === id);
      if (idx !== -1) EnerTrackDB.systemUpdates[idx].status = "applied";
      EnerTrackDB.save(); // Sync to localStorage
      showToast(`"${upd.title}" marked as applied.`, "success");
      renderUpdates();
      renderOverviewUpdates();
    }
  });
}

/* ── UPDATE ───────────────────────────────────────── */

export function editUpdate(id) {
  if (!roleAllowed(["admin", "superuser"])) {
    showToast("You do not have permission to edit updates.", "error");
    return;
  }

  const upd = getUpdateById(id);
  if (!upd) { showToast("Update not found.", "error"); return; }

  openModal({
    title: "Edit System Update",
    bodyHTML: `
      <div id="edit-update-form">
        <div class="et-form-group">
          <label for="eu-title">Title *</label>
          <input id="eu-title" type="text" value="${upd.title}" maxlength="80">
        </div>
        <div class="et-form-group">
          <label for="eu-desc">Short Description *</label>
          <input id="eu-desc" type="text" value="${upd.description}" maxlength="100">
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="eu-status">Status *</label>
            <select id="eu-status">
              <option value="not-applied" ${upd.status === "not-applied" ? "selected" : ""}>Not Applied</option>
              <option value="planned"     ${upd.status === "planned" ? "selected" : ""}>Planned</option>
              <option value="scheduled"   ${upd.status === "scheduled" ? "selected" : ""}>Scheduled</option>
              <option value="applied"     ${upd.status === "applied" ? "selected" : ""}>Applied</option>
            </select>
          </div>
          <div class="et-form-group">
            <label for="eu-downtime">Est. Downtime *</label>
            <input id="eu-downtime" type="text" value="${upd.downtimeEst}" maxlength="20">
          </div>
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="eu-crid">Change Request ID</label>
            <input id="eu-crid" type="text" value="${upd.changeRequestId ?? ""}" maxlength="20">
          </div>
          <div class="et-form-group">
            <label for="eu-nodes">Affected Nodes *</label>
            <input id="eu-nodes" type="number" value="${upd.affectedNodes}" min="1" max="100">
          </div>
        </div>
      </div>
    `,
    confirmLabel: "Save Changes",
    onConfirm: () => {
      const fields = {
        title: (document.getElementById("eu-title")?.value ?? upd.title).trim(),
        description: (document.getElementById("eu-desc")?.value ?? upd.description).trim(),
        status: (document.getElementById("eu-status")?.value ?? upd.status).trim(),
        downtimeEst: (document.getElementById("eu-downtime")?.value ?? upd.downtimeEst).trim(),
        changeRequestId: (document.getElementById("eu-crid")?.value ?? "").trim() || null,
        affectedNodes: parseInt(document.getElementById("eu-nodes")?.value ?? upd.affectedNodes, 10)
      };
      updateUpdate(id, fields);
    }
  });
}

export function updateUpdate(id, fields) {
  const idx = EnerTrackDB.systemUpdates.findIndex(u => u.id === id);
  if (idx === -1) { showToast("Update not found.", "error"); return false; }

  const { valid, errors } = validateForm(fields, {
    title: { required: true, minLength: 3 },
    description: { required: true, minLength: 3 },
    status: { required: true },
    downtimeEst: { required: true }
  });

  if (!valid) {
    showToast("Validation failed: " + Object.values(errors).join(" • "), "error", 5000);
    return false;
  }

  Object.assign(EnerTrackDB.systemUpdates[idx], fields);
  EnerTrackDB.save(); // Sync to localStorage
  showToast("System update saved.", "success");
  renderUpdates();
  renderOverviewUpdates();
  return true;
}

/* ── DELETE ───────────────────────────────────────── */

export function deleteUpdate(id) {
  if (!roleAllowed(["admin", "superuser"])) {
    showToast("You do not have permission to delete updates.", "error");
    return;
  }

  const upd = getUpdateById(id);
  if (!upd) { showToast("Update not found.", "error"); return; }

  openModal({
    title: "Delete Update",
    bodyHTML: `<p>Permanently delete <strong>${upd.title}</strong>?</p>`,
    confirmLabel: "Delete",
    danger: true,
    onConfirm: () => {
      EnerTrackDB.systemUpdates = EnerTrackDB.systemUpdates.filter(u => u.id !== id);
      EnerTrackDB.save(); // Sync to localStorage
      showToast(`"${upd.title}" deleted.`, "info");
      renderUpdates();
      renderOverviewUpdates();
    }
  });
}

/* ── EXPORT NAMESPACE ─────────────────────────────── */

const UpdatesModule = {
  getUpdates, getUpdateById,
  renderUpdates, renderOverviewUpdates,
  openAddUpdateModal, addUpdate,
  applyUpdate,
  editUpdate, updateUpdate,
  deleteUpdate
};

window.UpdatesModule = UpdatesModule;
export default UpdatesModule;
