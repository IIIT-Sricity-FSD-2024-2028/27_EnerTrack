/**
 * useToast — the pop-up messages for one page.
 *
 *   const { toasts, showToast } = useToast();
 *   showToast("Work order closed.", "success");   // or "error", "info", "warning"
 *   ...
 *   <ToastStack toasts={toasts} />
 *
 * Replaces showToast() from js/technician/utils/utils.js, which created the
 * toast <div>s by hand. Here the hook only keeps the list; ToastStack draws it.
 */
import { useCallback, useState } from "react";

const TOAST_DURATION_MS = 3000;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  // useCallback keeps the reference stable across renders so effects depending
  // on showToast do not re-run on every state update.
  const showToast = useCallback((message, type = "info") => {
    const id = Math.random();

    // Add the new toast to the end of the list.
    setToasts((current) => [...current, { id, message, type }]);

    // Remove this one toast again after a few seconds.
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  return { toasts, showToast };
}
