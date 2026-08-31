import { userActions, USER_ROLES } from "../data/mockData.js";
import {
  escapeHtml,
  formValues,
  formatLabel,
  isEmail,
  openModal,
  showFormErrors,
  showToast,
} from "../utils/ui.js";
import universalDB from "../../shared/universalDB.js";

/**
 * Filter/sort choices, kept across re-renders the same way ORG_NAMES is —
 * this is a view concern local to the table, not app data, so it lives
 * here rather than round-tripping through app.update().
 *
 * Persisted to localStorage the same way admin_activeTab already is, so a
 * Super Admin coming back to this tab (after a reload, or a fresh sign-in)
 * doesn't have to re-pick the same organisation/role/sort every time.
 */
const FILTERS_STORAGE_KEY = "admin_userFilters";

function loadFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") {
      return {
        organization_id: saved.organization_id || "",
        role: saved.role || "",
        sort: saved.sort || "name-asc",
      };
    }
  } catch (_) {}
  return { organization_id: "", role: "", sort: "name-asc" };
}

function saveFilters() {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (_) {}
}

let filters = loadFilters();

export function renderUserManagement(container, app) {
  ORG_NAMES = Object.fromEntries(
    (app.state.organizations || []).map((o) => [o.organization_id, o.name]),
  );

  const orgs = app.state.organizations || [];
  const allUsers = app.state.users || [];
  const rows = applyFiltersAndSort(allUsers);
  const rowsHtml = rows.map(renderUserRow).join("");
  const filtersActive = filters.organization_id || filters.role;

  container.innerHTML = `
    <section class="dashboard-section">
      <div class="section-toolbar">
        <div>
          <h2>User Management</h2>
          <p>Uses the backend User table shape: user_id, name, email, phone, password, role, specialization.</p>
        </div>
        <button class="btn-dark" type="button" data-action="add-user">Add User</button>
      </div>

      <div class="table-card" style="padding:16px 20px; margin-bottom:16px; display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap">
        ${
          isSuperAdmin()
            ? `<div class="form-field" style="margin-bottom:0; min-width:200px">
                 <label for="userFilterOrg">Organisation</label>
                 <select id="userFilterOrg">
                   <option value="">All organisations</option>
                   ${orgs
                     .map(
                       (o) =>
                         `<option value="${escapeHtml(o.organization_id)}" ${filters.organization_id === o.organization_id ? "selected" : ""}>${escapeHtml(o.name)}</option>`,
                     )
                     .join("")}
                 </select>
               </div>`
            : ""
        }
        <div class="form-field" style="margin-bottom:0; min-width:180px">
          <label for="userFilterRole">Role</label>
          <select id="userFilterRole">
            <option value="">All roles</option>
            ${USER_ROLES.map(
              (role) =>
                `<option value="${escapeHtml(role)}" ${filters.role === role ? "selected" : ""}>${escapeHtml(role)}</option>`,
            ).join("")}
          </select>
        </div>
        <div class="form-field" style="margin-bottom:0; min-width:180px">
          <label for="userSort">Sort by</label>
          <select id="userSort">
            <option value="name-asc" ${filters.sort === "name-asc" ? "selected" : ""}>Name (A&ndash;Z)</option>
            <option value="name-desc" ${filters.sort === "name-desc" ? "selected" : ""}>Name (Z&ndash;A)</option>
            <option value="org" ${filters.sort === "org" ? "selected" : ""}>Organisation</option>
            <option value="role" ${filters.sort === "role" ? "selected" : ""}>Role</option>
          </select>
        </div>
        ${
          filtersActive
            ? `<button class="btn-outline" type="button" id="clearUserFilters">Clear filters</button>`
            : ""
        }
        <span class="muted-cell" style="margin-left:auto">Showing ${rows.length} of ${allUsers.length}</span>
      </div>

      <div class="table-card">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Organisation</th>
                <th>Role</th>
                <th>Specialization</th>
                <th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="7"><div class="empty-state">${filtersActive ? "No users match these filters." : "No users found."}</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  container
    .querySelector('[data-action="add-user"]')
    ?.addEventListener("click", () => openAddUserModal(app));
  container.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () =>
      openEditUserModal(button.dataset.editUser, app),
    );
  });
  container.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () =>
      deleteUser(button.dataset.deleteUser, app),
    );
  });
  container.querySelectorAll("[data-act-as]").forEach((button) => {
    button.addEventListener("click", () => actAs(button.dataset.actAs, app));
  });

  container.querySelector("#userFilterOrg")?.addEventListener("change", (e) => {
    filters.organization_id = e.target.value;
    saveFilters();
    renderUserManagement(container, app);
  });
  container.querySelector("#userFilterRole")?.addEventListener("change", (e) => {
    filters.role = e.target.value;
    saveFilters();
    renderUserManagement(container, app);
  });
  container.querySelector("#userSort")?.addEventListener("change", (e) => {
    filters.sort = e.target.value;
    saveFilters();
    renderUserManagement(container, app);
  });
  container.querySelector("#clearUserFilters")?.addEventListener("click", () => {
    filters = { organization_id: "", role: "", sort: filters.sort };
    saveFilters();
    renderUserManagement(container, app);
  });
}

/** Filtering by organisation/role, then sorting — a pure view over the
 * data app.state already holds, so it never touches the backend. */
function applyFiltersAndSort(users) {
  let rows = users.filter((u) => {
    if (filters.organization_id && u.organization_id !== filters.organization_id)
      return false;
    if (filters.role && u.role !== filters.role) return false;
    return true;
  });

  const byName = (a, b) => a.name.localeCompare(b.name);
  rows = [...rows].sort((a, b) => {
    switch (filters.sort) {
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "org":
        return orgName(a.organization_id).localeCompare(orgName(b.organization_id)) || byName(a, b);
      case "role":
        return formatLabel(a.role).localeCompare(formatLabel(b.role)) || byName(a, b);
      case "name-asc":
      default:
        return byName(a, b);
    }
  });

  return rows;
}

/** True when the signed-in user is EnerTrack's platform operator. */
function isSuperAdmin() {
  try {
    const u = JSON.parse(localStorage.getItem("currentUser") || "null");
    return !!u && u.role === "Super Admin";
  } catch (_) {
    return false;
  }
}

/**
 * Opens the product as another user sees it.
 *
 * Worth being clear about what this is. Authorisation in this system is a
 * client-supplied x-role header with no token, so anyone who can open
 * devtools could already put any role into localStorage. This button is
 * not a new privilege — it is the same capability made deliberate, logged
 * server-side, and reachable in one click, and it is shaped so it still
 * makes sense once real authentication exists.
 *
 * The real session is stashed under enertrack_impersonator so the banner in
 * dashboardProfileMenu.js can offer a way back from wherever it lands.
 */
async function actAs(userId, app) {
  const admin = JSON.parse(localStorage.getItem("currentUser") || "null");
  const target = (app.state.users || []).find((u) => u.user_id === userId);
  if (!admin || !target) return;

  openModal({
    title: "Act as another user",
    bodyHtml: `
      <p>Open EnerTrack as <strong>${escapeHtml(target.name)}</strong>
         (${escapeHtml(formatLabel(target.role))})?</p>
      <p class="muted-cell">
        You will see exactly what they see, and anything you do will be done
        as them. A banner stays on screen with a way back, and the switch is
        recorded in the activity log.
      </p>`,
    confirmLabel: "Act as this user",
    onConfirm: () => {
      (async () => {
        try {
          const session = await window.api.post(`/users/${userId}/impersonate`, {
            actor: admin.name,
          });
          localStorage.setItem("enertrack_impersonator", JSON.stringify(admin));
          localStorage.setItem("currentUser", JSON.stringify(session));
          window.location.href = window.roleRoutes
            ? window.roleRoutes.forRole(session.role)
            : "../landing/landing.html";
        } catch (err) {
          console.error("Impersonation failed:", err);
          showToast(err.message || "Could not act as that user.", "error");
        }
      })();
      return true;
    },
  });
}

/* Organisation names, filled on each render so rows can show a name instead
   of a raw id. EnerTrack's own staff have no organisation, hence the dash. */
let ORG_NAMES = {};

function orgName(id) {
  if (!id) return "EnerTrack (staff)";
  return ORG_NAMES[id] || id;
}

function renderUserRow(user) {
  let isCurrentUser = false;
  try {
    const current = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (current.user_id === user.user_id || current.id === user.user_id) {
      isCurrentUser = true;
    }
  } catch (_) {}

  return `
    <tr>
      <td><strong>${escapeHtml(user.name)}</strong><div class="muted-cell">${escapeHtml(user.user_id)}</div></td>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.phone || "-")}</td>
      <td>${escapeHtml(orgName(user.organization_id))}</td>
      <td>${escapeHtml(formatLabel(user.role))}</td>
      <td>${escapeHtml(user.specialization || "-")}</td>
      <td>
        <div class="row-actions">
          ${
            isSuperAdmin() && !isCurrentUser
              ? `<button class="btn-outline" type="button" data-act-as="${escapeHtml(user.user_id)}"
                         title="Open the product as this user sees it">Act as</button>`
              : ""
          }
          <button class="btn-outline" type="button" data-edit-user="${escapeHtml(user.user_id)}">Edit</button>
          <button class="btn-outline btn-danger" type="button" data-delete-user="${escapeHtml(user.user_id)}" ${isCurrentUser ? 'disabled title="You cannot delete your own account"' : ""}>Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function openAddUserModal(app) {
  // A Super Admin works across every tenant, so the request carries no
  // x-org-id and the backend has nothing to fall back on — the dropdown
  // below is what used to be missing, and its absence is exactly how an
  // "Organization Admin" ended up created with no organisation at all. An
  // Organization Admin managing their own team never needs this: the
  // backend always resolves the tenant from their session's x-org-id
  // regardless of anything sent in the body, so showing them a choice here
  // would be a choice that does nothing.
  const needsOrgPicker = isSuperAdmin();
  const orgs = app.state.organizations || [];

  openModal({
    title: "Add User",
    confirmLabel: "Add User",
    bodyHtml: `
      <form id="userForm" class="form-grid">
        <div class="form-field">
          <label for="userName">Name</label>
          <input id="userName" autocomplete="name" placeholder="Teja Rao">
          <span class="field-error" data-error-for="name"></span>
        </div>
        <div class="form-field">
          <label for="userEmail">Email</label>
          <input id="userEmail" autocomplete="email" placeholder="name@gmail.com">
          <span class="field-error" data-error-for="email"></span>
        </div>
        <div class="form-field">
          <label for="userPhone">Phone</label>
          <input id="userPhone" autocomplete="tel" placeholder="9876543210">
          <span class="field-error" data-error-for="phone"></span>
        </div>
        <div class="form-field">
          <label for="userRole">Role</label>
          <select id="userRole">
            ${USER_ROLES.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join("")}
          </select>
          <span class="field-error" data-error-for="role"></span>
        </div>
        ${
          needsOrgPicker
            ? `<div class="form-field">
                 <label for="userOrg">Organisation</label>
                 <select id="userOrg">
                   <option value="" disabled selected hidden>Select an organisation</option>
                   ${orgs
                     .map(
                       (o) =>
                         `<option value="${escapeHtml(o.organization_id)}">${escapeHtml(o.name)}</option>`,
                     )
                     .join("")}
                 </select>
                 <span class="field-error" data-error-for="organization_id"></span>
               </div>`
            : ""
        }
        <div class="form-field">
          <label for="specialization">Specialization</label>
          <input id="specialization" placeholder="Required for Technicians">
          <span class="field-error" data-error-for="specialization"></span>
        </div>
        <div class="form-field">
          <label for="tempPassword">Temporary Password</label>
          <input id="tempPassword" type="password" autocomplete="new-password" placeholder="Minimum 8 characters">
          <span class="field-error" data-error-for="password"></span>
        </div>
      </form>
    `,
    onConfirm: (modal) => {
      const values = formValues(modal, {
        name: "#userName",
        email: "#userEmail",
        phone: "#userPhone",
        role: "#userRole",
        // #userOrg only exists in the DOM for a Super Admin; querySelector
        // simply finds nothing for anyone else, and values.organization_id
        // comes back "" — which validateUser only requires when
        // needsOrgPicker is true.
        organization_id: "#userOrg",
        specialization: "#specialization",
        password: "#tempPassword",
      });
      const errors = validateUser(values, app.state.users, {
        requireOrg: needsOrgPicker,
      });

      if (Object.keys(errors).length > 0) {
        showFormErrors(modal, errors);
        return false;
      }

      app.update(async (state) => {
        const payload = {
          name: values.name,
          email: values.email.toLowerCase(),
          phone: values.phone.trim(),
          password: values.password,
          role: values.role,
          specialization:
            values.role === "Technician" || values.role === "Technician Administrator"
            ? values.specialization
            : null,
        };
        if (needsOrgPicker) payload.organization_id = values.organization_id;
        try {
          if (window.api) {
            await window.api.post("/users", payload);
            state.users = await window.api
              .get("/users")
              .catch(() => state.users);
          } else {
            userActions.addUser(payload);
            state.users = userActions.getAllUsers();
          }
        } catch (e) {
          console.error(e);
        }
      }, `Added ${values.name}.`);
      return true;
    },
  });
}

