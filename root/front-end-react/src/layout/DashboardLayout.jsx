/**
 * DashboardLayout — the frame around every signed-in page:
 * sidebar on the left (links on top, the signed-in person's card and Sign
 * Out at the bottom), and the page itself on the right.
 *
 * The page arrives through <Outlet />, which is a placeholder meaning
 * "render whichever child route matched here". Because this component stays
 * mounted while the child changes, the sidebar does not remount on navigation.
 */
import { startTransition } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { PATHS, areaForRole, homeForRole, roleLabel } from "../routes";
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
      {/* Sidebar is told WHICH links to show and what to put at its foot. */}
      <Sidebar
        area={areaForRole(role)}
        role={role}
        title="Navigation"
        footer={
          <div className="dashboard-layout__profile">
            <div className="dashboard-layout__who">
              <span className="dashboard-layout__avatar" aria-hidden="true">
                {(user?.name || "?").trim().charAt(0).toUpperCase()}
              </span>
              <div className="dashboard-layout__who-text">
                <strong title={user?.name}>{user?.name}</strong>
                <span>{roleLabel(role)}</span>
              </div>
            </div>
            <Link to={PATHS.account} className="dashboard-layout__signout">
              My account
            </Link>
            <button
              type="button"
              className="dashboard-layout__signout"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        }
      />

      <div className="dashboard-layout__body">
        {/* Only drawn while a Super Admin is acting as someone else. */}
        {isImpersonating && (
          <div className="dashboard-layout__banner">
            <span>
              Viewing as {user?.name} ({roleLabel(role)}) — signed in as{" "}
              {impersonator?.name}
            </span>
            <button type="button" onClick={handleReturnToAdmin}>
              Return to admin
            </button>
          </div>
        )}

        <main className="dashboard-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
