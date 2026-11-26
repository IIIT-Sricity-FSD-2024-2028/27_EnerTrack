import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

/** Generate an unsaved report preview for the selected period. */
export const generateSustainabilityReport = apiThunk(
  "sustainabilityReports/generate",
  (params) => api.post("/sustainability-reports/generate", params),
);

export const submitSustainabilityReport = apiThunk("sustainabilityReports/submit", (id) =>
  api.patch(`/sustainability-reports/${id}/status`, { status: "submitted" }),
);

/**
 * The Organization Admin's decision on a report: approve, send back to draft,
 * or publish. PATCH /sustainability-reports/:id/status answers with the report.
 */
export const decideSustainabilityReport = apiThunk(
  "sustainabilityReports/decide",
  ({ id, status, note }) =>
    api.patch(`/sustainability-reports/${id}/status`, { status, ...(note ? { note } : {}) }),
);

/** Create a corrected draft and link it to the original report. */
export const restateSustainabilityReport = apiThunk("sustainabilityReports/restate", (id) =>
  api.post(`/sustainability-reports/${id}/restate`),
);

/** Refresh report links when a deleted draft was a restatement. */
export const removeSustainabilityReport = apiThunk(
  "sustainabilityReports/removeReport",
  async (id, { dispatch, getState }) => {
    const originalId = selectSustainabilityReportById(getState(), id)?.supersedes;
    await dispatch(reports.thunks.remove(id)).unwrap();
    if (originalId) await dispatch(reports.thunks.fetchOne(originalId));
  },
);

const reports = createCrudSlice({
  name: "sustainabilityReports",
  path: "/sustainability-reports",
  idKey: "report_id",
  sortComparer: (a, b) => String(b.generated_at).localeCompare(String(a.generated_at)),
  initialState: { draft: null, draftRequestId: null },
  reducers: {
    draftCleared(state) {
      state.draft = null;
      state.draftRequestId = null;
    },
  },
  extraReducers: (builder, { adapter, isRow }) => {
    builder
      .addCase(generateSustainabilityReport.pending, (state, { meta }) => {
        state.draftRequestId = meta.requestId;
      })
      .addCase(generateSustainabilityReport.fulfilled, (state, { payload, meta }) => {
        // Ignore previews that arrived after a period change or navigation.
        if (state.draftRequestId !== meta.requestId) return;
        state.draft = payload;
        state.draftRequestId = null;
      })
      .addCase(generateSustainabilityReport.rejected, (state, { meta }) => {
        if (state.draftRequestId === meta.requestId) state.draftRequestId = null;
      })
      .addCase(submitSustainabilityReport.fulfilled, (state, { payload }) => {
        if (isRow(payload)) adapter.upsertOne(state, payload);
      })
      .addCase(decideSustainabilityReport.fulfilled, (state, { payload }) => {
        if (isRow(payload)) adapter.upsertOne(state, payload);
      })
      .addCase(restateSustainabilityReport.fulfilled, (state, { payload, meta }) => {
        if (!isRow(payload)) return;
        adapter.upsertOne(state, payload);
        adapter.updateOne(state, {
          id: meta.arg,
          changes: { superseded_by: payload.report_id },
        });
      });
  },
});

export const { draftCleared } = reports.actions;
export const {
  fetchAll: fetchSustainabilityReports,
  create: createSustainabilityReport,
} = reports.thunks;
export const {
  selectAll: selectAllSustainabilityReports,
  selectById: selectSustainabilityReportById,
  selectStatus: selectSustainabilityReportsStatus,
} = reports.selectors;
export const selectSustainabilityReportDraft = (state) => state.sustainabilityReports.draft;
export default reports.reducer;
