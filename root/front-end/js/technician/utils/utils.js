/**
 * utils.js
 * Shared helpers for the Technician dashboard.
 */

export function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("et-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "et-toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

export function openModal({
  title,
  bodyHTML,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  danger = false,
}) {
  document.getElementById("et-modal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "et-modal";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>${title}</h3>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-actions">
        ${cancelLabel ? `<button id="btn-modal-cancel" class="btn btn-light">${cancelLabel}</button>` : ""}
        ${confirmLabel ? `<button id="btn-modal-confirm" class="btn ${danger ? "btn-red" : "btn-dark"}">${confirmLabel}</button>` : ""}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document
    .getElementById("btn-modal-cancel")
    ?.addEventListener("click", close);
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
