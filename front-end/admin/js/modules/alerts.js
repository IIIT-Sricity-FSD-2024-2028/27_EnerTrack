/**
 * alerts.js
 * CRUD operations for Alerts data.
 * Used by: admin_overview.html, admin_monitor.html
 */

import EnerTrackDB from "../data/mockData.js";
import { showToast, openModal, badgeHTML, timeAgo, generateId, validateForm, showFieldError, clearAllErrors, roleAllowed } from "../utils/utils.js";
import { injectIcons } from "../utils/icons.js";

/* ── READ ─────────────────────────────────────────── */

export function getAlerts() {
  return EnerTrackDB.alerts;
}

export function getActiveAlerts() {
  const active = EnerTrackDB.alerts.filter(a => !a.resolved);
  // Sort critical (danger) first, then warning
  return active.sort((a, b) => {
    if (a.severity === b.severity) return new Date(b.timestamp) - new Date(a.timestamp);
    return a.severity === 'danger' ? -1 : 1;
  });
}

export function getAlertById(id) {
  return EnerTrackDB.alerts.find(a => a.id === id) ?? null;
}

/* ── RENDER ───────────────────────────────────────── */

/**
 * Renders the alerts list into a container element.
 * Used by admin_overview.html #alertContainer
 */
export function renderAlerts(containerId = "alertContainer") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const active = getActiveAlerts();

  if (active.length === 0) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:#6b7280;font-size:15px">
        No active alerts — all systems nominal.
      </div>`;
    updateAlertCounts(0);
    return;
  }

  container.innerHTML = active.map(alert => `
    <div class="alert-item ${alert.severity}" data-alert-id="${alert.id}">
      <div class="alert-icon bg-${alert.severity}-light text-${alert.severity}">
        <span data-icon="${alert.severity === 'danger' ? 'error' : 'alert'}" style="width:24px;height:24px"></span>
      </div>
      <div class="alert-content" style="flex:1">
        <h4>${alert.title}</h4>
        <p>${alert.description}</p>
        <div class="alert-meta">${timeAgo(alert.timestamp)} • Server: ${alert.server}</div>
      </div>
      <div class="alert-actions" style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        ${roleAllowed(["admin","superuser"]) ? `
          <button class="btn-outline" style="font-size:12px;padding:4px 10px; border-radius: 6px;"
            onclick="AlertsModule.editAlert('${alert.id}')">Edit</button>
          <button class="btn-outline" style="font-size:12px;padding:4px 10px;color:#dc2626;border-color:#fca5a5; border-radius: 6px;"
            onclick="AlertsModule.resolveAlert('${alert.id}')">Resolve</button>
        ` : ""}
      </div>
    </div>
  `).join("");

  injectIcons();
  updateAlertCounts(active.length);
}

/**
 * Renders monitor-page style alert cards into a container.
 * Used by admin_monitor.html for the Active Alerts panel.
 */
export function renderMonitorAlerts(containerId = "monitorAlertContainer") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const active = getActiveAlerts();

  if (active.length === 0) {
    container.innerHTML = `
      <div class="status-card" style="text-align:center;color:#6b7280;font-size:15px;padding:16px">
        No active alerts — all clear.
      </div>`;
    document.querySelectorAll(".alerts-badge").forEach(el => el.textContent = "0");
    return;
  }

  container.innerHTML = active.map(alert => `
    <div class="status-card" data-alert-id="${alert.id}">
      <div class="status-header">
        <h4>${alert.title}</h4>
        ${badgeHTML(alert.severity)}
      </div>
      <p class="desc">${alert.description}</p>
      <div class="alert-meta-box" style="justify-content:space-between;align-items:center">
        <div style="display:flex;gap:12px">
          <span class="time">${new Date(alert.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
          <span class="details">Server: ${alert.server}</span>
        </div>
        ${roleAllowed(["admin","superuser"]) ? `
          <div style="display:flex;gap:6px">
            <button class="btn-secondary" style="font-size:12px;padding:4px 10px"
              onclick="AlertsModule.editAlert('${alert.id}')">Edit</button>
            <button class="btn-secondary" style="font-size:12px;padding:4px 10px;color:#dc2626"
              onclick="AlertsModule.resolveAlert('${alert.id}')">Resolve</button>
          </div>
        ` : ""}
      </div>
    </div>
  `).join("");

  injectIcons();
  document.querySelectorAll(".alerts-badge").forEach(el => el.textContent = active.length);
}

/* ── CREATE ───────────────────────────────────────── */

export function openAddAlertModal() {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("You do not have permission to add alerts.", "error");
    return;
  }

  openModal({
    title: "Add New Alert",
    bodyHTML: `
      <div id="add-alert-form">
        <div class="et-form-group">
          <label for="af-title">Alert Title *</label>
          <input id="af-title" type="text" placeholder="e.g. Disk Usage Warning" maxlength="80">
        </div>
        <div class="et-form-group">
          <label for="af-desc">Description *</label>
          <textarea id="af-desc" rows="3" placeholder="Describe the issue..." maxlength="200"></textarea>
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="af-severity">Severity *</label>
            <select id="af-severity">
              <option value="">-- Select --</option>
              <option value="warning">Warning</option>
              <option value="danger">Critical</option>
            </select>
          </div>
          <div class="et-form-group">
            <label for="af-server">Server / Service *</label>
            <input id="af-server" type="text" placeholder="e.g. DB-Prod-01" maxlength="60">
          </div>
        </div>
      </div>
    `,
    confirmLabel: "Add Alert",
    onConfirm: () => {
      const title    = document.getElementById("af-title")?.value ?? "";
      const desc     = document.getElementById("af-desc")?.value ?? "";
      const severity = document.getElementById("af-severity")?.value ?? "";
      const server   = document.getElementById("af-server")?.value ?? "";
      addAlert({ title, description: desc, severity, server });
    }
  });
}

export function addAlert({ title, description, severity, server }) {
  // Re-validate in the module (modal already closed, so we validate data directly)
  const { valid, errors } = validateForm(
    { title, description, severity, server },
    {
      title:       { required: true, minLength: 3, maxLength: 80 },
      description: { required: true, minLength: 5, maxLength: 200 },
      severity:    { required: true },
      server:      { required: true, minLength: 2, maxLength: 60 }
    }
  );

  if (!valid) {
    const msgs = Object.values(errors).join(" • ");
    showToast(`Validation failed: ${msgs}`, "error", 5000);
    return false;
  }

  const newAlert = {
    id: generateId("alt"),
    title: title.trim(),
    description: description.trim(),
    severity,
    server: server.trim(),
    timestamp: new Date().toISOString(),
    resolved: false
  };

  EnerTrackDB.alerts.unshift(newAlert);
  EnerTrackDB.save(); // Sync to localStorage
  showToast(`Alert "${newAlert.title}" added.`, "success");
  refreshAlertUI();
  return true;
}

/* ── UPDATE ───────────────────────────────────────── */

export function editAlert(id) {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("You do not have permission to edit alerts.", "error");
    return;
  }

  const alert = getAlertById(id);
  if (!alert) { showToast("Alert not found.", "error"); return; }

  openModal({
    title: "Edit Alert",
    bodyHTML: `
      <div id="edit-alert-form">
        <div class="et-form-group">
          <label for="ea-title">Alert Title *</label>
          <input id="ea-title" type="text" value="${alert.title}" maxlength="80">
        </div>
        <div class="et-form-group">
          <label for="ea-desc">Description *</label>
          <textarea id="ea-desc" rows="3" maxlength="200">${alert.description}</textarea>
        </div>
        <div class="et-form-row">
          <div class="et-form-group">
            <label for="ea-severity">Severity *</label>
            <select id="ea-severity">
              <option value="warning" ${alert.severity==="warning"?"selected":""}>Warning</option>
              <option value="danger"  ${alert.severity==="danger" ?"selected":""}>Critical</option>
            </select>
          </div>
          <div class="et-form-group">
            <label for="ea-server">Server / Service *</label>
            <input id="ea-server" type="text" value="${alert.server}" maxlength="60">
          </div>
        </div>
      </div>
    `,
    confirmLabel: "Save Changes",
    onConfirm: () => {
      const title    = document.getElementById("ea-title")?.value ?? alert.title;
      const desc     = document.getElementById("ea-desc")?.value ?? alert.description;
      const severity = document.getElementById("ea-severity")?.value ?? alert.severity;
      const server   = document.getElementById("ea-server")?.value ?? alert.server;
      updateAlert(id, { title, description: desc, severity, server });
    }
  });
}

export function updateAlert(id, fields) {
  const idx = EnerTrackDB.alerts.findIndex(a => a.id === id);
  if (idx === -1) { showToast("Alert not found.", "error"); return false; }

  const { valid, errors } = validateForm(fields, {
    title:       { required: true, minLength: 3 },
    description: { required: true, minLength: 5 },
    severity:    { required: true },
    server:      { required: true, minLength: 2 }
  });

  if (!valid) {
    showToast("Validation failed: " + Object.values(errors).join(" • "), "error", 5000);
    return false;
  }

  Object.assign(EnerTrackDB.alerts[idx], {
    title:       fields.title.trim(),
    description: fields.description.trim(),
    severity:    fields.severity,
    server:      fields.server.trim()
  });

  EnerTrackDB.save(); // Sync to localStorage
  showToast("Alert updated successfully.", "success");
  refreshAlertUI();
  return true;
}

/* ── DELETE / RESOLVE ─────────────────────────────── */

export function resolveAlert(id) {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("You do not have permission to resolve alerts.", "error");
    return;
  }

  const alert = getAlertById(id);
  if (!alert) { showToast("Alert not found.", "error"); return; }

  openModal({
    title: "Resolve Alert",
    bodyHTML: `<p>Mark <strong>${alert.title}</strong> as resolved? It will be removed from the active list.</p>`,
    confirmLabel: "Resolve",
    danger: false,
    onConfirm: () => {
      alert.resolved = true;
      EnerTrackDB.save(); // Sync to localStorage
      showToast(`Alert "${alert.title}" resolved.`, "success");
      refreshAlertUI();
    }
  });
}

export function deleteAlert(id) {
  if (!roleAllowed(["admin","superuser"])) {
    showToast("You do not have permission to delete alerts.", "error");
    return;
  }

  const alert = getAlertById(id);
  if (!alert) { showToast("Alert not found.", "error"); return; }

  openModal({
    title: "Delete Alert",
    bodyHTML: `<p>Permanently delete <strong>${alert.title}</strong>? This cannot be undone.</p>`,
    confirmLabel: "Delete",
    danger: true,
    onConfirm: () => {
      EnerTrackDB.alerts = EnerTrackDB.alerts.filter(a => a.id !== id);
      EnerTrackDB.save(); // Sync to localStorage
      showToast("Alert deleted.", "info");
      refreshAlertUI();
    }
  });
}

/* ── HELPERS ──────────────────────────────────────── */

function updateAlertCounts(count) {
  ["sidebarAlertBadge", "activeAlertsCount", "alertActionsRequired"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  });
  document.querySelectorAll(".alerts-badge").forEach(el => el.textContent = count);
}

function refreshAlertUI() {
  const active = getActiveAlerts();

  if (document.getElementById("alertContainer")) {
    renderAlerts("alertContainer");
  }
  if (document.getElementById("monitorAlertContainer")) {
    renderMonitorAlerts("monitorAlertContainer");
  }

  // Always update all count badges regardless of which page we're on
  updateAlertCounts(active.length);
}

/* ── EXPORT NAMESPACE ─────────────────────────────── */

const AlertsModule = {
  getAlerts, getActiveAlerts, getAlertById,
  renderAlerts, renderMonitorAlerts,
  openAddAlertModal, addAlert,
  editAlert, updateAlert,
  resolveAlert, deleteAlert
};

window.AlertsModule = AlertsModule;
export default AlertsModule;
