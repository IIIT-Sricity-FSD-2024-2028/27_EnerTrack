/**
 * usersSlice.js: /users (id: user_id). Owner: Person 1.
 *
 * CRUD comes from createCrudSlice; see its header. Extra:
 *   bulkCreateUsers(rows)  POST /users/bulk: resolves to the per-row results
 *                          ({ row, ok, email, name, role, password } or an
 *                          error) and reloads the list
 *   generatePassword()     POST /users/generate-password: resolves to
 *                          { password }. Nothing is stored: a password is form
 *                          state, never app state.
 *
 * Sign-in, sign-up and the person's own account live in authSlice, not here.
 */
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

const users = createCrudSlice({
  name: "users",
  path: "/users",
  idKey: "user_id",
});

export const {
  fetchAll: fetchUsers,
  fetchOne: fetchUser,
  create: createUser,
  update: updateUser,
  remove: removeUser,
} = users.thunks;

export const bulkCreateUsers = apiThunk(
  "users/bulkCreate",
  async (rows, { dispatch }) => {
    const results = await api.post("/users/bulk", { users: rows });
    await dispatch(fetchUsers({ force: true }));
    return Array.isArray(results) ? results : [];
  },
);

export const generatePassword = apiThunk("users/generatePassword", () =>
  api.post("/users/generate-password", {}),
);

export const {
  selectAll: selectAllUsers,
  selectById: selectUserById,
  selectStatus: selectUsersStatus,
  selectError: selectUsersError,
} = users.selectors;

export default users.reducer;
