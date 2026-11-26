/**
 * AdminPage — the frame every admin page sits in.
 *
 * Gives each page the admin styles, the "Welcome back, {name}" heading with
 * the page's own subtitle, the "Loading from backend…" spinner, and the
 * role rule (toasts come from the shared useToast()):
 *   - Organisations, Registrations, Pricing Plans, Revenue: Super Admin only
 *   - EnerTrack Proposal: Organization Admin only
 * Anyone else is sent back to User Management, like adminLayout.js did.
 *
 * Usage, inside a page:
 *   <AdminPage subtitle="..." requiredRole="Super Admin"
 *              loading={loading}>
 *     ...the page's own content...
 *   </AdminPage>
 *
 * Replaces the page header + loading part of system_admin_overview.html and
 * js/system_admin/modules/adminLayout.js.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { PATHS } from "../../routes";
import adminCss from "./admin.css?inline";

export default function AdminPage({
  subtitle,
  requiredRole,
  loading,
  children,
}) {
  const { user } = useAuth();

  // Wrong role for this page: back to User Management
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={PATHS.admin.users} replace />;
  }

  const firstName = user.name?.split(" ")[0] || "Admin";

  return (
    <div className="admin-page">
      <style>{adminCss}</style>

      <header className="page-header">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p>{subtitle}</p>
        </div>
      </header>

      <section className="admin-app" aria-live="polite">
        {loading ? (
          <div className="admin-loading">
            <div className="admin-spinner"></div>
            <p>Loading from backend…</p>
          </div>
        ) : (
          children
        )}
      </section>
    </div>
  );
}
