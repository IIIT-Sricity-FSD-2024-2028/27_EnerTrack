import { userActions, USER_ROLES } from "../data/mockData.js";
import { escapeHtml, formValues, formatLabel, isEmail, openModal, showFormErrors, showToast } from "../utils/ui.js";
import universalDB from "../../shared/universalDB.js";

export function renderUserManagement(container, app) {
  const rows = app.state.users.map(renderUserRow).join("");

  container.innerHTML = `
    <section class="dashboard-section">
      <div class="section-toolbar">
        <div>
          <h2>User Management</h2>
          <p>Uses the backend User table shape: user_id, name, email, phone, password, role, specialization.</p>
        </div>
        <button class="btn-dark" type="button" data-action="add-user">Add User</button>
      </div>

      <div class="table-card">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Specialization</th>
                <th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="6"><div class="empty-state">No users found.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  container.querySelector('[data-action="add-user"]')?.addEventListener("click", () => openAddUserModal(app));
  container.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => openEditUserModal(button.dataset.editUser, app));
  });
  container.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () => deleteUser(button.dataset.deleteUser, app));
  });
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
      <td>${escapeHtml(formatLabel(user.role))}</td>
      <td>${escapeHtml(user.specialization || "-")}</td>
      <td>
        <div class="row-actions">
          <button class="btn-outline" type="button" data-edit-user="${escapeHtml(user.user_id)}">Edit</button>
          <button class="btn-outline btn-danger" type="button" data-delete-user="${escapeHtml(user.user_id)}" ${isCurrentUser ? 'disabled title="You cannot delete your own account"' : ''}>Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function openAddUserModal(app) {
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
        specialization: "#specialization",
        password: "#tempPassword"
      });
      const errors = validateUser(values, app.state.users);

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
          specialization: values.role === "Technician" ? values.specialization : null
        };
        try {
          if (window.api) {
            await window.api.post('/users', payload);
            state.users = await window.api.get('/users').catch(() => state.users);
          } else {
            userActions.addUser(payload);
            state.users = userActions.getAllUsers();
          }
        } catch(e) { console.error(e); }
      }, `Added ${values.name}.`);
      return true;
    }
  });
}

function openEditUserModal(userId, app) {
  const user = app.state.users.find((item) => item.user_id === userId);
  if (!user) {
    showToast("User not found.", "error");
    return;
  }

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
            ${USER_ROLES.map((role) => `
              <option value="${escapeHtml(role)}" ${role === user.role ? "selected" : ""}>${escapeHtml(role)}</option>
            `).join("")}
          </select>
          <span class="field-error" data-error-for="role"></span>
        </div>
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
        specialization: "#editSpecialization",
        password: "#editPassword"
      });
      const errors = validateUserEdit(values, app.state.users, userId);

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
          specialization: values.role === "Technician" ? values.specialization : null
        };
        try {
          if (window.api) {
            await window.api.patch('/users/' + userId, payload);
            state.users = await window.api.get('/users').catch(() => state.users);
          } else {
            const updatedUser = state.users.find((item) => item.user_id === userId);
            if (updatedUser) Object.assign(updatedUser, payload);
            
            const globalUser = universalDB.data.users.find((item) => item.user_id === userId);
            if (globalUser) Object.assign(globalUser, payload);
            
            state.users = userActions.getAllUsers();
          }
        } catch(e) { console.error(e); }
        updateCurrentUserSession(userId, values);
      }, `Updated ${values.name}.`);
      return true;
    }
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
            await window.api.delete('/users/' + userId);
            state.users = await window.api.get('/users').catch(() => state.users);
          } else {
            userActions.deleteUser(userId);
            state.users = userActions.getAllUsers();
          }
        } catch(e) { console.error(e); }
      }, `Deleted ${user.name}.`);
      return true;
    }
  });
}

function validateUser(values, existingUsers) {
  const errors = {};

  if (!values.name || values.name.length < 2) errors.name = "Enter a name with at least 2 characters.";
  if (!values.email) errors.email = "Email is required.";
  else if (!isEmail(values.email)) errors.email = "Enter a valid email address.";
  else if (!isGmailAddress(values.email)) errors.email = "Only gmail.com email addresses are allowed.";
  else if (existingUsers.some((user) => user.email.toLowerCase() === values.email.toLowerCase())) {
    errors.email = "A user with this email already exists.";
  }
  const phoneError = getPhoneValidationError(values.phone);
  if (phoneError) errors.phone = phoneError;
  if (!errors.phone && existingUsers.some((user) => user.phone && user.phone === values.phone.trim())) {
    errors.phone = "A user with this phone number already exists.";
  }
  if (!USER_ROLES.includes(values.role)) errors.role = "Select a valid DB role.";
  if (values.role === "Technician" && values.specialization.length < 2) {
    errors.specialization = "Technician specialization is required.";
  }
  if (!values.password || values.password.length < 8) errors.password = "Temporary password must be at least 8 characters.";

  return errors;
}

function validateUserEdit(values, existingUsers, userId) {
  const errors = {};

  if (!values.name || values.name.length < 2) errors.name = "Enter a name with at least 2 characters.";
  if (!values.email) errors.email = "Email is required.";
  else if (!isEmail(values.email)) errors.email = "Enter a valid email address.";
  else if (!isGmailAddress(values.email)) errors.email = "Only gmail.com email addresses are allowed.";
  else if (existingUsers.some((user) => user.user_id !== userId && user.email.toLowerCase() === values.email.toLowerCase())) {
    errors.email = "A user with this email already exists.";
  }
  const phoneError = getPhoneValidationError(values.phone);
  if (phoneError) errors.phone = phoneError;
  if (!errors.phone && existingUsers.some((user) => user.user_id !== userId && user.phone && user.phone === values.phone.trim())) {
    errors.phone = "A user with this phone number already exists.";
  }
  if (!USER_ROLES.includes(values.role)) errors.role = "Select a valid DB role.";
  if (values.role === "Technician" && values.specialization.length < 2) {
    errors.specialization = "Technician specialization is required.";
  }
  if (!values.password || values.password.length < 8) errors.password = "Password must be at least 8 characters.";

  return errors;
}

function isGmailAddress(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(String(email || "").trim());
}

function getPhoneValidationError(phone) {
  const normalizedPhone = String(phone || "").trim();

  if (normalizedPhone.length === 0) return "Phone number is required.";
  if (!/^[0-9]+$/.test(normalizedPhone)) return "Only digits are allowed.";
  if (normalizedPhone.length !== 10) return "Phone number must be exactly 10 digits.";
  if (normalizedPhone === "0000000000") return "Phone number cannot be all zeros.";
  if (/^(\d)\1{9}$/.test(normalizedPhone)) return "Phone number cannot repeat the same digit.";

  return "";
}

function updateCurrentUserSession(userId, values) {
  const stored = localStorage.getItem("currentUser");
  if (!stored) return;

  try {
    const currentUser = JSON.parse(stored);
    if (currentUser.user_id !== userId && currentUser.id !== userId) return;

    localStorage.setItem("currentUser", JSON.stringify({
      ...currentUser,
      name: values.name,
      email: values.email.toLowerCase(),
      phone: values.phone.trim(),
      password: values.password,
      role: values.role,
      specialization: values.role === "Technician" ? values.specialization : null
    }));
  } catch (e) {
    console.error("Failed to update current user session", e);
  }
}
