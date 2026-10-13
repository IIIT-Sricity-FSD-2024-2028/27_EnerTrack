/**
 * RequireRole — a guard that sits in front of a group of routes.
 *
 * It renders no page of its own. It decides one of three things:
 *   - not signed in            -> send to sign-in
 *   - signed in, wrong area    -> send to that user's own home page
 *   - signed in, right area    -> render the child routes via <Outlet />
 *
 * `area` is the nav area this group belongs to ("admin", "finance", ...), the
 * same names routes.js uses for ROLE_AREA and NAV.
 */
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { PATHS, areaForRole, homeForRole } from "../routes";

export default function RequireRole({ area }) {
  const { isSignedIn, role } = useAuth();

  if (!isSignedIn) {
    return <Navigate to={PATHS.signIn} replace />;
  }
  if (areaForRole(role) !== area) {
    return <Navigate to={homeForRole(role)} replace />;
  }
  return <Outlet />;
}
