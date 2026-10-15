/**
 * Modal — the popup every admin page uses (Add User, Delete, Act as, ...).
 *
 * It only displays and reports back. The page that opens it decides what the
 * Confirm button does and when the popup goes away (by no longer rendering
 * it). Whatever the page puts between <Modal> and </Modal> arrives as the
 * `children` prop and is shown as the body.
 *
 * Props:
 *   title         heading of the popup
 *   confirmLabel  text of the dark button (default "Save")
 *   cancelLabel   text of the outline button (default "Cancel")
 *   danger        true -> the confirm button is red (deleting, declining)
 *   confirmDisabled  true -> the confirm button is greyed out and inert
 *   hideConfirm      true -> only the cancel button shows (for result popups)
 *   wide          true -> a wider card, for popups that hold a table
 *   onConfirm     called by the confirm button
 *   onClose       called by Cancel, the Escape key, or a click on the
 *                 dark background
 *
 * Replaces openModal() in js/system_admin/utils/ui.js.
 */
import { useEffect } from "react";

export default function Modal({
  title,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  danger = false,
  confirmDisabled = false,
  hideConfirm = false,
  wide = false,
  onConfirm,
  onClose,
  children,
}) {
  // While the popup is open, the Escape key closes it. The cleanup function
  // removes the listener again when the popup closes.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    // The dark background. A click on it (but not on the white card) closes.
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card"
        style={wide ? { width: "min(900px, 100%)" } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalTitle"
      >
        <div className="modal-header">
          <h2 id="modalTitle">{title}</h2>
        </div>

        <div className="modal-body">{children}</div>

        <div className="modal-actions">
          <button className="btn-outline" type="button" onClick={onClose}>
            {cancelLabel}
          </button>
          {!hideConfirm && (
            <button
              className={danger ? "btn-dark btn-danger-fill" : "btn-dark"}
              type="button"
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
