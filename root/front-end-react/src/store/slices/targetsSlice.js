import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

/**
 * The Organization Admin's decision on a target (approve, reject, close as
 * met / missed). PATCH /targets/:id/status answers with the saved target.
 */
export const decideTarget = apiThunk("targets/decide", ({ id, status, note }) =>
  api.patch(`/targets/${id}/status`, { status, ...(note ? { note } : {}) }),
);

// Shared target rows for the proposals, overview, initiatives and archives.
const targets = createCrudSlice({
  name: "targets",
  path: "/targets",
  idKey: "target_id",
  extraReducers: (builder, { adapter, isRow }) => {
    builder.addCase(decideTarget.fulfilled, (state, { payload }) => {
      if (isRow(payload)) adapter.upsertOne(state, payload);
    });
  },
});

export const {
  fetchAll: fetchTargets,
  create: createTarget,
  remove: removeTarget,
} = targets.thunks;
export const {
  selectAll: selectAllTargets,
  selectStatus: selectTargetsStatus,
  selectError: selectTargetsError,
} = targets.selectors;
export default targets.reducer;
