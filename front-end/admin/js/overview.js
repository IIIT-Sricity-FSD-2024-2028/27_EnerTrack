/**
 * overview.js
 * Entry-point for admin_overview.html.
 * Initialises session, wires CRUD buttons, and renders live data.
 */

import EnerTrackDB from "./data/mockData.js";
import SessionModule from "./modules/session.js";
import AlertsModule from "./modules/alerts.js";
import BackupsModule from "./modules/backups.js";
import UpdatesModule from "./modules/updates.js";
import { showToast, roleAllowed } from "./utils/utils.js";
import { injectIcons } from "./utils/icons.js";

/* ── BOOT ─────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  // Re-sync from localStorage on every page load
  const stored = localStorage.getItem('enertrack_unified_db');
  if (stored) {
    try { Object.assign(EnerTrackDB, JSON.parse(stored)); } catch (e) { }
  }
  // 1. Make DB globally accessible (for inline onclick handlers in other modules)
  window.EnerTrackDB = EnerTrackDB;

  // 2. Session
  SessionModule.initSession();

  // 3. Inject SVG Icons
  injectIcons();

  // 4. Render live data sections
  AlertsModule.renderAlerts("alertContainer");
  UpdatesModule.renderOverviewUpdates("overviewUpdatesContainer");
  renderOverviewBackups();

  // 4. Render stat cards
  renderStatCards();

  // 5. Wire buttons
  wireButtons();

});


/* ── OVERVIEW BACKUPS ─────────────────────────────── */

function renderOverviewBackups() {
  const container = document.getElementById("overviewBackupsContainer");
  if (!container) return;

  const jobs = EnerTrackDB.backupJobs.filter(job => job.status === "completed" || job.status === "ready");

  if (jobs.length === 0) {
    container.innerHTML = `<p style="color:#6b7280;text-align:center;padding:16px;font-size:14px">No recent backups.</p>`;
    return;
  }

  container.innerHTML = jobs.map(job => {
    // Determine badge and color based on status/errors
    let badgeHtml = '<span class="badge badge-success">Success</span>';
    let progressColor = '#10b981'; // default green

    if (job.status === 'failed') {
      badgeHtml = '<span class="badge badge-danger">Failed</span>';
      progressColor = '#ef4444'; // red
    } else if (job.errors > 0 || job.status === 'degraded') {
      badgeHtml = '<span class="badge badge-warning">Warnings</span>';
      progressColor = '#f59e0b'; // orange
    }

    // Default to 100% progress for completed jobs if not specified
    const progress = job.progress || 100;

    return `
      <div class="backup-card mx">
        <div class="backup-header" style="margin-bottom:12px;">
          <span data-icon="backup"></span>
          <div>
            <h4>${job.name}</h4>
            <span class="muted">Target: ${job.target}</span>
          </div>
          ${badgeHtml}
        </div>
        <div class="progress-bar">
          <div class="progress" style="width:${progress}%; background-color:${progressColor}"></div>
        </div>
        <div class="backup-footer" style="margin-top:12px;">
          <span>Verified with ${job.errors} errors</span>
          <span>Completed in ${job.duration ?? "—"}</span>
        </div>
      </div>
    `;
  }).join("");
}

/* ── STAT CARDS ───────────────────────────────────── */

function renderStatCards() {
  const stats = EnerTrackDB.performanceStats;
  const activeAlerts = EnerTrackDB.alerts.filter(a => !a.resolved).length;

  // Active alerts count is dynamic
  ["activeAlertsCount"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = activeAlerts;
  });

  // Health
  const healthEl = document.querySelector(".stat-card:nth-child(1) h2");
  if (healthEl) healthEl.textContent = stats.systemHealth.value;

  // CPU
  const cpuEl = document.querySelector(".stat-card:nth-child(3) h2");
  if (cpuEl) cpuEl.textContent = stats.avgCpuLoad.value;

  // Backup
  const backupEl = document.querySelector(".stat-card:nth-child(4) h2");
  if (backupEl) backupEl.textContent = stats.lastBackup.value;
}

/* ── BUTTON WIRING ────────────────────────────────── */

function wireButtons() {
  // "View Metrics" button (Server Performance panel)
  const viewMetricsBtn = document.querySelector(".panel .btn-secondary");
  if (viewMetricsBtn) {
    viewMetricsBtn.onclick = () => {
      window.location.href = "admin_monitor.html";
    };
  }
  // "Install Now" and "Reschedule" buttons come from renderOverviewUpdates (dynamic)
  // Profile card click is handled by dashboardProfileMenu.js to show the profile popup
  // (removed redundant logout confirmation here)

  // Add alert button (overview header area — inject if admin/superuser)
  if (roleAllowed(["admin", "superuser"])) {
    const recentAlertsHeader = document.querySelector("#alertContainer")?.closest(".panel")?.querySelector(".panel-header");
    if (recentAlertsHeader) {
      const addBtn = document.createElement("button");
      addBtn.className = "btn-secondary";
      addBtn.textContent = "+ Add Alert";
      addBtn.style.fontSize = "13px";
      addBtn.onclick = () => AlertsModule.openAddAlertModal();
      recentAlertsHeader.appendChild(addBtn);
    }
  }

  // Troubleshooting buttons
  document.querySelectorAll(".tool-btn").forEach(btn => {
    const text = btn.textContent.trim();
    btn.addEventListener("click", () => handleToolAction(text));
  });
}

/* ── TOOL ACTIONS ─────────────────────────────────── */

function handleToolAction(label) {
  if (!roleAllowed(["admin", "superuser"])) {
    showToast("Access denied: insufficient privileges.", "error");
    return;
  }
  const messages = {
    "View System Logs": "Opening system log viewer…",
    "Error Check Scan": "Running error check scan…",
    "SSH Terminal": "Launching SSH terminal session…",
    "Restart Services": "Opening service restart manager…"
  };
  showToast(messages[label] ?? `Running: ${label}`, "info");
}

/* ── GLOBAL ONCLICK HANDLERS (called from HTML) ───── */

window.viewMetrics = () => { window.location.href = "admin_monitor.html"; };
