/**
 * ToastStack — draws the toasts kept by useToast(), bottom-right of the
 * screen. Styles (.toast-container, .toast--success, ...) are in
 * tech_shared.css.
 */
export default function ToastStack({ toasts }) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={"toast toast--" + toast.type}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
