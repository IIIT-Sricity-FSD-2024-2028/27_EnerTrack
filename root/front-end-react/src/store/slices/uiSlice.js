/**
 * uiSlice.js: app-wide UI state that is not server data.
 *
 * backend: whether the API can be reached. api/backendStatus.js dispatches
 *   into this on every request (offline when a request cannot connect, online
 *   again on any HTTP answer). ui/BackendStatusBanner.jsx shows it.
 *
 * toasts: the short pop-up messages, one list for the whole app. Pages call
 *   showToast through the useToast() hook (src/ui/useToast.js);
 *   ui/Toaster.jsx, mounted once in main.jsx, draws them. They survive
 *   resetData, so "Signed out." still shows after a sign-out.
 */
import { createSlice } from "@reduxjs/toolkit";

const TOAST_MS = { error: 6000, default: 4000 };
const TOAST_LIMIT = 4; // the oldest goes first when more pile up
let nextToastId = 1;

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    backend: { offline: false, recovered: false },
    toasts: [],
  },
  reducers: {
    backendOffline(state) {
      state.backend = { offline: true, recovered: false };
    },
    backendOnline(state) {
      // Only worth announcing if we had been offline.
      if (state.backend.offline)
        state.backend = { offline: false, recovered: true };
    },
    backendRecoveredDismissed(state) {
      state.backend = { offline: false, recovered: false };
    },
    toastShown(state, { payload }) {
      state.toasts.push(payload);
      if (state.toasts.length > TOAST_LIMIT) state.toasts.shift();
    },
    toastDismissed(state, { payload: id }) {
      state.toasts = state.toasts.filter((t) => t.id !== id);
    },
  },
});

export const {
  backendOffline,
  backendOnline,
  backendRecoveredDismissed,
  toastShown,
  toastDismissed,
} = uiSlice.actions;

/**
 * dispatch(showToast("Saved.", "success"))  type: success | error | warning | info
 * It goes away by itself (errors stay a little longer), or when dismissed.
 */
export function showToast(message, type = "info", duration) {
  return (dispatch) => {
    const id = nextToastId++;
    dispatch(toastShown({ id, message: String(message ?? ""), type }));
    const ms = duration ?? (type === "error" ? TOAST_MS.error : TOAST_MS.default);
    setTimeout(() => dispatch(toastDismissed(id)), ms);
    return id;
  };
}

export const selectBackendStatus = (state) => state.ui.backend;
export const selectToasts = (state) => state.ui.toasts;

export default uiSlice.reducer;
