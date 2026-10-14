/**
 * DashboardLayout — the frame around every signed-in page:
 * sidebar on the left, a small user bar on top, the page itself below.
 *
 * The page arrives through <Outlet />, which is a placeholder meaning
 * "render whichever child route matched here". Because this component stays
 * mounted while the child changes, the sidebar does not remount on navigation.
 */
import { startTransition } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { PATHS, areaForRole, homeForRole } from "../routes";
import Sidebar from "./Sidebar";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  const {
    user,
    role,
    logout,
    impersonator,
    isImpersonating,
    stopImpersonating,
  } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    // The router applies navigation as a "transition" (a deferred update).
    // If the session were cleared as an ordinary update, React would apply it
    // first: RequireRole would see "signed out" while the URL is still the
    // dashboard, and redirect to sign-in. Putting logout() in a transition
    // too makes React apply both together: new URL and no session at once.
    navigate(PATHS.landing);
    startTransition(() => logout());
  }

  // Hand the session back to the Super Admin who was "acting as" this user,
  // then go to that admin's own home page.
  function handleReturnToAdmin() {
    const admin = stopImpersonating();
    if (admin) navigate(homeForRole(admin.role));
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar only needs to be told WHICH links to show. */}
      <Sidebar area={areaForRole(role)} role={role} title="Navigation" />

      <div className="dashboard-layout__body">
        {/* Only drawn while a Super Admin is acting as someone else. */}
        {isImpersonating && (
          <div className="dashboard-layout__banner">
            <span>
              Viewing as {user?.name} ({role}) — signed in as{" "}
              {impersonator?.name}
            </span>
            <button type="button" onClick={handleReturnToAdmin}>
              Return to admin
            </button>
          </div>
        )}

        <header className="dashboard-layout__bar">
          <span>
            {user?.name} · {role}
          </span>
          <button
            type="button"
            className="dashboard-layout__signout"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </header>

        <main className="dashboard-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