function openEditUserModal(userId, app) {
  const user = app.state.users.find((item) => item.user_id === userId);
  if (!user) {
    showToast("User not found.", "error");
    return;
  }

  // organization_id can only ever be set once it is null — the backend
  // pins it otherwise, the same way a Subscription's tenant is pinned, so
  // an existing link can't be silently reassigned by a PATCH. This is
  // therefore a repair control for a user created with none, not a general
  // "move this account to another organisation" picker.
  const needsOrgPicker = isSuperAdmin() && !user.organization_id;
  const orgs = app.state.organizations || [];

  openModal({
    title: "Edit User",
    confirmLabel: "Save Changes",
    bodyHtml: `
      <form id="editUserForm" class="form-grid">
        <div class="form-field">
          <label for="editUserName">Name</label>
          <input id="editUserName" autocomplete="name" value="${escapeHtml(user.name)}">
          <span class="field-error" data-error-for="name"></span>
        </div>
        <div class="form-field">
          <label for="editUserEmail">Email</label>
          <input id="editUserEmail" autocomplete="email" value="${escapeHtml(user.email)}">
          <span class="field-error" data-error-for="email"></span>
        </div>
        <div class="form-field">
          <label for="editUserPhone">Phone</label>
          <input id="editUserPhone" autocomplete="tel" value="${escapeHtml(user.phone || "")}">
          <span class="field-error" data-error-for="phone"></span>
        </div>
        <div class="form-field">
          <label for="editUserRole">Role</label>
          <select id="editUserRole">
            ${USER_ROLES.map(
              (role) => `
              <option value="${escapeHtml(role)}" ${role === user.role ? "selected" : ""}>${escapeHtml(role)}</option>
            `,
            ).join("")}
          </select>
          <span class="field-error" data-error-for="role"></span>
        </div>
        ${
          needsOrgPicker
            ? `<div class="form-field">
                 <label for="editUserOrg">Organisation</label>
                 <select id="editUserOrg">
                   <option value="" disabled selected hidden>Select an organisation</option>
                   ${orgs
                     .map(
                       (o) =>
                         `<option value="${escapeHtml(o.organization_id)}">${escapeHtml(o.name)}</option>`,
                     )
                     .join("")}
                 </select>
                 <span class="field-error" data-error-for="organization_id"></span>
                 <p class="muted-cell" style="margin-top:6px">
                   This account has no organisation. Pick one to link it —
                   this can only be done once.
                 </p>
               </div>`
            : ""
        }
        <div class="form-field">
          <label for="editSpecialization">Specialization</label>
          <input id="editSpecialization" value="${escapeHtml(user.specialization || "")}" placeholder="Required for Technicians">
          <span class="field-error" data-error-for="specialization"></span>
        </div>
        <div class="form-field">
          <label for="editPassword">Password</label>
          <input id="editPassword" type="password" autocomplete="new-password" value="${escapeHtml(user.password || "")}" placeholder="Minimum 8 characters">
          <span class="field-error" data-error-for="password"></span>
        </div>
      </form>
    `,
    onConfirm: (modal) => {
      const values = formValues(modal, {
        name: "#editUserName",
        email: "#editUserEmail",
        phone: "#editUserPhone",
        role: "#editUserRole",
        organization_id: "#editUserOrg",
        specialization: "#editSpecialization",
        password: "#editPassword",
      });
      const errors = validateUserEdit(values, app.state.users, userId);
      if (needsOrgPicker && !values.organization_id) {
        errors.organization_id = "Select an organisation to link this account to.";
      }

      if (Object.keys(errors).length > 0) {
        showFormErrors(modal, errors);
        return false;
      }

      app.update(async (state) => {
        const payload = {
          name: values.name,
          email: values.email.toLowerCase(),
          phone: values.phone.trim(),
          password: values.password,
          role: values.role,
          specialization:
            values.role === "Technician" || values.role === "Technician Administrator"
            ? values.specialization
            : null,
        };
        if (needsOrgPicker) payload.organization_id = values.organization_id;
        try {
          if (window.api) {
            await window.api.patch("/users/" + userId, payload);
            state.users = await window.api
              .get("/users")
              .catch(() => state.users);
          } else {
            const updatedUser = state.users.find(
              (item) => item.user_id === userId,
            );
            if (updatedUser) Object.assign(updatedUser, payload);

            const globalUser = universalDB.data.users.find(
              (item) => item.user_id === userId,
            );
            if (globalUser) Object.assign(globalUser, payload);

            state.users = userActions.getAllUsers();
          }
        } catch (e) {
          console.error(e);
        }
        updateCurrentUserSession(userId, values);
      }, `Updated ${values.name}.`);
      return true;
    },
  });
}

