/**
 * utils.js
 * Shared helpers for the Account Officer dashboard.
 *
 * Mirrors js/auditor/utils/utils.js, which is the per-role convention this
 * codebase already follows. The only real difference is requireAccountOfficer,
 * since the two roles guard on different allowlists.
 */

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch (_) {
    return null;
  }
}

/**
 * Convenience gate only. Every rule behind these pages is enforced by the
 * backend's RolesGuard, which does not trust anything the browser claims.
 */
export function requireAccountOfficer() {
  const user = currentUser();
  const allowed = ["Account Officer", "Super Admin"];
  if (!user || !allowed.includes(user.role)) {
    window.location.href = "../sign_in/sign_in.html";
    return null;
  }
  return user;
}

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

export function formatPeriod(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return escapeHtml(period ?? "—");
  const [year, month] = period.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]} ${year}`;
}

export function label(value) {
  return String(value ?? "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Reuses the badge classes tech_shared.css already defines. */
export function badge(status) {
  const map = {
    draft: "new",
    issued: "inprogress",
    paid: "resolved",
    overdue: "critical",
    trial: "new",
    active: "resolved",
    "past-due": "critical",
    cancelled: "low",
    prospect: "new",
    audited: "review",
    churned: "critical",
    "auditor-signed": "review",
    "client-accepted": "resolved",
    disputed: "critical",
  };
  return `<span class="badge ${map[status] ?? "open"}">${escapeHtml(label(status))}</span>`;
}

/** Days until a date, negative when it has passed. */
export function daysUntil(dateString) {
  if (!dateString) return null;
  const then = new Date(dateString);
  if (Number.isNaN(then.getTime())) return null;
  return Math.round((then - new Date()) / 86400000);
}

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
  const bg = { success: "#10b981", error: "#ef4444", warning: "#f59e0b" }[type] ?? "#3b82f6";
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

export function emptyRow(colspan, message) {
  return `<tr><td colspan="${colspan}" style="text-align:center;color:var(--muted);padding:28px 0;">${escapeHtml(message)}</td></tr>`;
}

/**
 * No mock-data fallback on purpose: silently serving stale fixtures when the
 * backend is unreachable is how three existing pages ended up showing figures
 * the server had never heard of.
 */
export async function loadOrFail(fn, what) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[account-officer] failed to load ${what}:`, err);
    showToast(`Could not load ${what}: ${err.message}`, "error", 6000);
    return null;
  }
}
