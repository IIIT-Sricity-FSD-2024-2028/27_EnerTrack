/**
 * ToastProvider — the small pop-up messages in the bottom-right corner.
 * Replaces showToast() from the original utils.js. Any component below
 * this provider can show a toast with the useToast() hook.
 */
import { useCallback, useState } from "react";
import { ToastContext } from "./toastContext";

const COLORS = {
  success: { bg: "#166534", border: "#14532d", icon: "✓" },
  error: { bg: "#dc2626", border: "#b91c1c", icon: "✕" },
  warning: { bg: "#ea580c", border: "#c2410c", icon: "⚠" },
  info: { bg: "#1f2937", border: "#111827", icon: "ℹ" },
};

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // useCallback keeps the same function between renders, so pages can use
  // it inside useEffect without re-running the effect every render.
  const showToast = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fa-toast-container">
        {toasts.map((toast) => {
          const c = COLORS[toast.type] || COLORS.info;
          return (
            <div
              key={toast.id}
              className="fa-toast"
              style={{ background: c.bg, borderColor: c.border }}
            >
              <span className="fa-toast-icon">{c.icon}</span>
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
