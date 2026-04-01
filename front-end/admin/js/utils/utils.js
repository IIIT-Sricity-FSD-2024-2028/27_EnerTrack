/**
 * utils.js
 * Shared utility functions: formatters, validators, toast/modal UI helpers.
 */

/* ── TIME HELPERS ─────────────────────────────────── */

export function timeAgo(isoString) {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

/* ── VALIDATION ───────────────────────────────────── */

/**
 * Validates a form field. Returns { valid: Boolean, message: String }.
 * rules: { required, minLength, maxLength, pattern, patternMsg, min, max }
 */
export function validateField(value, rules = {}) {
  const v = (value ?? "").toString().trim();

  if (rules.required && v === "") {
    return { valid: false, message: "This field is required." };
  }
  if (rules.minLength && v.length < rules.minLength) {
    return { valid: false, message: `Minimum ${rules.minLength} characters required.` };
  }
  if (rules.maxLength && v.length > rules.maxLength) {
    return { valid: false, message: `Maximum ${rules.maxLength} characters allowed.` };
  }
  if (rules.pattern && !rules.pattern.test(v)) {
    return { valid: false, message: rules.patternMsg || "Invalid format." };
  }
  if (rules.min !== undefined && Number(v) < rules.min) {
    return { valid: false, message: `Minimum value is ${rules.min}.` };
  }
  if (rules.max !== undefined && Number(v) > rules.max) {
    return { valid: false, message: `Maximum value is ${rules.max}.` };
  }
  return { valid: true, message: "" };
}

/**
 * Validates an entire form object.
 * fieldRules: { fieldName: rulesObject }
 * Returns { valid: Boolean, errors: { fieldName: message } }
 */
export function validateForm(data, fieldRules) {
  const errors = {};
  let valid = true;
  for (const [field, rules] of Object.entries(fieldRules)) {
    const result = validateField(data[field], rules);
    if (!result.valid) {
      errors[field] = result.message;
      valid = false;
    }
  }
  return { valid, errors };
}

/** Shows inline error under a form field */
export function showFieldError(inputEl, message) {
  clearFieldError(inputEl);
  inputEl.classList.add("input-error");
  const err = document.createElement("span");
  err.className = "field-error-msg";
  err.textContent = message;
  inputEl.parentNode.insertBefore(err, inputEl.nextSibling);
}

/** Clears inline error for a form field */
export function clearFieldError(inputEl) {
  inputEl.classList.remove("input-error");
  const existing = inputEl.parentNode.querySelector(".field-error-msg");
  if (existing) existing.remove();
}

/** Clears all field errors inside a container */
export function clearAllErrors(containerEl) {
  containerEl.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
  containerEl.querySelectorAll(".field-error-msg").forEach(el => el.remove());
}

/* ── TOAST NOTIFICATIONS ──────────────────────────── */

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 10px;
      z-index: 9999; pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Shows a toast notification.
 * type: "success" | "error" | "warning" | "info"
 */
export function showToast(message, type = "info", duration = 3500) {
  const container = ensureToastContainer();

  const colors = {
    success: { bg: "#166534", border: "#14532d", icon: "✓" },
    error:   { bg: "#dc2626", border: "#b91c1c", icon: "✕" },
    warning: { bg: "#ea580c", border: "#c2410c", icon: "⚠" },
    info:    { bg: "#1f2937", border: "#111827", icon: "ℹ" }
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement("div");
  toast.style.cssText = `
    display: flex; align-items: center; gap: 10px;
    background: ${c.bg}; color: #fff;
    border: 1px solid ${c.border};
    padding: 12px 18px; border-radius: 8px;
    font-family: 'PT Serif', serif; font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    pointer-events: auto; min-width: 240px; max-width: 380px;
    opacity: 0; transform: translateY(8px);
    transition: opacity 0.25s, transform 0.25s;
  `;
  toast.innerHTML = `<span style="font-weight:700;font-size:16px">${c.icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ── MODAL HELPER ─────────────────────────────────── */

/**
 * Creates and opens a generic modal dialog.
 * options: { title, bodyHTML, confirmLabel, cancelLabel, onConfirm, onCancel, danger }
 * Returns the modal element.
 */
export function openModal({ title, bodyHTML, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel, danger = false }) {
  closeModal(); // close any open modal first

  const overlay = document.createElement("div");
  overlay.id = "et-modal-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 8888;
    animation: fadeIn 0.18s ease;
  `;

  const modal = document.createElement("div");
  modal.id = "et-modal";
  modal.style.cssText = `
    background: #fff; border-radius: 12px;
    padding: 28px 32px; width: 480px; max-width: 94vw;
    font-family: 'PT Serif', serif;
    box-shadow: 0 20px 48px rgba(0,0,0,0.18);
    animation: slideUp 0.2s ease;
  `;

  const confirmBtnStyle = danger
    ? `background:#dc2626;color:#fff;border:none;`
    : `background:#111827;color:#fff;border:none;`;

  modal.innerHTML = `
    <h3 style="font-size:18px;font-weight:700;margin-bottom:16px;color:#111827">${title}</h3>
    <div class="modal-body" style="margin-bottom:24px;color:#374151;font-size:15px;line-height:1.6">${bodyHTML}</div>
    <div style="display:flex;justify-content:flex-end;gap:10px">
      <button id="modal-cancel" style="
        padding:8px 18px;border-radius:6px;font-size:14px;font-weight:600;
        border:1px solid #d1d5db;background:#fff;color:#374151;cursor:pointer;
        font-family:inherit">
        ${cancelLabel}
      </button>
      <button id="modal-confirm" style="
        padding:8px 18px;border-radius:6px;font-size:14px;font-weight:600;
        ${confirmBtnStyle}cursor:pointer;font-family:inherit">
        ${confirmLabel}
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById("modal-cancel").onclick = () => {
    closeModal();
    if (onCancel) onCancel();
  };
  document.getElementById("modal-confirm").onclick = () => {
    if (onConfirm) onConfirm();
    closeModal();
  };

  overlay.addEventListener("click", e => {
    if (e.target === overlay) {
      closeModal();
      if (onCancel) onCancel();
    }
  });

  // Inject keyframe animation once
  if (!document.getElementById("et-modal-styles")) {
    const style = document.createElement("style");
    style.id = "et-modal-styles";
    style.textContent = `
      @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
      @keyframes slideUp { from { transform:translateY(12px);opacity:0 } to { transform:translateY(0);opacity:1 } }
      .input-error { border-color: #dc2626 !important; outline: none; }
      .field-error-msg { display:block; color:#dc2626; font-size:12px; margin-top:4px; font-family:'PT Serif',serif; }
      .et-form-group { display:flex; flex-direction:column; margin-bottom:16px; }
      .et-form-group label { font-size:13px; font-weight:600; color:#374151; margin-bottom:6px; }
      .et-form-group input,
      .et-form-group select,
      .et-form-group textarea {
        padding:8px 12px; border:1px solid #d1d5db; border-radius:6px;
        font-size:14px; font-family:'PT Serif',serif; color:#1f2937;
        background:#fff; outline:none; transition:border-color 0.15s;
      }
      .et-form-group input:focus,
      .et-form-group select:focus,
      .et-form-group textarea:focus { border-color:#6b7280; }
      .et-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    `;
    document.head.appendChild(style);
  }

  return overlay;
}

export function closeModal() {
  const existing = document.getElementById("et-modal-overlay");
  if (existing) existing.remove();
}

/* ── ID GENERATOR ─────────────────────────────────── */

export function generateId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/* ── BADGE HTML HELPER ────────────────────────────── */

const BADGE_MAP = {
  "ready":       { cls: "badge-success", label: "Ready" },
  "passed":      { cls: "badge-success", label: "Passed" },
  "healthy":     { cls: "badge-success", label: "All green" },
  "applied":     { cls: "badge-success", label: "Applied" },
  "scheduled":   { cls: "badge-gray",    label: "Scheduled" },
  "planned":     { cls: "badge-gray",    label: "Planned" },
  "pending":     { cls: "badge-warning", label: "Pending" },
  "not-applied": { cls: "badge-warning", label: "Not applied" },
  "warning":     { cls: "badge-warning", label: "Warning" },
  "issues":      { cls: "badge-warning", label: "Issues found" },
  "running":     { cls: "badge-warning", label: "Running" },
  "degraded":    { cls: "badge-danger",  label: "Degraded" },
  "failed":      { cls: "badge-danger",  label: "Failed" },
  "danger":      { cls: "badge-danger",  label: "Critical" }
};

export function badgeHTML(status) {
  const b = BADGE_MAP[status] || { cls: "badge-gray", label: status };
  return `<span class="badge ${b.cls}">${b.label}</span>`;
}

/* ── ROLE GUARD ───────────────────────────────────── */

/**
 * Returns true if the current session role is allowed.
 * allowed: array of roles e.g. ["superuser","admin"]
 */
export function roleAllowed(allowed = []) {
  const role = window.EnerTrackDB?.session?.user?.role ?? "enduser";
  return allowed.includes(role);
}

export function getCurrentUser() {
  return window.EnerTrackDB?.session?.user ?? null;
}

/* ── PROFILE & SESSION UI (Moved from session.js) ─── */

export function renderSessionUI(user) {
  if (!user) return;

  document.querySelectorAll(".profile-info strong").forEach(el => el.textContent = user.name);
  document.querySelectorAll(".profile-info span").forEach(el => {
    if (!el.id) el.textContent = { superuser: "Super User", admin: "System Administrator", enduser: "End User" }[user.role] ?? user.role;
  });
  document.querySelectorAll(".profile-img").forEach(el => el.textContent = user.initials);

  const welcomeH1 = document.querySelector(".page-header h1");
  if (welcomeH1 && welcomeH1.textContent.includes("Welcome")) {
    welcomeH1.textContent = `Welcome back, ${user.name.split(" ")[0]}`;
  }

  document.querySelectorAll("[data-roles]").forEach(el => {
    const allowed = el.dataset.roles.split(",").map(r => r.trim());
    el.style.display = allowed.includes(user.role) ? "" : "none";
  });
}

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
      sessionStorage.removeItem("enertrack_session");
      showToast("Logged out successfully.", "info", 1500);
      setTimeout(() => {
        showToast("Redirecting to login…", "info", 1500);
      }, 1600);
    }
  });
}
