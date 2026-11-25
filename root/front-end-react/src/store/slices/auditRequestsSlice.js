/**
 * auditRequestsSlice.js: /audit-requests (id: request_id). Owner: Person 2.
 * "Register your organisation" requests waiting for a Super Admin. (Filing
 * one is requestAudit in authSlice: the public sign-up, with no session.)
 *
 * CRUD comes from createCrudSlice; see its header (only fetchAll is used).
 * Kept newest first, as the server sends them. Extra:
 *   decideAuditRequest({ id, kind: "approve" | "deny", body })
 *     PATCH /audit-requests/:id/:kind. Approve answers
 *     { request, organization, admin }, deny answers the request; the request
 *     is upserted either way. Approving creates an organisation and its
 *     Organization Admin on the server, so the organisations and users lists
 *     are reloaded afterwards.
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";
import { fetchOrganizations } from "./organizationsSlice";
import { fetchUsers } from "./usersSlice";

export const decideAuditRequest = apiThunk(
  "auditRequests/decide",
  async ({ id, kind, body = {} }, { dispatch }) => {
    const result = await api.patch(`/audit-requests/${id}/${kind}`, body);
    if (kind === "approve") {
      dispatch(fetchOrganizations({ force: true }));
      dispatch(fetchUsers({ force: true }));
    }
    return result?.request ?? result;
  },
);

const auditRequests = createCrudSlice({
  name: "auditRequests",
  path: "/audit-requests",
  idKey: "request_id",
  sortComparer: (a, b) =>
    String(b.requested_at ?? "").localeCompare(String(a.requested_at ?? "")),
  extraReducers: (builder, { adapter, isRow }) => {
    builder.addCase(decideAuditRequest.fulfilled, (state, { payload }) => {
      if (isRow(payload)) adapter.upsertOne(state, payload);
    });
  },
});

export const { fetchAll: fetchAuditRequests } = auditRequests.thunks;

export const {
  selectAll: selectAllAuditRequests,
  selectStatus: selectAuditRequestsStatus,
  selectError: selectAuditRequestsError,
} = auditRequests.selectors;

/** Waiting requests, oldest first: they read better as a queue. */
export const selectPendingAuditRequests = createSelector(
  [selectAllAuditRequests],
  (rows) => rows.filter((r) => r.status === "pending").reverse(),
);

/** Approved or rejected, newest first. */
export const selectDecidedAuditRequests = createSelector(
  [selectAllAuditRequests],
  (rows) => rows.filter((r) => r.status !== "pending"),
);

export default auditRequests.reducer;
