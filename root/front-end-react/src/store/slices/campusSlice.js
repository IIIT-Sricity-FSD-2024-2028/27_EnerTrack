/**
 * campusSlice.js: /campus (id: campus_id). CRUD from createCrudSlice; see its header
 * for what each thunk does. Owner: Person 1.
 */
import { createCrudSlice } from "../createCrudSlice";

const campus = createCrudSlice({
  name: "campus",
  path: "/campus",
  idKey: "campus_id",
});

export const {
  fetchAll: fetchCampuses,
  fetchOne: fetchCampus,
  create: createCampus,
  update: updateCampus,
  remove: removeCampus,
} = campus.thunks;

export const {
  selectAll: selectAllCampuses,
  selectById: selectCampusById,
  selectStatus: selectCampusesStatus,
  selectError: selectCampusesError,
} = campus.selectors;

export default campus.reducer;
