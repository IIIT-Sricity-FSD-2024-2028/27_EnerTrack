/**
 * Infrastructure — /admin/infrastructure. Super Admin and Organization Admin.
 * Replaces the "infrastructure" tab of system_admin_overview.html.
 *
 * All the real work (the campus, building, department and meter panels, the
 * popups, the saving and deleting) is in InfrastructureManager, which is
 * shared with the auditor's Audits page. This page only gives it the admin
 * frame: the "Welcome back" heading, the subtitle and the role check.
 *
 * <InfrastructureManager /> is used WITHOUT an orgId on purpose. With no
 * orgId it shows every record the backend returns for this user, and a
 * Super Admin also gets the Organisation filter (the manager checks the role).
 */
import AdminPage from "./AdminPage";
import InfrastructureManager from "../auditor/infrastructure/InfrastructureManager";

export default function Infrastructure() {
  return (
    // No requiredRole: both admin roles may open this page. The manager
    // loads and shows its own spinner and toasts, so AdminPage gets
    // loading={false} and an empty toasts list.
    <AdminPage
      subtitle="Maintain campuses, buildings, departments, and meter inventory."
      loading={false}
      toasts={[]}
    >
      <InfrastructureManager />
    </AdminPage>
  );
}
