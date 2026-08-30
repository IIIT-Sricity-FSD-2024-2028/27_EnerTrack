/**
 * utils.js
 * Shared helpers for the Certified Energy Auditor dashboard.
 *
 * Per-role utils modules are the convention in this codebase (technician,
 * finance-analyst, sustainability_officer and system_admin each have one),
 * so this follows suit rather than reaching across role folders.
 */

/* ─── Session ───────────────────────────────────────────────────── */

/** The signed-in user, or null. */
export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch (_) {
    return null;
  }
}

/**
 * Bounces anyone who is not EnerTrack audit staff back to sign-in.
 *
 * Convenience only. Every rule behind these pages is enforced by the
 * backend's RolesGuard, which does not trust anything the browser says —
 * this just avoids rendering a dashboard whose every request would 403.
 */
export function requireAuditor() {
  const user = currentUser();
  const allowed = ["Certified Energy Auditor", "Super Admin"];
  if (!user || !allowed.includes(user.role)) {
    window.location.href = "../sign_in/sign_in.html";
    return null;
  }
  return user;
}

/* ─── Formatting ────────────────────────────────────────────────── */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(Math.round(Number(value || 0)));
}

export function formatKwh(value) {
  return `${formatNumber(value)} kWh`;
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2026-07" → "Jul 2026". */
export function formatPeriod(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return escapeHtml(period ?? "—");
  const [year, month] = period.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]} ${year}`;
}

/** Turns a hyphenated enum value into a readable label. */
export function label(value) {
  return String(value ?? "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Maps a domain status onto one of the badge classes tech_shared.css
 * already defines, so the palette stays consistent with every other
 * dashboard rather than inventing a second one.
 */
export function badge(status) {
  const map = {
    scheduled: "new",
    "in-progress": "inprogress",
    completed: "resolved",
    proposed: "new",
    accepted: "inprogress",
    implemented: "resolved",
    rejected: "critical",
    high: "critical",
    moderate: "moderate",
    low: "low",
  };
  const cls = map[status] ?? "open";
  return `<span class="badge ${cls}">${escapeHtml(label(status))}</span>`;
}

/* ─── Feedback ──────────────────────────────────────────────────── */

export function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("et-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "et-toast-container";
    Object.assign(container.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      zIndex: "9999",
    });
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const bg = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
  }[type] ?? "#3b82f6";

  Object.assign(toast.style, {
    background: bg,
    color: "#fff",
    padding: "12px 20px",
    borderRadius: "6px",
    fontSize: "14px",
    maxWidth: "420px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
    opacity: "0",
    transform: "translateY(10px)",
    transition: "all 0.3s ease",
  });
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** Simple confirm/cancel modal. Resolves to the form values, or null. */
export function openModal({ title, bodyHTML, confirmLabel = "Save", onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "aud-modal-overlay";
  overlay.innerHTML = `
    <div class="aud-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <h3>${escapeHtml(title)}</h3>
      <div class="aud-modal-body">${bodyHTML}</div>
      <div class="aud-modal-actions">
        <button type="button" class="btn btn-light" data-modal-cancel>Cancel</button>
        <button type="button" class="btn btn-dark" data-modal-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("[data-modal-cancel]").onclick = close;
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
  overlay.querySelector("[data-modal-confirm]").onclick = async () => {
    const ok = await onConfirm(overlay);
    // A falsy result means the handler rejected the input and has already
    // shown why, so the modal stays open with the user's values intact.
    if (ok !== false) close();
  };

  return overlay;
}

/** Reads named inputs out of a modal into a plain object. */
export function formValues(overlay) {
  const values = {};
  overlay.querySelectorAll("[name]").forEach((input) => {
    values[input.name] =
      input.type === "number" ? Number(input.value) : input.value.trim();
  });
  return values;
}

/** Renders an empty-state row spanning a table. */
export function emptyRow(colspan, message) {
  return `<tr><td colspan="${colspan}" style="text-align:center;color:var(--muted);padding:28px 0;">${escapeHtml(message)}</td></tr>`;
}

/* ─── Data loading ──────────────────────────────────────────────── */

/**
 * Wraps an api call so a failure renders a message instead of a blank page.
 *
 * There is deliberately no mock-data fallback here. Silently serving stale
 * fixtures when the backend is unreachable is how three existing pages ended
 * up showing figures the server had never heard of.
 */
export async function loadOrFail(fn, what) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[auditor] failed to load ${what}:`, err);
    showToast(`Could not load ${what}: ${err.message}`, "error", 6000);
    return null;
  }
}
