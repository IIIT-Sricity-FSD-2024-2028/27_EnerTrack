/**
 * Modal — the pop-up dialog the original openModal() built by hand on the
 * Sustainability Officer pages.
 *
 * The parent decides when it is open (by rendering it or not) and what the
 * confirm button does:
 *   <Modal title="Dismiss Report" confirmLabel="Confirm" danger
 *          onConfirm={handleDismiss} onClose={() => setModal(null)}>
 *     ...form fields...
 *   </Modal>
 */
export default function Modal({
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  width = 520,
  onConfirm,
  onClose,
}) {
  // Clicking the dark background (but not the white card) closes the dialog.
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget && !busy) onClose();
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17, 24, 39, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9000,
        padding: "16px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          width: "100%",
          maxWidth: `${width}px`,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "22px 24px",
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.25)",
        }}
      >
        <h3 style={{ margin: "0 0 14px 0", fontSize: "17px", fontWeight: 700, color: "#111827" }}>{title}</h3>
        <div>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#374151",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              background: danger ? "#dc2626" : "#111827",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
