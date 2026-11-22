/**
 * departmentsSlice.js: /departments (id: department_id). CRUD from createCrudSlice; see its header
 * for what each thunk does. Owner: Person 1.
 */
import { createCrudSlice } from "../createCrudSlice";

const departments = createCrudSlice({
  name: "departments",
  path: "/departments",
  idKey: "department_id",
});

export const {
  fetchAll: fetchDepartments,
  fetchOne: fetchDepartment,
  create: createDepartment,
  update: updateDepartment,
  remove: removeDepartment,
} = departments.thunks;

export const {
  selectAll: selectAllDepartments,
  selectById: selectDepartmentById,
  selectStatus: selectDepartmentsStatus,
  selectError: selectDepartmentsError,
} = departments.selectors;

export default departments.reducer;
