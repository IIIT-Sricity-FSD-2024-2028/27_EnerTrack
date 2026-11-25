/**
 * metersSlice.js: /meters (id: meter_id). CRUD from createCrudSlice; see its header
 * for what each thunk does. Owner: Person 1.
 */
import { createCrudSlice } from "../createCrudSlice";

const meters = createCrudSlice({
  name: "meters",
  path: "/meters",
  idKey: "meter_id",
});

export const {
  fetchAll: fetchMeters,
  fetchOne: fetchMeter,
  create: createMeter,
  update: updateMeter,
  remove: removeMeter,
} = meters.thunks;

export const {
  selectAll: selectAllMeters,
  selectById: selectMeterById,
  selectStatus: selectMetersStatus,
  selectError: selectMetersError,
} = meters.selectors;

export default meters.reducer;
