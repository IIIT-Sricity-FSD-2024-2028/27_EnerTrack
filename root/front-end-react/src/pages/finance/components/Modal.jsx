/**
 * Modal — the same pop-up dialog the original openModal() built by hand.
 *
 * The parent decides when it is open (by rendering it or not) and what the
 * buttons do:
 *   <Modal title="Delete Report" confirmLabel="Delete" danger
 *          onConfirm={handleDelete} onClose={() => setModal(null)}>
 *     <p>Are you sure?</p>
 *   </Modal>
 * Pass cancelLabel="" to hide the Cancel button (used by the "View" dialogs).
 * Pass `wide` for content that needs room, like the PDF viewer.
 */
export default function Modal({
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  wide = false,
  onConfirm,
  onClose,
}) {
  // Clicking the dark background (but not the white card) closes the dialog.
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="fa-modal-overlay" onClick={handleOverlayClick}>
      <div className={wide ? "fa-modal wide" : "fa-modal"} role="dialog" aria-modal="true">
        <h3 className="fa-modal-title">{title}</h3>
        <div className="fa-modal-body">{children}</div>
        <div className="fa-modal-actions">
          {cancelLabel && (
            <button type="button" className="fa-modal-cancel" onClick={onClose}>
              {cancelLabel}
            </button>
          )}
          {confirmLabel && (
            <button
              type="button"
              className={danger ? "fa-modal-confirm danger" : "fa-modal-confirm"}
              onClick={onConfirm || onClose}
              disabled={busy}
            >
              {busy ? "Saving…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
