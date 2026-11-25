import { createCrudSlice } from "../createCrudSlice";

// Shared target rows for the proposals, overview, initiatives and archives.
const targets = createCrudSlice({ name: "targets", path: "/targets", idKey: "target_id" });

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
