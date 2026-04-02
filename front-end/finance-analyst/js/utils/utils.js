/**
 * utils.js
 * Shared utility functions for EnerTrack Finance module.
 * Formatters, validators, toast/modal helpers — mirrors admin/js/utils/utils.js pattern.
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

export function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function formatCurrency(value) {
  if (value == null || isNaN(value)) return "—";
  return "$" + Number(value).toLocaleString();
}

/* ── VALIDATION ───────────────────────────────────── */

/**
 * Validates a single field against rules.
 * Rules: { required, minLength, maxLength, pattern, patternMsg, min, max, positiveNumber }
 * Returns { valid: Boolean, message: String }
 */
export function validateField(value, rules = {}) {
  const v = (value ?? "").toString().trim();

  if (rules.required && v === "") {
    return { valid: false, message: "This field is required." };
  }
  if (v === "") return { valid: true, message: "" }; // empty optional field → skip rest

  if (rules.minLength && v.length < rules.minLength) {
    return { valid: false, message: `Minimum ${rules.minLength} characters required.` };
  }
  if (rules.maxLength && v.length > rules.maxLength) {
    return { valid: false, message: `Maximum ${rules.maxLength} characters allowed.` };
  }
  if (rules.pattern && !rules.pattern.test(v)) {
    return { valid: false, message: rules.patternMsg || "Invalid format." };
  }
  if (rules.positiveNumber) {
    const n = Number(v);
    if (isNaN(n) || n <= 0) {
      return { valid: false, message: "Must be a positive number." };
    }
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
 * Validates an entire form.
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

export function showFieldError(inputEl, message) {
  clearFieldError(inputEl);
  inputEl.classList.add("input-error");
  const err = document.createElement("span");
  err.className = "field-error-msg";
  err.textContent = message;
  inputEl.parentNode.insertBefore(err, inputEl.nextSibling);
}

export function clearFieldError(inputEl) {
  inputEl.classList.remove("input-error");
  const existing = inputEl.parentNode.querySelector(".field-error-msg");
  if (existing) existing.remove();
}

export function clearAllErrors(containerEl) {
  containerEl.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
  containerEl.querySelectorAll(".field-error-msg").forEach(el => el.remove());
}

/* ── TOAST NOTIFICATIONS ──────────────────────────── */

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement("div");
    toastContainer.id = "finance-toast-container";
    toastContainer.style.cssText = `
      position:fixed;bottom:24px;right:24px;
      display:flex;flex-direction:column;gap:10px;
      z-index:9999;pointer-events:none;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

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
    display:flex;align-items:center;gap:10px;
    background:${c.bg};color:#fff;
    border:1px solid ${c.border};
    padding:12px 18px;border-radius:8px;
    font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);
    pointer-events:auto;min-width:240px;max-width:380px;
    opacity:0;transform:translateY(8px);
    transition:opacity 0.25s,transform 0.25s;
  `;
  toast.innerHTML = `<span style="font-weight:700;font-size:16px">${c.icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = "1"; toast.style.transform = "translateY(0)"; });
  setTimeout(() => {
    toast.style.opacity = "0"; toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ── MODAL HELPER ─────────────────────────────────── */

export function openModal({ title, bodyHTML, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel, danger = false }) {
  closeModal();
  injectModalStyles();

  const overlay = document.createElement("div");
  overlay.id = "finance-modal-overlay";
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.45);
    display:flex;align-items:center;justify-content:center;
    z-index:8888;animation:fadeIn 0.18s ease;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background:#fff;border-radius:12px;
    padding:28px 32px;width:520px;max-width:94vw;
    box-shadow:0 20px 48px rgba(0,0,0,0.18);
    animation:slideUp 0.2s ease;
  `;

  const confirmStyle = danger
    ? "background:#dc2626;color:#fff;border:none;"
    : "background:#111827;color:#fff;border:none;";

  modal.innerHTML = `
    <h3 style="font-size:17px;font-weight:700;margin-bottom:16px;color:#111827">${title}</h3>
    <div style="margin-bottom:24px;color:#374151;font-size:14px;line-height:1.6">${bodyHTML}</div>
    <div style="display:flex;justify-content:flex-end;gap:10px">
<<<<<<< HEAD
      <button id="fm-cancel" style="padding:8px 18px;border-radius:6px;font-size:14px;font-weight:600;border:1px solid #d1d5db;background:#fff;color:#374151;cursor:pointer">${cancelLabel}</button>
      <button id="fm-confirm" style="padding:8px 18px;border-radius:6px;font-size:14px;font-weight:600;${confirmStyle}cursor:pointer">${confirmLabel}</button>
=======
      ${cancelLabel ? `<button id="fm-cancel" style="padding:8px 18px;border-radius:6px;font-size:14px;font-weight:600;border:1px solid #d1d5db;background:#fff;color:#374151;cursor:pointer">${cancelLabel}</button>` : ""}
      ${confirmLabel ? `<button id="fm-confirm" style="padding:8px 18px;border-radius:6px;font-size:14px;font-weight:600;${confirmStyle}cursor:pointer">${confirmLabel}</button>` : ""}
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

<<<<<<< HEAD
  document.getElementById("fm-cancel").onclick = () => { closeModal(); if (onCancel) onCancel(); };
  document.getElementById("fm-confirm").onclick = () => { if (onConfirm) onConfirm(); closeModal(); };
=======
  document.body.appendChild(overlay);
 
  const cnl = document.getElementById("fm-cancel");
  if (cnl) cnl.onclick = () => { closeModal(); if (onCancel) onCancel(); };

  const cfm = document.getElementById("fm-confirm");
  if (cfm) cfm.onclick = () => { if (onConfirm) onConfirm(); closeModal(); };
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
  overlay.addEventListener("click", e => { if (e.target === overlay) { closeModal(); if (onCancel) onCancel(); } });

  return overlay;
}

export function closeModal() {
  const el = document.getElementById("finance-modal-overlay");
  if (el) el.remove();
}

function injectModalStyles() {
  if (document.getElementById("finance-modal-styles")) return;
  const style = document.createElement("style");
  style.id = "finance-modal-styles";
  style.textContent = `
    @keyframes fadeIn  { from{opacity:0}    to{opacity:1} }
    @keyframes slideUp { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
    .input-error { border-color:#dc2626 !important; outline:none; }
    .field-error-msg { display:block;color:#dc2626;font-size:12px;margin-top:4px; }
    .fm-group { display:flex;flex-direction:column;margin-bottom:14px; }
    .fm-group label { font-size:12px;font-weight:600;color:#374151;margin-bottom:5px; }
    .fm-group input, .fm-group select, .fm-group textarea {
      padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;
      font-size:14px;color:#1f2937;background:#fff;outline:none;transition:border-color 0.15s;
    }
    .fm-group input:focus, .fm-group select:focus, .fm-group textarea:focus { border-color:#6b7280; }
    .fm-row { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
  `;
  document.head.appendChild(style);
}

/* ── ID GENERATOR ─────────────────────────────────── */

export function generateId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/* ── BADGE HTML ───────────────────────────────────── */

const BADGE_MAP = {
  "viable":        { cls: "badge-success", label: "Viable" },
  "approved":      { cls: "badge-success", label: "Approved" },
  "under-budget":  { cls: "badge-success", label: "Under Budget" },
  "on-budget":     { cls: "badge-gray",    label: "On Budget" },
  "marginal":      { cls: "badge-warning", label: "Marginal" },
  "pending":       { cls: "badge-warning", label: "Pending" },
  "over-budget":   { cls: "badge-danger",  label: "Over Budget" },
  "overdue":       { cls: "badge-danger",  label: "Overdue" },
  "not-viable":    { cls: "badge-danger",  label: "Not Viable" }
};

export function badgeHTML(status) {
  const b = BADGE_MAP[status] || { cls: "badge-gray", label: status };
  return `<span class="badge ${b.cls}">${b.label}</span>`;
}

/* ── ROLE GUARD ───────────────────────────────────── */

export function can(action) {
  const role = window.FinanceDB?.session?.user?.role ?? "enduser";
  const perms = window.FinanceDB?.rolePermissions?.[role] ?? [];
  return perms.includes(action);
}
