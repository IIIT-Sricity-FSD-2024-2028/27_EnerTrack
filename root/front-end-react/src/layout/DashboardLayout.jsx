/**
 * DashboardLayout — the frame around every signed-in page:
 * sidebar on the left, a small user bar on top, the page itself below.
 *
 * The page arrives through <Outlet />, which is a placeholder meaning
 * "render whichever child route matched here". Because this component stays
 * mounted while the child changes, the sidebar does not remount on navigation.
 */
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { PATHS, areaForRole } from "../routes";
import Sidebar from "./Sidebar";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate(PATHS.landing);
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar only needs to be told WHICH links to show. */}
      <Sidebar area={areaForRole(role)} title="Navigation" />

      <div className="dashboard-layout__body">
        <header className="dashboard-layout__bar">
          <span>
            {user?.name} · {role}
          </span>
          <button type="button" onClick={handleSignOut}>
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
