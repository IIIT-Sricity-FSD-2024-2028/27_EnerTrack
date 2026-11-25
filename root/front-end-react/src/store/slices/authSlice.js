/**
 * authSlice.js: the signed-in session.
 *
 * State: { user, impersonator }. `impersonator` is the Super Admin's own
 * session while they act as someone else, so there is always a way back.
 *
 * localStorage stays the source of truth: api/client.js reads the token from
 * localStorage.currentUser on every request, so each action below writes
 * storage FIRST and updates the store second. The store is a mirror that
 * makes components re-render.
 *
 * None of these navigate. They return the session and the calling component
 * decides where to go, so every redirect stays visible in the component that
 * causes it.
 *
 * Components normally use useAuth() (auth/useAuth.js), which wraps these.
 * The API thunks (signIn, signUpCampus, ...) are dispatched directly:
 *
 *   const account = await dispatch(signIn({ email, password })).unwrap();
 */
import { createSlice } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { resetData } from "../actions";

const USER_KEY = "currentUser";
const IMPERSONATOR_KEY = "enertrack_impersonator";

/** Reads and parses a session key, tolerating absent or corrupt JSON. */
function readSession(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  if (value) localStorage.setItem(key, JSON.stringify(value));
  else localStorage.removeItem(key);
}

const authSlice = createSlice({
  name: "auth",
  // A function, so storage is read when the store is created, before the
  // first paint. Reading it later would render one frame "signed out" and the
  // route guards would bounce a refreshed dashboard to sign-in.
  initialState: () => ({
    user: readSession(USER_KEY),
    impersonator: readSession(IMPERSONATOR_KEY),
  }),
  reducers: {
    sessionChanged(state, { payload }) {
      state.user = payload.user;
      state.impersonator = payload.impersonator;
    },
  },
});

const { sessionChanged } = authSlice.actions;

/* ── session actions (synchronous thunks) ─────────────────────── */

/** Starts or refreshes a session from an account the caller already has. */
export const adoptSession = (account) => (dispatch, getState) => {
  writeSession(USER_KEY, account);
  dispatch(
    sessionChanged({
      user: account,
      impersonator: getState().auth.impersonator,
    }),
  );
  return account;
};

/** Signs out, and clears every data slice. */
export const logout = () => (dispatch) => {
  writeSession(USER_KEY, null);
  writeSession(IMPERSONATOR_KEY, null);
  dispatch(resetData());
  dispatch(sessionChanged({ user: null, impersonator: null }));
};

/** Returns to the stashed Super Admin session. Null if not impersonating. */
export const stopImpersonating = () => (dispatch) => {
  const admin = readSession(IMPERSONATOR_KEY);
  if (!admin) return null;
  writeSession(USER_KEY, admin);
  writeSession(IMPERSONATOR_KEY, null);
  dispatch(resetData());
  dispatch(sessionChanged({ user: admin, impersonator: null }));
  return admin;
};

/**
 * Super Admin acts as another user. The backend writes an activity-log entry
 * naming both people. Resolves to the new session.
 */
export const impersonate = apiThunk(
  "auth/impersonate",
  async (userId, { dispatch }) => {
    const admin = readSession(USER_KEY);
    if (!admin) throw new Error("No active session to act from.");
    const session = await api.post(`/users/${userId}/impersonate`, {
      actor: admin.name,
    });
    writeSession(IMPERSONATOR_KEY, admin);
    writeSession(USER_KEY, session);
    dispatch(resetData());
    dispatch(sessionChanged({ user: session, impersonator: admin }));
    return session;
  },
);

/* ── account API thunks (the page adopts the returned account) ── */

const email = (value) => value.trim().toLowerCase();

/** Signs anyone in. Resolves to the account (without password). */
export const signIn = apiThunk("auth/signIn", ({ email: e, password }) =>
  api.post("/users/login", { email: email(e), password }),
);

/** A student or faculty member's own account. Resolves to the account. */
export const signUpCampus = apiThunk("auth/signUpCampus", (values) =>
  api.post("/users/signup", {
    name: values.name.trim(),
    email: email(values.email),
    phone: values.phone.trim(),
    password: values.password,
  }),
);

/**
 * A new organisation asks for an audit. Nothing is created and nobody is
 * signed in: the request waits for a Super Admin. `payload` is built by
 * organisationPayload() in pages/auth/authFlow.js.
 */
export const requestAudit = apiThunk("auth/requestAudit", (payload) =>
  api.post("/audit-requests", payload),
);

/** Replaces a password. Resolves to the updated account. */
export const changePassword = apiThunk(
  "auth/changePassword",
  ({ email: e, currentPassword, newPassword }) =>
    api.post("/users/change-password", {
      email: email(e),
      current_password: currentPassword,
      new_password: newPassword,
    }),
);

/** Saves a person's own name and phone. Resolves to the updated account. */
export const updateDetails = apiThunk(
  "auth/updateDetails",
  ({ email: e, currentPassword, name, phone }) =>
    api.post("/users/update-details", {
      email: email(e),
      current_password: currentPassword,
      name: name.trim(),
      phone: phone.trim(),
    }),
);

/** Deletes a person's own account, after confirming the password. */
export const deleteAccount = apiThunk(
  "auth/deleteAccount",
  ({ email: e, password }) =>
    api.post("/users/delete-account", { email: email(e), password }),
);

/* ── selectors ───────────────────────────────────────────────── */

export const selectCurrentUser = (state) => state.auth.user;
export const selectImpersonator = (state) => state.auth.impersonator;
export const selectRole = (state) => state.auth.user?.role ?? null;
export const selectIsSignedIn = (state) => Boolean(state.auth.user);

export default authSlice.reducer;
