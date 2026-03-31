/**
 * maintainPage.js
 * Entry-point for admin_maintain.html.
 * Wires CRUD for backup jobs, system updates, error scans, and tools.
 */

import EnerTrackDB   from "./data/mockData.js";
import SessionModule from "./modules/session.js";
import AlertsModule  from "./modules/alerts.js";
import BackupsModule from "./modules/backups.js";
import UpdatesModule from "./modules/updates.js";
import { showToast, openModal, roleAllowed, badgeHTML } from "./utils/utils.js";

/* ── BOOT ─────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  window.EnerTrackDB = EnerTrackDB;

  SessionModule.initSession();

  // Render all dynamic sections
  BackupsModule.renderBackupJobs("backupJobsContainer");
  UpdatesModule.renderUpdates("systemUpdatesContainer");
  renderErrorScans("errorScanContainer");
  renderMaintenanceWindow();

  // Wire "Add" buttons for role-gated sections
  wireAddButtons();

  // Profile card
  const profileCard = document.querySelector(".profile-card");
  if (profileCard) {
    profileCard.addEventListener("click", e => {
      e.preventDefault();
      SessionModule.confirmLogout();
    });
  }
});

/* ── MAINTENANCE WINDOW ───────────────────────────── */

function renderMaintenanceWindow() {
  const mw = EnerTrackDB.maintenanceWindow;
  const el = document.querySelector(".page-header p");
  if (el) el.textContent = `Next window: ${mw.next}`;
}

/* ── ERROR SCANS ──────────────────────────────────── */

function renderErrorScans(containerId = "errorScanContainer") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const scans = EnerTrackDB.errorScans;

  if (scans.length === 0) {
    container.innerHTML = `<p style="color:#6b7280;text-align:center;padding:12px">No scan results yet. Run a scan to see results.</p>`;
    return;
  }

  container.innerHTML = scans.map(scan => `
    <div class="card-item light-gray" data-scan-id="${scan.id}">
      <div class="card-header">
        <h4>${scan.check}</h4>
        ${badgeHTML(scan.status)}
      </div>
      <p class="desc">${scan.description}</p>
      <div class="alert-meta-box">
        <span class="time">${scan.time}</span>
        <span class="details">${scan.details}</span>
      </div>
    </div>
  `).join("");
}

/* ── WIRE ADD BUTTONS ─────────────────────────────── */

function wireAddButtons() {
  if (!roleAllowed(["admin","superuser"])) return;

  // Inject "+ New backup" button target
  const backupPanel = document.getElementById("backupJobsContainer")?.closest(".panel");
  if (backupPanel) {
    const existingBtn = backupPanel.querySelector(".btn-secondary");
    if (existingBtn) existingBtn.onclick = () => BackupsModule.openNewBackupModal();
  }

  // Inject "+ Add update" button to system updates panel header
  const updatesPanel = document.getElementById("systemUpdatesContainer")?.closest(".panel");
  if (updatesPanel) {
    const header = updatesPanel.querySelector(".panel-header");
    if (header && !header.querySelector("[data-add-update]")) {
      const btn = document.createElement("button");
      btn.className = "btn-secondary clickable";
      btn.dataset.addUpdate = "1";
      btn.textContent = "+ Add Update";
      btn.style.fontSize = "13px";
      btn.onclick = () => UpdatesModule.openAddUpdateModal();
      // Replace or append next to "View all updates"
      const existing = header.querySelector(".btn-secondary");
      if (existing) existing.replaceWith(btn);
      else header.appendChild(btn);
    }
  }
}

/* ── GLOBAL ONCLICK HANDLERS (called from HTML onclicks) ─ */

window.runMaintenance = () => {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("Access denied: insufficient privileges.", "error");
    return;
  }
  openModal({
    title: "Run Maintenance Now",
    bodyHTML: `
      <p>This will start the full maintenance sequence immediately:</p>
      <ul style="margin:12px 0 0 20px;font-size:14px;color:#374151;line-height:2">
        <li>Run all pending backup jobs</li>
        <li>Apply scheduled system updates</li>
        <li>Execute error scan</li>
      </ul>
      <p style="margin-top:12px;color:#6b7280;font-size:13px">Estimated duration: 45–60 minutes.</p>
    `,
    confirmLabel: "Start Maintenance",
    onConfirm: () => {
      showToast("Maintenance sequence started. Monitor progress in the System Health panel.", "success", 5000);
      EnerTrackDB.maintenanceWindow.status = "running";
    }
  });
};

