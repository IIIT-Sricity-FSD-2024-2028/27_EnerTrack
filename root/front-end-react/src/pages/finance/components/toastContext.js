/**
 * toastContext.js — the context object and the useToast() hook.
 * Kept apart from ToastProvider.jsx so that file exports only a component
 * (Vite's Fast Refresh needs that).
 */
import { createContext, useContext } from "react";

export const ToastContext = createContext(() => {});

/** const showToast = useToast(); showToast("Saved.", "success"); */
export function useToast() {
  return useContext(ToastContext);
}
