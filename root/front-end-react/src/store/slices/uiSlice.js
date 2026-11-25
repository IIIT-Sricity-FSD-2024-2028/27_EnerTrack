/**
 * uiSlice.js: app-wide UI state that is not server data.
 *
 * backend: whether the API can be reached. api/backendStatus.js dispatches
 *   into this on every request (offline when a request cannot connect, online
 *   again on any HTTP answer). ui/BackendStatusBanner.jsx shows it.
 */
import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    backend: { offline: false, recovered: false },
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
  },
});

export const { backendOffline, backendOnline, backendRecoveredDismissed } =
  uiSlice.actions;

export const selectBackendStatus = (state) => state.ui.backend;

export default uiSlice.reducer;