window.newBackup = () => BackupsModule.openNewBackupModal();

window.viewUpdates = () => UpdatesModule.openAddUpdateModal();

window.runScan = () => {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("Access denied.", "error");
    return;
  }
  showToast("Running error scan…", "info", 2000);
  setTimeout(() => {
    // Simulate a fresh scan result
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Update existing scans with fresh timestamps
    EnerTrackDB.errorScans.forEach(s => s.time = timeStr);
    renderErrorScans("errorScanContainer");
    showToast("Scan complete. Results updated.", "success");
  }, 2200);
};

window.viewSystemLogs = () => {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("Access denied: admin privileges required to view logs.", "error");
    return;
  }
  openModal({
    title: "System Logs",
    bodyHTML: `
      <div style="background:#111827;color:#d1fae5;padding:16px;border-radius:8px;font-family:monospace;font-size:12px;line-height:1.8;max-height:260px;overflow-y:auto">
        <div>[04:15:02] INFO  Backup BK-2024-09-21-FULL completed. 245GB verified.</div>
        <div>[04:22:10] WARN  Payment-API p95 latency: 267ms (threshold: 250ms)</div>
        <div>[04:28:33] WARN  Worker queue depth: 1,234 jobs (threshold: 1,000)</div>
        <div>[04:30:00] INFO  Scheduled maintenance window begins in 90 minutes.</div>
        <div>[04:31:14] INFO  Redis cache hit rate: 96.4%</div>
        <div>[04:33:02] INFO  Auth service: all tokens valid, 0 anomalies.</div>
        <div>[04:35:55] INFO  DB replication lag: 120ms (within SLA)</div>
      </div>
      <p style="font-size:12px;color:#6b7280;margin-top:10px">Showing last 7 log entries.</p>
    `,
    confirmLabel: "Close",
    cancelLabel: "",
    onConfirm: () => {}
  });
};

window.runErrorScan = () => window.runScan();

window.restartServices = () => {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("Access denied: admin privileges required.", "error");
    return;
  }
  openModal({
    title: "Restart Services",
    bodyHTML: `
      <p style="margin-bottom:12px">Select services to restart:</p>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:14px">
        ${["API Gateway","Auth Service","Cache (Redis)","Background Workers","Payment-API Proxy"]
          .map(s => `
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
              <input type="checkbox" value="${s}" style="width:16px;height:16px;cursor:pointer">
              ${s}
            </label>
          `).join("")}
      </div>
    `,
    confirmLabel: "Restart Selected",
    danger: false,
    onConfirm: () => {
      const selected = [...document.querySelectorAll("#et-modal input[type=checkbox]:checked")]
        .map(el => el.value);
      if (selected.length === 0) {
        showToast("No services selected.", "warning");
        return;
      }
      showToast(`Restarting: ${selected.join(", ")}`, "info", 4000);
    }
  });
};

window.viewChecklist = () => {
  const hasUnresolvedAlerts  = EnerTrackDB.alerts.some(a => !a.resolved && a.severity === "danger");
  const hasPendingUpdates    = EnerTrackDB.systemUpdates.some(u => u.status === "not-applied");
  const hasScanIssues        = EnerTrackDB.errorScans.some(s => s.status === "issues");

  const item = (label, ok) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px">
      <span style="font-size:16px">${ok ? "✓" : "✕"}</span>
      <span style="color:${ok?"#166534":"#dc2626"};font-weight:600">${label}</span>
      <span style="color:#6b7280;font-size:13px;margin-left:auto">${ok ? "Resolved" : "Action needed"}</span>
    </div>`;

  openModal({
    title: "Logout Readiness Checklist",
    bodyHTML: `
      ${item("No critical alerts", !hasUnresolvedAlerts)}
      ${item("All security patches applied", !hasPendingUpdates)}
      ${item("No scan issues", !hasScanIssues)}
      <p style="margin-top:16px;font-size:13px;color:#6b7280">
        ${(!hasUnresolvedAlerts && !hasPendingUpdates && !hasScanIssues)
          ? "✓ All checks passed. Safe to log out."
          : "Resolve flagged items before logging out."}
      </p>
    `,
    confirmLabel: "Close",
    cancelLabel: "",
    onConfirm: () => {}
  });
};
