/**
 * faultsSlice.js: /faults (id: fault_id). Owner: Person 1.
 *
 * CRUD from createCrudSlice (see its header). Notes and status changes are
 * plain updateFault({ id, changes }). A fault raised by decideAlert (alerts
 * slice) is added here from that thunk's answer.
 */
import { createCrudSlice } from "../createCrudSlice";
import { decideAlert } from "./alertsSlice";

const faults = createCrudSlice({
  name: "faults",
  path: "/faults",
  idKey: "fault_id",
  extraReducers: (builder, { adapter, isRow }) => {
    builder.addCase(decideAlert.fulfilled, (state, { payload }) => {
      if (isRow(payload?.fault)) adapter.upsertOne(state, payload.fault);
    });
  },
});

export const {
  fetchAll: fetchFaults,
  fetchOne: fetchFault,
  create: createFault,
  update: updateFault,
  remove: removeFault,
} = faults.thunks;

export const {
  selectAll: selectAllFaults,
  selectById: selectFaultById,
  selectStatus: selectFaultsStatus,
  selectError: selectFaultsError,
} = faults.selectors;

export default faults.reducer;
