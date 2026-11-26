/**
 * useToast: the one way a component shows a pop-up message.
 *
 *   const showToast = useToast();
 *   showToast("Saved.", "success");     // success | error | warning | info
 *
 * The function is stable across renders, so it is safe in effect
 * dependencies and as a prop. The messages live in the ui slice and
 * <Toaster /> (mounted once in main.jsx) draws them.
 */
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { showToast } from "../store/slices/uiSlice";

export function useToast() {
  const dispatch = useDispatch();
  return useCallback(
    (message, type = "info", duration) => dispatch(showToast(message, type, duration)),
    [dispatch],
  );
}
