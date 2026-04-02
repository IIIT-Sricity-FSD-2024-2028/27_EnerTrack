/**
 * backups.js
 * CRUD operations for Backup Jobs.
 * Used by: admin_maintain.html, admin_overview.html
 */

import EnerTrackDB from "../data/mockData.js";
import { showToast, openModal, badgeHTML, timeAgo, generateId, validateForm, roleAllowed } from "../utils/utils.js";

/* ── READ ─────────────────────────────────────────── */

export function getBackupJobs() {
  return EnerTrackDB.backupJobs;
}

export function getBackupById(id) {
  return EnerTrackDB.backupJobs.find(b => b.id === id) ?? null;
}

/* ── RENDER ───────────────────────────────────────── */

export function renderBackupJobs(containerId = "backupJobsContainer") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const jobs = getBackupJobs();

  if (jobs.length === 0) {
    container.innerHTML = `<p style="color:#6b7280;font-size:15px;text-align:center;padding:16px">No backup jobs configured.</p>`;
    return;
  }

  container.innerHTML = jobs.map(job => buildBackupCard(job)).join("");
}

function buildBackupCard(job) {
  const showProgress = job.status === "pending" || job.status === "running";
  const progressBar  = showProgress
    ? `<div class="progress-bar-thin"><div class="progress" style="width:${job.progress}%;background:#1f2937"></div></div>`
    : "";

  const footerLeft = job.status === "pending" || job.status === "running"
    ? `In progress: ${job.progress}% • Est. remaining`
    : job.status === "scheduled"
    ? `Window: ${job.nextRun}`
    : `Last run: ${job.lastRun ?? "—"} • Duration: ${job.duration ?? "—"} • ${job.errors} errors`;

  const footerRight = job.status === "scheduled"
    ? `Retention: ${job.retention ?? "30 days"}`
    : `Next: ${job.nextRun}`;

  const actions = roleAllowed(["admin","superuser"]) ? `
    <div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end">
      <button class="btn-outline" style="font-size:12px;padding:4px 10px"
        onclick="BackupsModule.editBackupJob('${job.id}')">Edit</button>
      <button class="btn-outline" style="font-size:12px;padding:4px 10px;color:#dc2626;border-color:#fca5a5"
        onclick="BackupsModule.deleteBackupJob('${job.id}')">Delete</button>
    </div>
  ` : "";

  return `
    <div class="card-item" data-backup-id="${job.id}">
      <div class="card-header">
        <h4>${job.name}</h4>
        ${badgeHTML(job.status)}
      </div>
      <p class="desc">Scope: ${job.scope} • Target: ${job.target}</p>
      ${progressBar}
      <div class="card-footer${showProgress ? "" : " space-top"}">
        <span>${footerLeft}</span>
        <span>${footerRight}</span>
      </div>
      ${actions}
    </div>
  `;
}

/* ── CREATE ───────────────────────────────────────── */

export function openNewBackupModal() {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("You do not have permission to create backup jobs.", "error");
    return;
  }

  openModal({
    title: "New Backup Job",
    bodyHTML: `
      <div id="add-backup-form">
        <div class="et-form-group">
          <label for="nb-name">Job Name *</label>
          <input id="nb-name" type="text" placeholder="e.g. App DB - weekly full" maxlength="80">
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="nb-scope">Scope *</label>
            <input id="nb-scope" type="text" placeholder="e.g. All schemas" maxlength="80">
          </div>
          <div class="et-form-group">
            <label for="nb-status">Status *</label>
            <select id="nb-status">
              <option value="">-- Select --</option>
              <option value="scheduled">Scheduled</option>
              <option value="ready">Ready</option>
            </select>
          </div>
        </div>
        <div class="et-form-group">
          <label for="nb-target">Target Path *</label>
          <input id="nb-target" type="text" placeholder="e.g. s3://backups/app/full" maxlength="120">
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="nb-next">Next Run</label>
            <input id="nb-next" type="text" placeholder="e.g. Tonight 02:00 AM" maxlength="40">
          </div>
          <div class="et-form-group">
            <label for="nb-retention">Retention</label>
            <input id="nb-retention" type="text" placeholder="e.g. 7 days" maxlength="20">
          </div>
        </div>
      </div>
    `,
    confirmLabel: "Create Job",
    onConfirm: () => {
      const data = {
        name:      (document.getElementById("nb-name")?.value      ?? "").trim(),
        scope:     (document.getElementById("nb-scope")?.value     ?? "").trim(),
        status:    (document.getElementById("nb-status")?.value    ?? "").trim(),
        target:    (document.getElementById("nb-target")?.value    ?? "").trim(),
        nextRun:   (document.getElementById("nb-next")?.value      ?? "Tonight 02:00 AM").trim(),
        retention: (document.getElementById("nb-retention")?.value ?? "30 days").trim()
      };
      addBackupJob(data);
    }
  });
}

