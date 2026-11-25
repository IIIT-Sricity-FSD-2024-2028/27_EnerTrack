/**
 * platformInvoicesSlice.js: /platform-invoices (id: platform_invoice_id).
 * Owner: Person 2. What clients pay EnerTrack (not the utility invoices in
 * invoicesSlice).
 *
 * CRUD comes from createCrudSlice; see its header (only fetchAll is used).
 * Rows are kept newest period first, as the server sends them. Extra:
 *   fetchRevenueSummary()  GET /platform-invoices/revenue-summary (Super
 *                          Admin): the platform's totals, stored in
 *                          state.platformInvoices.revenueSummary with
 *                          revenueStatus. It is computed from live contracts
 *                          and staff counts, so it reloads on every call
 *                          (an older summary stays shown while it does);
 *                          a call made while one is running is skipped.
 */
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

export const fetchRevenueSummary = apiThunk(
  "platformInvoices/fetchRevenueSummary",
  () => api.get("/platform-invoices/revenue-summary"),
  {
    // Always reloads, except while a load is already running.
    condition: (arg, { getState }) => {
      const { revenueStatus, revenueRefreshing } = getState().platformInvoices;
      return !(revenueStatus === "loading" || revenueRefreshing);
    },
  },
);

const platformInvoices = createCrudSlice({
  name: "platformInvoices",
  path: "/platform-invoices",
  idKey: "platform_invoice_id",
  sortComparer: (a, b) =>
    String(b.period ?? "").localeCompare(String(a.period ?? "")),
  initialState: {
    revenueSummary: null,
    revenueStatus: "idle",
    revenueRefreshing: false,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRevenueSummary.pending, (state) => {
        if (state.revenueStatus === "succeeded") state.revenueRefreshing = true;
        else state.revenueStatus = "loading";
      })
      .addCase(fetchRevenueSummary.fulfilled, (state, { payload }) => {
        state.revenueSummary = payload ?? null;
        state.revenueStatus = "succeeded";
        state.revenueRefreshing = false;
      })
      .addCase(fetchRevenueSummary.rejected, (state, { meta }) => {
        if (meta.condition) return; // skipped, not failed
        state.revenueRefreshing = false;
        if (state.revenueStatus !== "succeeded") state.revenueStatus = "failed";
      });
  },
});

export const { fetchAll: fetchPlatformInvoices } = platformInvoices.thunks;

export const {
  selectAll: selectAllPlatformInvoices,
  selectStatus: selectPlatformInvoicesStatus,
  selectError: selectPlatformInvoicesError,
} = platformInvoices.selectors;

export const selectRevenueSummary = (state) =>
  state.platformInvoices.revenueSummary;
export const selectRevenueStatus = (state) =>
  state.platformInvoices.revenueStatus;

export default platformInvoices.reducer;
