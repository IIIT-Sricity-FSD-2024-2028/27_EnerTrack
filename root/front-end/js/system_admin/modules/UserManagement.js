import { createId, mockHashPassword, USER_ROLES } from "../data/mockData.js";
import { escapeHtml, formValues, formatLabel, isEmail, openModal, showFormErrors, showToast } from "../utils/ui.js";

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
  container.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () => deleteUser(button.dataset.deleteUser, app));
  });
}

function renderUserRow(user) {
  return `
    <tr>
      <td><strong>${escapeHtml(user.name)}</strong><div class="muted-cell">${escapeHtml(user.user_id)}</div></td>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.phone || "-")}</td>
      <td>${escapeHtml(formatLabel(user.role))}</td>
      <td>${escapeHtml(user.specialization || "-")}</td>
      <td>
        <div class="row-actions">
          <button class="btn-outline btn-danger" type="button" data-delete-user="${escapeHtml(user.user_id)}">Delete</button>
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
          <input id="userEmail" autocomplete="email" placeholder="name@enertrack.edu">
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

      app.update((state) => {
        state.users.push({
          user_id: createId("user"),
          name: values.name,
          email: values.email.toLowerCase(),
          phone: values.phone || null,
          password: mockHashPassword(values.password),
          role: values.role,
          specialization: values.role === "Technician" ? values.specialization : null
        });
      }, `Added ${values.name}.`);
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

  openModal({
    title: "Delete User",
    confirmLabel: "Delete",
    danger: true,
    bodyHtml: `<p>Delete <strong>${escapeHtml(user.name)}</strong> from the User mock table?</p>`,
    onConfirm: () => {
      app.update((state) => {
        state.users = state.users.filter((item) => item.user_id !== userId);
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
  else if (existingUsers.some((user) => user.email.toLowerCase() === values.email.toLowerCase())) {
    errors.email = "A user with this email already exists.";
  }
  if (values.phone && !/^[0-9+\-\s]{7,20}$/.test(values.phone)) errors.phone = "Enter a valid phone number.";
  if (values.phone && existingUsers.some((user) => user.phone && user.phone === values.phone)) {
    errors.phone = "A user with this phone number already exists.";
  }
  if (!USER_ROLES.includes(values.role)) errors.role = "Select a valid DB role.";
  if (values.role === "Technician" && values.specialization.length < 2) {
    errors.specialization = "Technician specialization is required.";
  }
  if (!values.password || values.password.length < 8) errors.password = "Temporary password must be at least 8 characters.";

  return errors;
}
