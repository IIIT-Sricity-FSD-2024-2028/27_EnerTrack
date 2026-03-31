/**
 * session.js
 * Manages user session, role-based UI rendering, and state persistence via sessionStorage.
 * Used by: all admin pages.
 */

import EnerTrackDB from "../data/mockData.js";
import { showToast, openModal } from "../utils/utils.js";

const SESSION_KEY = "enertrack_session";

/* ── INIT SESSION ─────────────────────────────────── */

/**
 * Loads session from sessionStorage into EnerTrackDB,
 * or seeds sessionStorage from the default mock user.
 */
export function initSession() {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      EnerTrackDB.session.user = JSON.parse(stored);
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } else {
    // Persist the default mock admin user
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(EnerTrackDB.session.user));
  }
  renderSessionUI();
}

export function getCurrentUser() {
  return EnerTrackDB.session.user;
}

export function getRole() {
  return EnerTrackDB.session.user?.role ?? "enduser";
}

/* ── RENDER SESSION-SPECIFIC UI ───────────────────── */

/**
 * Updates profile card, role pill, and hides/shows elements
 * decorated with data-roles="admin,superuser" attributes.
 */
export function renderSessionUI() {
  const user = getCurrentUser();
  if (!user) return;

  // Profile card
  document.querySelectorAll(".profile-info strong").forEach(el => el.textContent = user.name);
  document.querySelectorAll(".profile-info span").forEach(el => {
    if (!el.id) el.textContent = roleLabel(user.role);
  });
  document.querySelectorAll(".profile-img").forEach(el => el.textContent = user.initials);

  // Welcome header (overview page)
  const welcomeH1 = document.querySelector(".page-header h1");
  if (welcomeH1 && welcomeH1.textContent.includes("Welcome")) {
    welcomeH1.textContent = `Welcome back, ${user.name.split(" ")[0]}`;
  }

  // Role-gated elements: <button data-roles="admin,superuser">
  document.querySelectorAll("[data-roles]").forEach(el => {
    const allowed = el.dataset.roles.split(",").map(r => r.trim());
    el.style.display = allowed.includes(user.role) ? "" : "none";
  });
}

function roleLabel(role) {
  return { superuser: "Super User", admin: "System Administrator", enduser: "End User" }[role] ?? role;
}

/* ── SWITCH ROLE (dev/demo helper) ───────────────── */

/**
 * Lets the demo switch roles without a full login page.
 * Call from the browser console: SessionModule.switchRole('enduser')
 */
export function switchRole(role) {
  const allowed = ["superuser", "admin", "enduser"];
  if (!allowed.includes(role)) {
    showToast(`Unknown role: ${role}`, "error");
    return;
  }
  EnerTrackDB.session.user.role = role;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(EnerTrackDB.session.user));
  renderSessionUI();
  showToast(`Role switched to: ${roleLabel(role)}`, "info");
}

/* ── LOGOUT ───────────────────────────────────────── */

export function confirmLogout() {
  openModal({
    title: "Confirm Logout",
    bodyHTML: `
      <p>Are you sure you want to log out?</p>
      <p style="margin-top:8px;color:#6b7280;font-size:14px">
        Ensure all critical maintenance tasks are resolved before logging out.
      </p>
    `,
    confirmLabel: "Log Out",
    cancelLabel: "Stay",
    onConfirm: () => {
      sessionStorage.removeItem(SESSION_KEY);
      showToast("Logged out successfully.", "info", 1500);
      setTimeout(() => {
        // In a real app this would navigate to login.html
        showToast("Redirecting to login…", "info", 1500);
      }, 1600);
    }
  });
}

/* ── EXPORT NAMESPACE ─────────────────────────────── */

const SessionModule = {
  initSession,
  getCurrentUser,
  getRole,
  renderSessionUI,
  switchRole,
  confirmLogout
};

window.SessionModule = SessionModule;
export default SessionModule;
