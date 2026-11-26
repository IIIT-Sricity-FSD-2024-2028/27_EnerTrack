/**
 * Toaster: draws every toast in the app, bottom-right, newest last.
 * Mounted once in main.jsx. Errors are announced at once to screen readers,
 * the rest politely; each one can be dismissed.
 */
import { useDispatch, useSelector } from "react-redux";
import { selectToasts, toastDismissed } from "../store/slices/uiSlice";
import "./Toaster.css";

const ICONS = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };

export default function Toaster() {
  const dispatch = useDispatch();
  const toasts = useSelector(selectToasts);
  if (toasts.length === 0) return null;

  return (
    <div className="app-toasts">
      {toasts.map((t) => {
        const type = ICONS[t.type] ? t.type : "info";
        return (
          <div
            key={t.id}
            className={`app-toast app-toast--${type}`}
            role={type === "error" ? "alert" : "status"}
            aria-live={type === "error" ? "assertive" : "polite"}
          >
            <span className="app-toast__icon" aria-hidden="true">
              {ICONS[type]}
            </span>
            <span className="app-toast__text">{t.message}</span>
            <button
              type="button"
              className="app-toast__close"
              aria-label="Dismiss"
              onClick={() => dispatch(toastDismissed(t.id))}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
