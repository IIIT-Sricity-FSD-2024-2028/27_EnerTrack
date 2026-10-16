export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const bgColors = {
    success: "#065f46",
    error: "#b91c1c",
    warning: "#b45309",
    info: "#1d4ed8",
  };

  const bg = bgColors[toast.type] || bgColors.success;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        background: bg,
        color: "#ffffff",
        padding: "12px 20px",
        borderRadius: "8px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        zIndex: 9999,
        fontWeight: "500",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        maxWidth: "420px",
        animation: "slide-up 0.2s ease-out",
      }}
    >
      <span style={{ flex: 1 }}>{toast.msg}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          style={{
            background: "transparent",
            border: "none",
            color: "#ffffff",
            cursor: "pointer",
            padding: "2px",
            display: "inline-flex",
            alignItems: "center",
            opacity: 0.8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
