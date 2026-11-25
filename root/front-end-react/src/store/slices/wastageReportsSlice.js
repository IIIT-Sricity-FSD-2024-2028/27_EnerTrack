/**
 * wastageReportsSlice.js: /wastage-reports (id: wastage_report_id). Owner: Person 5.
 *
 * CRUD from createCrudSlice (see its header):
 *   fetchWastageReports(arg?)      GET    /wastage-reports
 *   fetchWastageReport(id)         GET    /wastage-reports/:id
 *   createWastageReport(body)      POST   /wastage-reports
 *   removeWastageReport(id)        DELETE /wastage-reports/:id
 *
 * Custom thunks:
 *   updateWastageReport({ report, changes })
 *                                  PATCH  /wastage-reports/:id (merges `details`)
 *   addWastageComment({ id, author, role, text })
 *                                  POST   /wastage-reports/:id/comments
 *   archiveWastageReport(id)       PATCH  /wastage-reports/:id/archive
 *   uploadWastagePhotos({ id, files })
 *                                  POST   /wastage-reports/:id/photos (multipart)
 *   raiseWorkOrderFromWastage(id)  POST   /wastage-reports/:id/work-order (also reloads workOrders)
 *   fetchWastagePhotoUrl(path)     GET    blob URL via api.getBlobUrl (not stored in Redux)
 *
 * Selectors:
 *   selectAllWastageReports, selectWastageReportById,
 *   selectWastageReportsStatus, selectWastageReportsError
 *   selectWastageRows              normalized rows (via normalizeWastageReport)
 *   selectMyWastageReports         reports filed by the signed-in user
 *   selectWastageAuditQueue        active cases for Sustainability Officer (!soArchived, not Closed/Dismissed)
 *   selectWastageReviewQueue       cases waiting on Finance (Forwarded to Finance | Cost Impact Added)
 *   selectArchivedWastageReports   finished/archived cases (Closed | Dismissed | soArchived)
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";
import { selectCurrentUser } from "./authSlice";
import { fetchWorkOrders } from "./workOrdersSlice";

const AUDIT_FINISHED = ["Dismissed", "Closed"];
const FINANCE_ACTIONABLE = ["Forwarded to Finance", "Cost Impact Added"];

export function normalizeWastageReport(r, user) {
  const d = r.details || {};
  const isMine = user && r.reporter_id === user.user_id;
  return {
    id: r.wastage_report_id || r.id,
    type: r.type,
    status: r.status,
    reporterId: r.reporter_id,
    reporterName: isMine ? user.name : r.reporterName || "Unknown",
    specificData: d.specificData || r.specificData || {},
    systemData: d.systemData || r.systemData || {},
    costImpact: d.costImpact || r.costImpact || null,
    metricTarget: d.metricTarget || r.metricTarget || null,
    priority: d.priority || r.priority || "Low",
    comments: d.comments || r.comments || [],
    // The backend keeps the time it was reported inside details.
    timestamp: r.created_at || r.timestamp || d.timestamp || new Date().toISOString(),
    validatedAt: d.validatedAt || r.validatedAt,
    revisionRequest: d.revisionRequest || r.revisionRequest,
    returnedAt: d.returnedAt || r.returnedAt,
    // The waste reports a case grew out of.
    sourceRequestIds: r.source_request_ids || [],
    details: d,
  };
}

export const updateWastageReport = apiThunk(
  "wastageReports/updateWastageReport",
  async ({ report, changes }) => {
    const id = report.id || report.wastage_report_id;
    const { status, ...detailChanges } = changes;
    // The backend replaces `details` with what we send, so send all of it.
    const details = { ...(report.details || {}), ...detailChanges };
    return api.patch(`/wastage-reports/${id}`, {
      status: status || report.status,
      details,
    });
  },
);

export const addWastageComment = apiThunk(
  "wastageReports/addComment",
  ({ id, author, role, text }) =>
    api.post(`/wastage-reports/${id}/comments`, {
      author,
      ...(role ? { role } : {}),
      text,
    }),
);

export const archiveWastageReport = apiThunk("wastageReports/archive", (id) =>
  api.patch(`/wastage-reports/${id}/archive`, {}),
);

export const uploadWastagePhotos = apiThunk(
  "wastageReports/uploadPhotos",
  ({ id, files }) => api.upload(`/wastage-reports/${id}/photos`, "files", files),
);

export const raiseWorkOrderFromWastage = apiThunk(
  "wastageReports/raiseWorkOrder",
  async (id, { dispatch }) => {
    const result = await api.post(`/wastage-reports/${id}/work-order`, {});
    await dispatch(fetchWorkOrders({ force: true }));
    return result;
  },
);

export const fetchWastagePhotoUrl = apiThunk(
  "wastageReports/fetchPhotoUrl",
  (path) => api.getBlobUrl(path),
);

const wastageReports = createCrudSlice({
  name: "wastageReports",
  path: "/wastage-reports",
  idKey: "wastage_report_id",
  extraReducers: (builder, { adapter, isRow }) => {
    const upsertIfRow = (state, { payload }) => {
      if (isRow(payload)) adapter.upsertOne(state, payload);
    };
    builder
      .addCase(updateWastageReport.fulfilled, upsertIfRow)
      .addCase(addWastageComment.fulfilled, upsertIfRow)
      .addCase(archiveWastageReport.fulfilled, upsertIfRow)
      .addCase(uploadWastagePhotos.fulfilled, upsertIfRow)
      .addCase(raiseWorkOrderFromWastage.fulfilled, upsertIfRow);
  },
});

export const {
  fetchAll: fetchWastageReports,
  fetchOne: fetchWastageReport,
  create: createWastageReport,
  remove: removeWastageReport,
} = wastageReports.thunks;

export const {
  selectAll: selectAllWastageReports,
  selectById: selectWastageReportById,
  selectStatus: selectWastageReportsStatus,
  selectError: selectWastageReportsError,
} = wastageReports.selectors;

export const selectWastageRows = createSelector(
  [selectAllWastageReports, selectCurrentUser],
  (rows, user) => rows.map((r) => normalizeWastageReport(r, user)),
);

export const selectMyWastageReports = createSelector(
  [selectWastageRows, selectCurrentUser],
  (rows, user) =>
    user ? rows.filter((r) => r.reporterId === user.user_id) : [],
);

export const selectWastageAuditQueue = createSelector(
  [selectWastageRows],
  (rows) =>
    rows
      .filter((r) => !r.details?.soArchived && !AUDIT_FINISHED.includes(r.status))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
);

export const selectWastageReviewQueue = createSelector(
  [selectWastageRows],
  (rows) =>
    rows
      .filter((r) => FINANCE_ACTIONABLE.includes(r.status))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
);

export const selectArchivedWastageReports = createSelector(
  [selectWastageRows],
  (rows) =>
    rows
      .filter(
        (r) =>
          r.status === "Closed" ||
          r.status === "Dismissed" ||
          r.details?.soArchived,
      )
      .sort((x, y) => {
        const at = (r) =>
          r.details?.closedAt ||
          r.details?.deliveredAt ||
          r.details?.dismissedAt ||
          r.details?.soArchivedAt ||
          r.timestamp;
        return String(at(y)).localeCompare(String(at(x)));
      }),
);

export default wastageReports.reducer;