function deleteUser(userId, app) {
  const user = app.state.users.find((item) => item.user_id === userId);
  if (!user) {
    showToast("User not found.", "error");
    return;
  }

  try {
    const current = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (current.user_id === userId || current.id === userId) {
      showToast("You cannot delete your own account.", "error");
      return;
    }
  } catch (_) {}

  openModal({
    title: "Delete User",
    confirmLabel: "Delete",
    danger: true,
    bodyHtml: `<p>Delete <strong>${escapeHtml(user.name)}</strong> from the User mock table?</p>`,
    onConfirm: () => {
      app.update(async (state) => {
        try {
          if (window.api) {
            await window.api.delete("/users/" + userId);
            state.users = await window.api
              .get("/users")
              .catch(() => state.users);
          } else {
            userActions.deleteUser(userId);
            state.users = userActions.getAllUsers();
          }
        } catch (e) {
          console.error(e);
        }
      }, `Deleted ${user.name}.`);
      return true;
    },
  });
}

function validateUser(values, existingUsers, options = {}) {
  const errors = {};

  // A Super Admin has no tenant of their own to fall back on, so this is
  // the one place that link gets made. Skipping it silently is exactly
  // what produced an Organization Admin belonging to no organisation.
  if (options.requireOrg && !values.organization_id) {
    errors.organization_id = "Select which organisation this user belongs to.";
  }

  if (!values.name || values.name.length < 2)
    errors.name = "Enter a name with at least 2 characters.";
  if (!values.email) errors.email = "Email is required.";
  else if (!isEmail(values.email))
    errors.email = "Enter a valid email address.";
  else if (!isGmailAddress(values.email))
    errors.email = "Only gmail.com email addresses are allowed.";
  else if (
    existingUsers.some(
      (user) => user.email.toLowerCase() === values.email.toLowerCase(),
    )
  ) {
    errors.email = "A user with this email already exists.";
  }
  const phoneError = getPhoneValidationError(values.phone);
  if (phoneError) errors.phone = phoneError;
  if (
    !errors.phone &&
    existingUsers.some(
      (user) => user.phone && user.phone === values.phone.trim(),
    )
  ) {
    errors.phone = "A user with this phone number already exists.";
  }
  if (!USER_ROLES.includes(values.role))
    errors.role = "Select a valid DB role.";
  if (
    (values.role === "Technician" || values.role === "Technician Administrator") &&
    values.specialization.length < 2
  ) {
    errors.specialization = "Technician specialization is required.";
  }
  if (!values.password || values.password.length < 8)
    errors.password = "Temporary password must be at least 8 characters.";

  return errors;
}

