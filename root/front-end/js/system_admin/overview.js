/**
 * overview.js
 * Entry-point for system_admin_overview.html.
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

document.addEventListener("DOMContentLoaded", async () => {
  // Re-sync from localStorage on every page load
  const stored = localStorage.getItem('enertrack_unified_db');
  if (stored) {
    try { Object.assign(EnerTrackDB, JSON.parse(stored)); } catch (e) { }
  }
  window.EnerTrackDB = EnerTrackDB;

  SessionModule.initSession();
  injectIcons();

  AlertsModule.renderAlerts("alertContainer");
  UpdatesModule.renderOverviewUpdates("overviewUpdatesContainer");
  renderOverviewBackups();
  renderStatCards();
  wireButtons();

  // Live: fetch user count from backend and update stat card
  try {
    if (window.api) {
      const users = await window.api.get('/users');
      if (Array.isArray(users)) {
        const countEl = document.getElementById('statTotalUsers');
        if (countEl) countEl.textContent = users.length;
      }
    }
  } catch (err) {
    console.warn('[SA Overview] Could not fetch user count:', err.message);
  }

  await renderUsersTable();
  wireUserDirectory();
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
      window.location.href = "system_admin_monitor.html";
    };
  }
  // "Install Now" and "Reschedule" buttons come from renderOverviewUpdates (dynamic)
  // Profile card click is handled by dashboardProfileMenu.js to show the profile popup
  // (removed redundant logout confirmation here)

  // Add alert button (overview header area — inject if system_admin/superuser)
  if (roleAllowed(["system_admin", "superuser"])) {
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
  if (!roleAllowed(["system_admin", "superuser"])) {
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

window.viewMetrics = () => { window.location.href = "system_admin_monitor.html"; };

/* ── USER DIRECTORY ───────────────────────────────── */

async function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  try {
    if (!window.api) throw new Error('API not available');
    const users = await window.api.get('/users');
    if (!Array.isArray(users)) throw new Error('Invalid response');

    // Also update the total users stat card just in case
    const countEl = document.getElementById('statTotalUsers');
    if (countEl) countEl.textContent = users.length;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #6b7280;">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 8px; font-size: 14px; color: #111827; font-weight: 500;">${u.name || '—'}</td>
        <td style="padding: 12px 8px; font-size: 14px; color: #6b7280;">${u.email || '—'}</td>
        <td style="padding: 12px 8px; font-size: 13px;">
          <span style="background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 9999px; font-weight: 600;">${u.role || 'User'}</span>
        </td>
        <td style="padding: 12px 8px; font-size: 14px; color: #6b7280;">${u.department || '—'}</td>
        <td style="padding: 12px 8px;">
          <button onclick="editUser('${u.user_id}')" style="background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 13px; font-weight: 600; margin-right: 8px;">Edit</button>
          <button onclick="deleteUser('${u.user_id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px; font-weight: 600;">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.warn('[SA Overview] User directory fetch failed:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #ef4444;">Failed to load users. Backend unavailable.</td></tr>`;
  }
}

function wireUserDirectory() {
  const modal = document.getElementById('userModal');
  const form = document.getElementById('userForm');
  const btnCreate = document.getElementById('btnCreateUser');
  const btnCancel = document.getElementById('btnCancelUser');

  if (btnCreate) {
    btnCreate.addEventListener('click', () => {
      form.reset();
      document.getElementById('userId').value = '';
      document.getElementById('userPassword').required = true;
      document.getElementById('userModalTitle').textContent = 'Add New User';
      modal.style.display = 'flex';
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('userId').value;
      const name = document.getElementById('userName').value.trim();
      const email = document.getElementById('userEmail').value.trim();
      const password = document.getElementById('userPassword').value;
      const role = document.getElementById('userRole').value;
      const department = document.getElementById('userDepartment').value.trim();

      const payload = { name, email, role, department };
      if (password) payload.password = password;

      try {
        if (!window.api) throw new Error('API not loaded');

        if (id) {
          // Update
          const res = await window.api.patch(`/users/${id}`, payload);
          if (res && !res.error) showToast('User updated successfully', 'success');
        } else {
          // Create
          const res = await window.api.post('/users', payload);
          if (res && !res.error) showToast('User created successfully', 'success');
        }

        modal.style.display = 'none';
        renderUsersTable();
      } catch (err) {
        showToast('Failed to save user. See console for details.', 'error');
        console.error('[SA Overview] Save user error:', err);
      }
    });
  }
}

window.editUser = async (id) => {
  try {
    if (!window.api) throw new Error('API not available');
    
    // In a real scenario, we might get the user from cache. Let's fetch to be safe.
    // Or we could parse it from the table... fetching is better:
    const users = await window.api.get('/users');
    const user = users.find(u => u.user_id === id);
    if (!user) throw new Error('User not found');

    document.getElementById('userId').value = user.user_id;
    document.getElementById('userName').value = user.name || '';
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').required = false; // Optional on edit
    
    const roleSelect = document.getElementById('userRole');
    if (user.role) {
      for (let i = 0; i < roleSelect.options.length; i++) {
        if (roleSelect.options[i].value === user.role) {
          roleSelect.selectedIndex = i;
          break;
        }
      }
    }

    document.getElementById('userDepartment').value = user.department || '';
    
    document.getElementById('userModalTitle').textContent = 'Edit User';
    document.getElementById('userModal').style.display = 'flex';
  } catch (err) {
    showToast('Failed to load user for editing.', 'error');
    console.error(err);
  }
};

window.deleteUser = async (id) => {
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
  
  try {
    if (!window.api) throw new Error('API not available');
    const res = await window.api.delete(`/users/${id}`);
    if (res && !res.error) {
      showToast('User deleted successfully', 'success');
      renderUsersTable();
    }
  } catch (err) {
    showToast('Failed to delete user.', 'error');
    console.error(err);
  }
};
