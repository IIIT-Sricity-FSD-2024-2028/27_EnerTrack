/**
 * overview.js
 * Entry-point for admin_overview.html.
 * Initialises session, wires CRUD buttons, and renders live data.
 */

import EnerTrackDB    from "./data/mockData.js";
import AlertsModule   from "./modules/alerts.js";
import BackupsModule  from "./modules/backups.js";
import UpdatesModule  from "./modules/updates.js";
import { showToast, roleAllowed, renderSessionUI, confirmLogout } from "./utils/utils.js";

/* ── BOOT ─────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Make DB globally accessible (for inline onclick handlers in other modules)
  window.EnerTrackDB = EnerTrackDB;

  // 2. Session
  renderSessionUI(window.EnerTrackDB.session.user);

  // 3. Render live data sections
  AlertsModule.renderAlerts("alertContainer");
  UpdatesModule.renderOverviewUpdates("overviewUpdatesContainer");

  // 4. Render stat cards
  renderStatCards();

  // 5. Wire buttons
  wireButtons();
});

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

  const profileCard = document.querySelector(".profile-card");
  if (profileCard) {
    profileCard.addEventListener("click", e => {
      e.preventDefault();
      confirmLogout();
    });
  }

  // Add alert button (overview header area — inject if admin/superuser)
  if (roleAllowed(["admin","superuser"])) {
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
  if (!roleAllowed(["admin","superuser"])) {
    showToast("Access denied: insufficient privileges.", "error");
    return;
  }
  const messages = {
    "View System Logs":  "Opening system log viewer…",
    "Error Check Scan":  "Running error check scan…",
    "SSH Terminal":      "Launching SSH terminal session…",
    "Restart Services":  "Opening service restart manager…"
  };
  showToast(messages[label] ?? `Running: ${label}`, "info");
}

/* ── GLOBAL ONCLICK HANDLERS (called from HTML) ───── */

window.viewMetrics = () => { window.location.href = "admin_monitor.html"; };
