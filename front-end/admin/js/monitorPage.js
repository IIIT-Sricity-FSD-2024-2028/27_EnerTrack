/**
 * monitorPage.js
 * Entry-point for admin_monitor.html.
 * Wires monitor data rendering and the manual-refresh button.
 */

import EnerTrackDB   from "./data/mockData.js";
import AlertsModule  from "./modules/alerts.js";
import MonitorModule from "./modules/monitor.js";
import { showToast, roleAllowed, renderSessionUI, confirmLogout } from "./utils/utils.js";

/* ── BOOT ─────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  window.EnerTrackDB = EnerTrackDB;

  renderSessionUI(window.EnerTrackDB.session.user);

  // Render all monitor sections
  MonitorModule.renderSystemHealth("systemHealthContainer");
  MonitorModule.renderPerformanceMetrics("perfMetricsContainer");
  MonitorModule.renderSloCard("sloContainer");
  AlertsModule.renderMonitorAlerts("monitorAlertContainer");

  // Update the refresh timestamp
  updateRefreshStamp();

  // Wire "Add Alert" button for admin/superuser
  if (roleAllowed(["admin","superuser"])) {
    const alertsHeader = document.getElementById("monitorAlertContainer")
      ?.closest(".panel")
      ?.querySelector(".panel-header");
    if (alertsHeader) {
      const addBtn = document.createElement("button");
      addBtn.className = "btn-secondary";
      addBtn.textContent = "+ Add Alert";
      addBtn.style.fontSize = "13px";
      addBtn.onclick = () => AlertsModule.openAddAlertModal();
      alertsHeader.appendChild(addBtn);
    }
  }

  // Profile card logout
  const profileCard = document.querySelector(".profile-card");
  if (profileCard) {
    profileCard.addEventListener("click", e => {
      e.preventDefault();
      confirmLogout();
    });
  }

  // Auto-refresh every 30 seconds
  setInterval(() => {
    MonitorModule.refreshMonitorData();
    AlertsModule.renderMonitorAlerts("monitorAlertContainer");
    updateRefreshStamp();
  }, 30000);
});

/* ── REFRESH STAMP ────────────────────────────────── */

function updateRefreshStamp() {
  const el = document.getElementById("refreshStamp");
  if (el) el.textContent = "Just now";
}

/* ── GLOBAL ONCLICK HANDLERS ──────────────────────── */

window.refreshMonitor = () => {
  MonitorModule.refreshMonitorData();
  AlertsModule.renderMonitorAlerts("monitorAlertContainer");
  updateRefreshStamp();
};
