/**
 * Users — /admin/users ("User Management"), for both the Super Admin and an
 * Organization Admin. Replaces js/system_admin/modules/UserManagement.js.
 *
 * Loads the users (and organisations, for their names), and shows them in a
 * table that can be filtered and sorted. Its popups:
 *   - Add / Edit    <UserFormModal>, which hands back the user to save
 *   - Import        <BulkImportModal>: many accounts from pasted rows / a CSV
 *   - Credentials   shown once after an account is created
 *   - Delete        a confirm popup
 *   - Act as        Super Admin only: open the product as that user
 *
 * The backend decides what each admin may see: a Super Admin gets every
 * user, an Organization Admin only their own organisation's.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { homeForRole } from "../../routes";
import AdminPage from "./AdminPage";
import Modal from "./Modal";
import UserFormModal from "./UserFormModal";
import BulkImportModal from "./BulkImportModal";
import CredentialsModal from "./CredentialsModal";
import { addToast, formatLabel, USER_ROLES } from "./adminHelpers";

// The filter choices are remembered in the browser between visits
const FILTERS_KEY = "admin_userFilters";
const DEFAULT_FILTERS = { organization_id: "", role: "", sort: "name-asc" };

// Organisation filter value meaning "EnerTrack's own staff" (no organisation)
const STAFF = "__enertrack_staff__";

function loadFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTERS_KEY));
    return saved ? { ...DEFAULT_FILTERS, ...saved } : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

// The organisation's name for an id. Staff have none.
function orgName(id, organizations) {
  if (!id) return "EnerTrack (staff)";
  const org = organizations.find((o) => o.organization_id === id);
  return org ? org.name : id;
}

// Keeps the users that pass the filters, then sorts them
function filterAndSort(users, filters, organizations) {
  const rows = users.filter((u) => {
    if (filters.organization_id === STAFF && u.organization_id) return false;
    if (
      filters.organization_id &&
      filters.organization_id !== STAFF &&
      u.organization_id !== filters.organization_id
    ) {
      return false;
    }
    if (filters.role && u.role !== filters.role) return false;
    return true;
  });

  const byName = (a, b) => a.name.localeCompare(b.name);
  return rows.sort((a, b) => {
    if (filters.sort === "name-desc") return b.name.localeCompare(a.name);
    if (filters.sort === "org") {
      return (
        orgName(a.organization_id, organizations).localeCompare(
          orgName(b.organization_id, organizations),
        ) || byName(a, b)
      );
    }
    if (filters.sort === "role") {
      return (
        formatLabel(a.role).localeCompare(formatLabel(b.role)) || byName(a, b)
      );
    }
    return byName(a, b); // "name-asc"
  });
}

export default function Users() {
  const { user: me, adoptSession, impersonate } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [filters, setFilters] = useState(loadFilters);
  // The open popup: null, or { type: "add" | "edit" | "delete" | "actAs" |
  // "import" | "credentials", user }
  const [modal, setModal] = useState(null);

  const isSuperAdmin = me.role === "Super Admin";
  // Only an Organization Admin imports: the accounts land in their own
  // organisation, and only they can issue a whole organisation's credentials.
  const canImport = me.role === "Organization Admin";
  const myOrganisation = organizations.find(
    (o) => o.organization_id === me.organization_id,
  );

  // Load the users and organisations when the page opens
  useEffect(() => {
    Promise.all([
      api.get("/users"),
      // Only used for names, so a failure here just means ids are shown
      api.get("/organizations").catch(() => []),
    ])
      .then(([userList, orgList]) => {
        setUsers(Array.isArray(userList) ? userList : []);
        setOrganizations(Array.isArray(orgList) ? orgList : []);
      })
      .catch(() => {
        addToast(setToasts, "Failed to load data from backend.", "error");
      })
      .finally(() => setLoading(false));
  }, []);

  // Remember the filters every time they change
  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

  function isMe(u) {
    return me.user_id === u.user_id || me.id === u.user_id;
  }

  async function reloadUsers() {
    const list = await api.get("/users").catch(() => users);
    setUsers(Array.isArray(list) ? list : users);
  }

  // Called by <UserFormModal> with the user to save
  async function handleSave(payload) {
    const editing = modal.user; // null when adding
    setModal(null);
    try {
      if (editing) {
        await api.patch("/users/" + editing.user_id, payload);
        // Edited yourself: keep the signed-in session in step (without the
        // password: the session never stores one)
        if (isMe(editing)) {
          const details = { ...payload };
          delete details.password;
          adoptSession({ ...me, ...details });
        }
      } else {
        await api.post("/users", payload);
      }
      await reloadUsers();
      addToast(
        setToasts,
        `${editing ? "Updated" : "Added"} ${payload.name}.`,
        "success",
      );
      // The password exists only in this form. Show it once so it can be
      // handed over (a blank one when editing means it was not changed).
      if (payload.password) {
        setModal({
          type: "credentials",
          credentials: {
            name: payload.name,
            email: payload.email,
            password: payload.password,
          },
        });
      }
    } catch (err) {
      addToast(setToasts, err.message || "Could not save the user.", "error");
    }
  }

  async function handleDelete(target) {
    setModal(null);
    try {
      await api.delete("/users/" + target.user_id);
      await reloadUsers();
      addToast(setToasts, `Deleted ${target.name}.`, "success");
    } catch (err) {
      addToast(setToasts, err.message || "Could not delete the user.", "error");
    }
  }

  async function handleActAs(target) {
    setModal(null);
    try {
      const session = await impersonate(target.user_id);
      navigate(homeForRole(session.role)); // their own home page
    } catch (err) {
      addToast(
        setToasts,
        err.message || "Could not act as that user.",
        "error",
      );
    }
  }

  const rows = filterAndSort(users, filters, organizations);
  const filtersActive = filters.organization_id || filters.role;

  return (
    <AdminPage
      subtitle="Create your team's and campus's accounts and hand over their credentials."
      loading={loading}
      toasts={toasts}
    >
      <section className="dashboard-section">
        <div className="section-toolbar">
          <div>
            <h2>User Management</h2>
            <p>
              People cannot sign themselves up. You create each account, give
              them the temporary password, and they choose their own when they
              first sign in.
              {myOrganisation?.email_domain &&
                ` Accounts use @${myOrganisation.email_domain}.`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {canImport && (
              <button
                className="btn-outline"
                type="button"
                onClick={() => setModal({ type: "import", user: null })}
              >
                Import people
              </button>
            )}
            <button
              className="btn-dark"
              type="button"
              onClick={() => setModal({ type: "add", user: null })}
            >
              Add User
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div
          className="table-card"
          style={{
            padding: "16px 20px",
            marginBottom: "16px",
            display: "flex",
            gap: "16px",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {isSuperAdmin && (
            <div
              className="form-field"
              style={{ marginBottom: 0, minWidth: "200px" }}
            >
              <label htmlFor="userFilterOrg">Organisation</label>
              <select
                id="userFilterOrg"
                value={filters.organization_id}
                onChange={(e) =>
                  setFilters({ ...filters, organization_id: e.target.value })
                }
              >
                <option value="">All organisations</option>
                <option value={STAFF}>EnerTrack Staff</option>
                {organizations.map((o) => (
                  <option key={o.organization_id} value={o.organization_id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            className="form-field"
            style={{ marginBottom: 0, minWidth: "180px" }}
          >
            <label htmlFor="userFilterRole">Role</label>
            <select
              id="userFilterRole"
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            >
              <option value="">All roles</option>
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div
            className="form-field"
            style={{ marginBottom: 0, minWidth: "180px" }}
          >
            <label htmlFor="userSort">Sort by</label>
            <select
              id="userSort"
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            >
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="org">Organisation</option>
              <option value="role">Role</option>
            </select>
          </div>

          {filtersActive && (
            <button
              className="btn-outline"
              type="button"
              onClick={() =>
                setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })
              }
            >
              Clear filters
            </button>
          )}

          <span className="muted-cell" style={{ marginLeft: "auto" }}>
            Showing {rows.length} of {users.length}
          </span>
        </div>

        {/* ── Users table ── */}
        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Organisation</th>
                  <th>Role</th>
                  <th>Specialization</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <div className="empty-state">
                        {filtersActive
                          ? "No users match these filters."
                          : "No users found."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => (
                    <tr key={u.user_id}>
                      <td>
                        <strong>{u.name}</strong>
                        <div className="muted-cell">{u.user_id}</div>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.phone || "-"}</td>
                      <td>{orgName(u.organization_id, organizations)}</td>
                      <td>{formatLabel(u.role)}</td>
                      <td>{u.specialization || "-"}</td>
                      <td>
                        <div className="row-actions">
                          {isSuperAdmin && !isMe(u) && (
                            <button
                              className="btn-outline"
                              type="button"
                              title="Open the product as this user sees it"
                              onClick={() =>
                                setModal({ type: "actAs", user: u })
                              }
                            >
                              Act as
                            </button>
                          )}
                          <button
                            className="btn-outline"
                            type="button"
                            onClick={() => setModal({ type: "edit", user: u })}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-outline btn-danger"
                            type="button"
                            disabled={isMe(u)}
                            title={
                              isMe(u)
                                ? "You cannot delete your own account"
                                : undefined
                            }
                            onClick={() =>
                              setModal({ type: "delete", user: u })
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Popups (only one is open at a time) ── */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <UserFormModal
          user={modal.user}
          users={users}
          organizations={organizations}
          isSuperAdmin={isSuperAdmin}
          defaultOrgId={me.organization_id}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "import" && (
        <BulkImportModal
          emailDomain={myOrganisation?.email_domain || ""}
          existing={users}
          onClose={() => setModal(null)}
          onDone={reloadUsers}
        />
      )}

      {modal?.type === "credentials" && (
        <CredentialsModal
          {...modal.credentials}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "delete" && (
        <Modal
          title="Delete User"
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(modal.user)}
          onClose={() => setModal(null)}
        >
          <p>
            Delete <strong>{modal.user.name}</strong>? They will no longer be
            able to sign in.
          </p>
        </Modal>
      )}

      {modal?.type === "actAs" && (
        <Modal
          title="Act as another user"
          confirmLabel="Act as this user"
          onConfirm={() => handleActAs(modal.user)}
          onClose={() => setModal(null)}
        >
          <p>
            Open EnerTrack as <strong>{modal.user.name}</strong> (
            {formatLabel(modal.user.role)})?
          </p>
          <p className="muted-cell">
            You will see exactly what they see, and anything you do will be done
            as them. A banner stays on screen with a way back, and the switch is
            recorded in the activity log.
          </p>
        </Modal>
      )}
    </AdminPage>
  );
}
