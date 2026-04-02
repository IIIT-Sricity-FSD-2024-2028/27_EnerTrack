/**
 * session.js
 * Manages user session, role-based UI rendering, and state persistence.
 * Mirrors admin/js/modules/session.js pattern.
 */

import FinanceDB from "../data/mockData.js";
import { showToast } from "../utils/utils.js";

const SESSION_KEY = "enertrack_finance_session";

/* ── INIT ─────────────────────────────────────────── */

export function initSession() {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try { FinanceDB.session.user = JSON.parse(stored); }
    catch (_) { sessionStorage.removeItem(SESSION_KEY); }
  } else {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(FinanceDB.session.user));
  }
  window.FinanceDB = FinanceDB; // expose globally for can() helper
  renderSessionUI();
}

export function getCurrentUser() {
  return FinanceDB.session.user;
}

export function getRole() {
  return FinanceDB.session.user?.role ?? "enduser";
}

/* ── UI RENDERING ─────────────────────────────────── */

export function renderSessionUI() {
  const user = getCurrentUser();
  if (!user) return;

  /* Use the shared currentUser from sign-in/sign-up if available */
  var displayName = user.name;
  var displayRole = roleLabel(user.role);
  var currentUserData = sessionStorage.getItem("currentUser");
  if (currentUserData) {
    try {
      var cu = JSON.parse(currentUserData);
      displayName = cu.name || displayName;
      displayRole = cu.role || displayRole;
    } catch (_) {}
  }

  document.querySelectorAll(".profile-name").forEach(el => el.textContent = displayName);
  document.querySelectorAll(".profile-role").forEach(el => el.textContent = displayRole);

  const welcome = document.querySelector("h1.welcome");
  if (welcome) welcome.textContent = `Welcome back, ${displayName.split(" ")[0]}`;

  // Role-gated elements: data-roles="superuser,finance_analyst"
  document.querySelectorAll("[data-roles]").forEach(el => {
    const allowed = el.dataset.roles.split(",").map(r => r.trim());
    el.style.display = allowed.includes(user.role) ? "" : "none";
  });

  // Permission-gated elements: data-perm="delete"
  document.querySelectorAll("[data-perm]").forEach(el => {
    const perm = el.dataset.perm;
    const perms = FinanceDB.rolePermissions[user.role] ?? [];
    el.style.display = perms.includes(perm) ? "" : "none";
  });
}

function roleLabel(role) {
  return {
    superuser:       "Super User",
    finance_analyst: "Finance Analyst",
    enduser:         "End User"
  }[role] ?? role;
}

/* ── ROLE SWITCHER (dev/demo) ─────────────────────── */

export function switchRole(role) {
  const allowed = ["superuser", "finance_analyst", "enduser"];
  if (!allowed.includes(role)) { showToast(`Unknown role: ${role}`, "error"); return; }
  FinanceDB.session.user.role = role;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(FinanceDB.session.user));
  renderSessionUI();
  showToast(`Role switched to: ${roleLabel(role)}`, "info");
}

/* ── EXPORT NAMESPACE ─────────────────────────────── */
const SessionModule = { initSession, getCurrentUser, getRole, renderSessionUI, switchRole };
window.SessionModule = SessionModule;
export default SessionModule;