function validateUserEdit(values, existingUsers, userId) {
  const errors = {};

  if (!values.name || values.name.length < 2)
    errors.name = "Enter a name with at least 2 characters.";
  if (!values.email) errors.email = "Email is required.";
  else if (!isEmail(values.email))
    errors.email = "Enter a valid email address.";
  else if (!isGmailAddress(values.email))
    errors.email = "Only gmail.com email addresses are allowed.";
  else if (
    existingUsers.some(
      (user) =>
        user.user_id !== userId &&
        user.email.toLowerCase() === values.email.toLowerCase(),
    )
  ) {
    errors.email = "A user with this email already exists.";
  }
  const phoneError = getPhoneValidationError(values.phone);
  if (phoneError) errors.phone = phoneError;
  if (
    !errors.phone &&
    existingUsers.some(
      (user) =>
        user.user_id !== userId &&
        user.phone &&
        user.phone === values.phone.trim(),
    )
  ) {
    errors.phone = "A user with this phone number already exists.";
  }
  if (!USER_ROLES.includes(values.role))
    errors.role = "Select a valid DB role.";
  if (
    (values.role === "Technician" || values.role === "Technician Administrator") &&
    values.specialization.length < 2
  ) {
    errors.specialization = "Technician specialization is required.";
  }
  if (!values.password || values.password.length < 8)
    errors.password = "Password must be at least 8 characters.";

  return errors;
}

function isGmailAddress(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(String(email || "").trim());
}

function getPhoneValidationError(phone) {
  const normalizedPhone = String(phone || "").trim();

  if (normalizedPhone.length === 0) return "Phone number is required.";
  if (!/^[0-9]+$/.test(normalizedPhone)) return "Only digits are allowed.";
  if (normalizedPhone.length !== 10)
    return "Phone number must be exactly 10 digits.";
  if (normalizedPhone === "0000000000")
    return "Phone number cannot be all zeros.";
  if (/^(\d)\1{9}$/.test(normalizedPhone))
    return "Phone number cannot repeat the same digit.";

  return "";
}

function updateCurrentUserSession(userId, values) {
  const stored = localStorage.getItem("currentUser");
  if (!stored) return;

  try {
    const currentUser = JSON.parse(stored);
    if (currentUser.user_id !== userId && currentUser.id !== userId) return;

    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        ...currentUser,
        name: values.name,
        email: values.email.toLowerCase(),
        phone: values.phone.trim(),
        password: values.password,
        role: values.role,
        specialization:
          values.role === "Technician" || values.role === "Technician Administrator"
            ? values.specialization
            : null,
      }),
    );
  } catch (e) {
    console.error("Failed to update current user session", e);
  }
}
