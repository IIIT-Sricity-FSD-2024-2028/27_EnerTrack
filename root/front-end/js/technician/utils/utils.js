/**
 * utils.js
 * Shared helpers for the Technician dashboard.
 */

export function showToast(message, type = "info", duration = 3000) {
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
  const bg =
    type === "success"
      ? "#10b981"
      : type === "error"
        ? "#ef4444"
        : type === "warning"
          ? "#f59e0b"
          : "#3b82f6";
  Object.assign(toast.style, {
    background: bg,
    color: "#fff",
    padding: "12px 20px",
    borderRadius: "6px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
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

export function openModal({
  title,
  bodyHTML,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  danger = false,
}) {
  let overlay = document.getElementById("et-modal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "et-modal";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "10000",
      opacity: "0",
      transition: "opacity 0.2s",
    });
    document.body.appendChild(overlay);
  }

  const bgBtn = danger ? "#ef4444" : "#111827";

  overlay.innerHTML = `
    <div style="background:#fff; border-radius:10px; width:440px; max-width:90%; box-shadow:0 10px 25px rgba(0,0,0,0.15); font-family:system-ui,sans-serif;">
      <div style="padding:16px 20px; border-bottom:1px solid #e5e7eb; font-weight:600; font-size:16px;">${title}</div>
      <div style="padding:20px; font-size:14px; color:#4b5563;">${bodyHTML}</div>
      <div style="padding:16px 20px; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; gap:10px;">
        ${cancelLabel ? `<button id="btn-modal-cancel" style="padding:8px 16px; border:1px solid #d1d5db; background:#fff; border-radius:6px; cursor:pointer; font-size:13px;">${cancelLabel}</button>` : ""}
        ${confirmLabel ? `<button id="btn-modal-confirm" style="padding:8px 16px; border:none; background:${bgBtn}; color:#fff; border-radius:6px; cursor:pointer; font-size:13px;">${confirmLabel}</button>` : ""}
      </div>
    </div>
  `;

  overlay.style.display = "flex";
  setTimeout(() => (overlay.style.opacity = "1"), 10);

  const close = () => {
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.style.display = "none";
      overlay.innerHTML = "";
    }, 200);
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.getElementById("btn-modal-cancel")?.addEventListener("click", close);
  const confirmBtn = document.getElementById("btn-modal-confirm");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      if (onConfirm) onConfirm();
      close();
    });
  }

  return { close };
}

export function generateId(prefix = "ID") {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}
