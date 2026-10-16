/**
 * AuthContext.jsx — the one place that owns the session.
 *
 * In the old front end, five different files wrote localStorage.currentUser:
 * sign_in.js, sign_up.js, registerOrganisation.js, UserManagement.js (when a
 * Super Admin acts as someone) and dashboardProfileMenu.js (on sign-out).
 * Every one of them then did its own window.location.href redirect. That is
 * the duplication this file exists to remove.
 *
 * Important: localStorage is still the source of truth, not React state.
 * api/client.js reads localStorage.currentUser on every single request to
 * pick up the sign-in token, so if the session lived only in React state the
 * very next API call would go out signed in as nobody.
 * Every action below therefore writes localStorage FIRST and sets state
 * second — state is a mirror kept in sync so components re-render.
 *
 * None of these functions navigate. They return the new session and let the
 * calling component decide where to go, which keeps this file independent of
 * the router and keeps every redirect visible in the component that causes it.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import api, { SESSION_EXPIRED_EVENT } from "../api/client";
import { AuthContext } from "./context";

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

export function AuthProvider({ children }) {
  // The lazy initialiser (a function, not a value) matters: it runs once,
  // before the first paint. Reading localStorage in a useEffect instead would
  // render one frame with user === null, which every guarded route would read
  // as "signed out" and bounce to sign-in — so refreshing any dashboard would
  // log you out.
  const [user, setUser] = useState(() => readSession(USER_KEY));
  const [impersonator, setImpersonator] = useState(() =>
    readSession(IMPERSONATOR_KEY),
  );

  /** Starts a session from an account the caller already obtained. The auth
   *  page calls the API itself (see pages/auth/authFlow.js) and hands the
   *  account here, as do the forced password change and the admin's own
   *  profile edits. */
  const adoptSession = useCallback((account) => {
    localStorage.setItem(USER_KEY, JSON.stringify(account));
    setUser(account);
    return account;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(IMPERSONATOR_KEY);
    setUser(null);
    setImpersonator(null);
  }, []);

  /**
   * Super Admin acts as another user. The real admin session is stashed under
   * enertrack_impersonator so there is always a way back, and the backend
   * writes an activity-log entry naming both parties.
   */
  const impersonate = useCallback(async (userId) => {
    const admin = readSession(USER_KEY);
    if (!admin) throw new Error("No active session to act from.");

    const session = await api.post(`/users/${userId}/impersonate`, {
      actor: admin.name,
    });

    localStorage.setItem(IMPERSONATOR_KEY, JSON.stringify(admin));
    localStorage.setItem(USER_KEY, JSON.stringify(session));
    setImpersonator(admin);
    setUser(session);
    return session;
  }, []);

  /** Returns to the stashed Super Admin session. Null if not impersonating. */
  const stopImpersonating = useCallback(() => {
    const admin = readSession(IMPERSONATOR_KEY);
    if (!admin) return null;

    localStorage.setItem(USER_KEY, JSON.stringify(admin));
    localStorage.removeItem(IMPERSONATOR_KEY);
    setImpersonator(null);
    setUser(admin);
    return admin;
  }, []);

  // The backend answered 401 to our token (it expired, or the backend
  // restarted with a new signing key). api/client.js has already cleared
  // storage; mirror that into state so the route guards send us to sign-in.
  useEffect(() => {
    function onExpired() {
      setUser(null);
      setImpersonator(null);
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Without useMemo this object is rebuilt on every provider render, and since
  // it is the context value, every consumer in the tree re-renders with it.
  const value = useMemo(
    () => ({
      user,
      impersonator,
      isImpersonating: Boolean(impersonator),
      isSignedIn: Boolean(user),
      role: user?.role ?? null,
      logout,
      adoptSession,
      impersonate,
      stopImpersonating,
    }),
    [
      user,
      impersonator,
      logout,
      adoptSession,
      impersonate,
      stopImpersonating,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
