export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

export function formatLabel(value) {
  const labels = {
    systemAdministrator: "System Administrator",
    financeAnalyst: "Finance Analyst",
    sustainabilityOfficer: "Sustainability Officer",
    technicianAdministrator: "Technician Administrator",
    technician: "Technician",
    campusVisitor: "Campus Visitor",
    online: "Online",
    offline: "Offline",
    invited: "Invited",
    locked: "Locked",
    operational: "Operational",
    maintenance: "Maintenance",
    active: "Active",
    inactive: "Inactive",
    fault: "Fault",
    faulty: "Faulty",
    calibrating: "Calibrating",
    decommissioned: "Decommissioned",
    electricity: "Electricity",
    water: "Water",
    gas: "Gas",
    emissions: "Emissions",
    food: "Food",
    smartMeter: "Smart Meter",
  };

  return labels[value] || value;
}

export function badge(value, extraClass = "") {
  return `<span class="badge ${escapeHtml(value)} ${extraClass}">${escapeHtml(formatLabel(value))}</span>`;
}

export function showToast(message, type = "info", duration = 3000) {
  let stack = document.getElementById("toastStack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (stack && stack.childElementCount === 0) stack.remove();
  }, duration);
}

export function openModal({
  title,
  bodyHtml,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
}) {
  closeModal();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modalOverlay";
  overlay.innerHTML = `
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-header">
        <h2 id="modalTitle">${escapeHtml(title)}</h2>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-actions">
        <button class="btn-outline" type="button" data-modal-cancel>${escapeHtml(cancelLabel)}</button>
        <button class="btn-dark ${danger ? "btn-danger-fill" : ""}" type="button" data-modal-confirm>
          ${escapeHtml(confirmLabel)}
        </button>
      </div>
    </section>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("input, select, button")?.focus();

  const handleKeydown = (event) => {
    if (event.key === "Escape") closeModal();
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });
  overlay
    .querySelector("[data-modal-cancel]")
    ?.addEventListener("click", closeModal);
  overlay
    .querySelector("[data-modal-confirm]")
    ?.addEventListener("click", () => {
      const shouldClose = onConfirm ? onConfirm(overlay) : true;
      if (shouldClose !== false) closeModal();
    });

  document.addEventListener("keydown", handleKeydown, { once: true });
}

export function closeModal() {
  document.getElementById("modalOverlay")?.remove();
}

export function formValues(modal, selectors) {
  return Object.fromEntries(
    Object.entries(selectors).map(([key, selector]) => [
      key,
      modal.querySelector(selector)?.value?.trim() ?? "",
    ]),
  );
}

export function showFormErrors(modal, errors) {
  modal.querySelectorAll("[data-error-for]").forEach((el) => {
    el.textContent = errors[el.dataset.errorFor] || "";
  });
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
