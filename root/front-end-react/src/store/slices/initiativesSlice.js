import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

/** Archive a finished initiative and use the server's archive timestamp. */
export const archiveInitiative = apiThunk("initiatives/archive", (id) =>
  api.patch(`/initiatives/${id}/archive`),
);

/** Request coordinator review of a completed on-site job. */
export const requestInitiativeRework = apiThunk(
  "initiatives/requestRework",
  ({ id, workOrderId, reason }) =>
    api.post(`/initiatives/${id}/jobs/${workOrderId}/rework-request`, { reason }),
);

const initiatives = createCrudSlice({
  name: "initiatives",
  path: "/initiatives",
  idKey: "initiative_id",
  sortComparer: (a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  extraReducers: (builder, { adapter, isRow }) => {
    builder.addCase(archiveInitiative.fulfilled, (state, { payload }) => {
      if (isRow(payload)) adapter.upsertOne(state, payload);
    });
    builder.addCase(requestInitiativeRework.fulfilled, (state, { payload }) => {
      if (isRow(payload)) adapter.upsertOne(state, payload);
    });
  },
});

export const {
  fetchAll: fetchInitiatives,
  create: createInitiative,
  update: updateInitiative,
  remove: removeInitiative,
} = initiatives.thunks;

export const {
  selectAll: selectAllInitiatives,
  selectStatus: selectInitiativesStatus,
  selectError: selectInitiativesError,
} = initiatives.selectors;

/** Normalize older status values for display while keeping backend rows intact. */
export const selectBoardInitiatives = createSelector([selectAllInitiatives], (rows) =>
  rows.filter((row) => !row.archived_at).map((row) => ({
    ...row,
    status: (row.status || "proposed").toLowerCase().replace(/_/g, "-"),
  })),
);

export const selectActiveInitiatives = createSelector([selectBoardInitiatives], (rows) =>
  rows.filter(({ status }) => status !== "completed" && status !== "rejected"),
);

/** The archive includes rejected records once explicitly archived. */
export const selectCompletedInitiatives = createSelector([selectAllInitiatives], (rows) =>
  rows.filter((row) => row.archived_at).sort((a, b) => String(b.archived_at).localeCompare(String(a.archived_at))),
);

/** Group board rows once, including older approved rows in In Progress. */
const selectBoardColumns = createSelector([selectBoardInitiatives], (rows) => {
  const columns = Object.create(null);
  for (const initiative of rows) {
    const status = initiative.status === "approved" ? "in-progress" : initiative.status;
    (columns[status] ??= []).push(initiative);
  }
  return columns;
});
const EMPTY_COLUMN = [];
export const selectInitiativesByStatus = (state, status) =>
  selectBoardColumns(state)[status] ?? EMPTY_COLUMN;

export default initiatives.reducer;
