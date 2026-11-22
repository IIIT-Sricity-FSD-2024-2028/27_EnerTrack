/**
 * buildingsSlice.js: /buildings (id: building_id). CRUD from createCrudSlice; see its header
 * for what each thunk does. Owner: Person 1.
 */
import { createCrudSlice } from "../createCrudSlice";

const buildings = createCrudSlice({
  name: "buildings",
  path: "/buildings",
  idKey: "building_id",
});

export const {
  fetchAll: fetchBuildings,
  fetchOne: fetchBuilding,
  create: createBuilding,
  update: updateBuilding,
  remove: removeBuilding,
} = buildings.thunks;

export const {
  selectAll: selectAllBuildings,
  selectById: selectBuildingById,
  selectStatus: selectBuildingsStatus,
  selectError: selectBuildingsError,
} = buildings.selectors;

export default buildings.reducer;
