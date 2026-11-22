/**
 * useAuth: the session, read from the Redux store.
 *
 * Same shape the old AuthContext gave, so pages did not have to change:
 *
 *   user, impersonator, isImpersonating, isSignedIn, role
 *   adoptSession(account) → account       start/refresh a session
 *   logout()                               sign out and clear all data
 *   impersonate(userId)   → Promise<session>  Super Admin "Act as"
 *   stopImpersonating()   → admin | null   back to the Super Admin
 *
 * The session itself lives in store/slices/authSlice.js. For sign-in,
 * sign-up, password and account changes, dispatch that file's thunks.
 */
import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  adoptSession,
  impersonate,
  logout,
  selectCurrentUser,
  selectImpersonator,
  stopImpersonating,
} from "../store/slices/authSlice";

export function useAuth() {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const impersonator = useSelector(selectImpersonator);

  return useMemo(
    () => ({
      user,
      impersonator,
      isImpersonating: Boolean(impersonator),
      isSignedIn: Boolean(user),
      role: user?.role ?? null,
      adoptSession: (account) => dispatch(adoptSession(account)),
      logout: () => dispatch(logout()),
      impersonate: (userId) => dispatch(impersonate(userId)).unwrap(),
      stopImpersonating: () => dispatch(stopImpersonating()),
    }),
    [dispatch, user, impersonator],
  );
}
