/**
 * Modal — a confirm popup for the technician pages.
 *
 * The page decides whether it is open:
 *
 *   {confirmOpen && (
 *     <Modal
 *       title="Resolve Alert"
 *       confirmLabel="Resolve"
 *       onConfirm={handleConfirm}
 *       onCancel={() => setConfirmOpen(false)}
 *     >
 *       <p>Are you sure?</p>
 *     </Modal>
 *   )}
 *
 * Replaces openModal() from js/technician/utils/utils.js, which built the
 * popup out of an HTML string. Styles (.modal-overlay, .modal-card, ...) are
 * in tech_shared.css.
 */
export default function Modal({
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  // Clicking the dark background closes the popup, but clicking inside the
  // white card must not — so only react when the click target IS the overlay.
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }

  let confirmClass = "btn btn-dark";
  if (danger) {
    confirmClass = "btn btn-red";
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-card">
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button type="button" className="btn btn-light" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
