import { useEffect } from "react";

/**
 * A short confirmation at the bottom of the screen. It dismisses itself after
 * a few seconds (errors stay a little longer), never covers more than the
 * bottom edge, and fits narrow screens.
 */
export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast || !onClose) return undefined;
    const timer = setTimeout(onClose, toast.type === "error" ? 7000 : 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const bgColors = {
    success: "#14532d",
    error: "#991b1b",
    warning: "#92400e",
    info: "#1f2937",
  };

  const bg = bgColors[toast.type] || bgColors.success;

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        left: "auto",
        maxWidth: "min(420px, calc(100vw - 32px))",
        background: bg,
        color: "#ffffff",
        padding: "10px 14px",
        borderRadius: "8px",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.18)",
        zIndex: 9999,
        fontWeight: "500",
        fontSize: "14px",
        lineHeight: 1.4,
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span style={{ flex: 1 }}>{toast.msg}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: "#ffffff",
            cursor: "pointer",
            padding: "4px",
            display: "inline-flex",
            alignItems: "center",
            opacity: 0.8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