export function addBackupJob(data) {
  const { valid, errors } = validateForm(data, {
    name:   { required: true, minLength: 3, maxLength: 80 },
    scope:  { required: true, minLength: 2 },
    status: { required: true },
    target: { required: true, minLength: 5 }
  });

  if (!valid) {
    showToast("Validation failed: " + Object.values(errors).join(" • "), "error", 5000);
    return false;
  }

  const newJob = {
    id:        generateId("bk"),
    name:      data.name,
    scope:     data.scope,
    target:    data.target,
    status:    data.status,
    progress:  0,
    lastRun:   null,
    duration:  null,
    errors:    0,
    nextRun:   data.nextRun || "Tonight 02:00 AM",
    jobId:     `BK-${Date.now()}`,
    retention: data.retention || "30 days"
  };

  EnerTrackDB.backupJobs.push(newJob);
  EnerTrackDB.save(); // Sync to localStorage
  showToast(`Backup job "${newJob.name}" created.`, "success");
  renderBackupJobs();
  return true;
}

/* ── UPDATE ───────────────────────────────────────── */

export function editBackupJob(id) {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("You do not have permission to edit backup jobs.", "error");
    return;
  }

  const job = getBackupById(id);
  if (!job) { showToast("Backup job not found.", "error"); return; }

  openModal({
    title: "Edit Backup Job",
    bodyHTML: `
      <div id="edit-backup-form">
        <div class="et-form-group">
          <label for="eb-name">Job Name *</label>
          <input id="eb-name" type="text" value="${job.name}" maxlength="80">
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="eb-scope">Scope *</label>
            <input id="eb-scope" type="text" value="${job.scope}" maxlength="80">
          </div>
          <div class="et-form-group">
            <label for="eb-status">Status *</label>
            <select id="eb-status">
              <option value="scheduled" ${job.status==="scheduled"?"selected":""}>Scheduled</option>
              <option value="ready"     ${job.status==="ready"    ?"selected":""}>Ready</option>
              <option value="pending"   ${job.status==="pending"  ?"selected":""}>Pending</option>
              <option value="failed"    ${job.status==="failed"   ?"selected":""}>Failed</option>
            </select>
          </div>
        </div>
        <div class="et-form-group">
          <label for="eb-target">Target Path *</label>
          <input id="eb-target" type="text" value="${job.target}" maxlength="120">
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="eb-next">Next Run</label>
            <input id="eb-next" type="text" value="${job.nextRun}" maxlength="40">
          </div>
          <div class="et-form-group">
            <label for="eb-retention">Retention</label>
            <input id="eb-retention" type="text" value="${job.retention ?? "30 days"}" maxlength="20">
          </div>
        </div>
      </div>
    `,
    confirmLabel: "Save Changes",
    onConfirm: () => {
      const fields = {
        name:      (document.getElementById("eb-name")?.value      ?? job.name).trim(),
        scope:     (document.getElementById("eb-scope")?.value     ?? job.scope).trim(),
        status:    (document.getElementById("eb-status")?.value    ?? job.status).trim(),
        target:    (document.getElementById("eb-target")?.value    ?? job.target).trim(),
        nextRun:   (document.getElementById("eb-next")?.value      ?? job.nextRun).trim(),
        retention: (document.getElementById("eb-retention")?.value ?? "30 days").trim()
      };
      updateBackupJob(id, fields);
    }
  });
}

export function updateBackupJob(id, fields) {
  const idx = EnerTrackDB.backupJobs.findIndex(b => b.id === id);
  if (idx === -1) { showToast("Backup job not found.", "error"); return false; }

  const { valid, errors } = validateForm(fields, {
    name:   { required: true, minLength: 3 },
    scope:  { required: true, minLength: 2 },
    status: { required: true },
    target: { required: true, minLength: 5 }
  });

  if (!valid) {
    showToast("Validation failed: " + Object.values(errors).join(" • "), "error", 5000);
    return false;
  }

  Object.assign(EnerTrackDB.backupJobs[idx], fields);
  EnerTrackDB.save(); // Sync to localStorage
  showToast("Backup job updated.", "success");
  renderBackupJobs();
  return true;
}

/* ── DELETE ───────────────────────────────────────── */

export function deleteBackupJob(id) {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("You do not have permission to delete backup jobs.", "error");
    return;
  }

  const job = getBackupById(id);
  if (!job) { showToast("Backup job not found.", "error"); return; }

  openModal({
    title: "Delete Backup Job",
    bodyHTML: `<p>Permanently delete <strong>${job.name}</strong>? This cannot be undone.</p>`,
    confirmLabel: "Delete",
    danger: true,
    onConfirm: () => {
      EnerTrackDB.backupJobs = EnerTrackDB.backupJobs.filter(b => b.id !== id);
      EnerTrackDB.save(); // Sync to localStorage
      showToast(`Backup job "${job.name}" deleted.`, "info");
      renderBackupJobs();
    }
  });
}

/* ── EXPORT NAMESPACE ─────────────────────────────── */

const BackupsModule = {
  getBackupJobs, getBackupById,
  renderBackupJobs,
  openNewBackupModal, addBackupJob,
  editBackupJob, updateBackupJob,
  deleteBackupJob
};

window.BackupsModule = BackupsModule;
export default BackupsModule;
