/**
 * UserFormModal — the "Add User" / "Edit User" popup on /admin/users.
 *
 * A controlled form inside <Modal>. On confirm it checks the fields; if
 * anything is wrong the errors appear under the fields and the popup stays
 * open. If all is fine it hands the finished user UP to the parent through
 * `onSave`. The parent (Users.jsx) sends it to the backend.
 *
 * Props:
 *   user           the user being edited, or null to add a new one
 *   users          every user, to catch a repeated email / phone
 *   organizations  for the Organisation dropdown
 *   isSuperAdmin   only a Super Admin picks an organisation (see below)
 *   defaultOrgId   the signed-in admin's own organisation (an Organization
 *                  Admin creates accounts only inside it)
 *   onSave         called with the data to send to the backend
 *   onClose        closes the popup
 *
 * Replaces openAddUserModal() and openEditUserModal() in
 * js/system_admin/modules/UserManagement.js.
 */
import { useState } from "react";
import api from "../../api/client";
import Modal from "./Modal";
import {
  assignableRoles,
  getUserErrors,
  PLATFORM_SIDE_ROLES,
  TECHNICIAN_ROLES,
  USER_ROLES,
  formatLabel,
} from "./adminHelpers";

export default function UserFormModal({
  user,
  users,
  organizations,
  isSuperAdmin,
  defaultOrgId,
  onSave,
  onClose,
}) {
  const isEdit = user !== null;

  // Everything typed, in one object. The backend never sends passwords, so
  // the password starts empty even when editing (as in the original).
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    role: user?.role || USER_ROLES[0],
    organization_id: "",
    specialization: user?.specialization || "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [generating, setGenerating] = useState(false);

  // The organisation this account will belong to decides the email domain it
  // must use. A Super Admin picks it in the form; an Organization Admin is
  // fixed to their own.
  const targetOrgId = isSuperAdmin
    ? form.organization_id || user?.organization_id
    : defaultOrgId;
  const emailDomain =
    organizations.find((o) => o.organization_id === targetOrgId)
      ?.email_domain || "";

  // When is there an Organisation dropdown?
  //  - Adding: a Super Admin has no organisation of their own to put the new
  //    user in, so they must pick one — unless the role is EnerTrack's own
  //    (Certified Energy Auditor), which never belongs to an organisation.
  //    An Organization Admin never picks: the backend uses their own.
  //  - Editing: only to repair a client user saved with no organisation.
  //    The backend allows setting it once, never changing it.
  const showOrgPicker = isEdit
    ? isSuperAdmin &&
      !user.organization_id &&
      !PLATFORM_SIDE_ROLES.includes(user.role)
    : isSuperAdmin && !PLATFORM_SIDE_ROLES.includes(form.role);

  // One handler for every field: the input's `name` says which one changed
  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  // Asks the backend for a random one-time password that satisfies the rule
  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await api.post("/users/generate-password", {});
      setForm((prev) => ({ ...prev, password: result.password }));
      setErrors((prev) => ({ ...prev, password: "" }));
      setShowPassword(true);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        password: err.message || "Could not generate a password.",
      }));
    } finally {
      setGenerating(false);
    }
  }

  function handleConfirm() {
    // The original trimmed every value before checking
    const values = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      organization_id: form.organization_id,
      specialization: form.specialization.trim(),
      password: form.password.trim(),
    };

    const newErrors = getUserErrors(
      values,
      users,
      isEdit ? user.user_id : null,
      emailDomain,
    );
    if (showOrgPicker && !values.organization_id) {
      newErrors.organization_id = isEdit
        ? "Select an organisation to link this account to."
        : "Select which organisation this user belongs to.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors); // the popup stays open, showing what is wrong
      return;
    }

    const payload = {
      name: values.name,
      email: values.email.toLowerCase(),
      phone: values.phone,
      role: values.role,
      specialization: TECHNICIAN_ROLES.includes(values.role)
        ? values.specialization
        : null,
    };
    // Editing: a blank password means "keep the current one"
    if (values.password) payload.password = values.password;
    if (showOrgPicker) payload.organization_id = values.organization_id;

    onSave(payload);
  }

  // Ids and placeholders differ between Add and Edit, as in the original
  const id = isEdit
    ? {
        name: "editUserName",
        email: "editUserEmail",
        phone: "editUserPhone",
        role: "editUserRole",
        org: "editUserOrg",
        specialization: "editSpecialization",
        password: "editPassword",
      }
    : {
        name: "userName",
        email: "userEmail",
        phone: "userPhone",
        role: "userRole",
        org: "userOrg",
        specialization: "specialization",
        password: "tempPassword",
      };

  return (
    <Modal
      title={isEdit ? "Edit User" : "Add User"}
      confirmLabel={isEdit ? "Save Changes" : "Add User"}
      onConfirm={handleConfirm}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
        <div className="form-field">
          <label htmlFor={id.name}>Name</label>
          <input
            id={id.name}
            name="name"
            autoComplete="name"
            maxLength={50}
            placeholder={isEdit ? undefined : "Teja Rao"}
            value={form.name}
            onChange={handleChange}
          />
          <span className="field-error">{errors.name}</span>
        </div>

        <div className="form-field">
          <label htmlFor={id.email}>Email</label>
          <input
            id={id.email}
            name="email"
            autoComplete="email"
            placeholder={
              isEdit
                ? undefined
                : emailDomain
                  ? `name@${emailDomain}`
                  : "name@example.com"
            }
            maxLength={254}
            value={form.email}
            onChange={handleChange}
          />
          <span className="field-error">{errors.email}</span>
          {emailDomain && (
            <p className="muted-cell" style={{ marginTop: "6px" }}>
              This organisation's accounts use @{emailDomain}.
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor={id.phone}>Phone</label>
          <input
            id={id.phone}
            name="phone"
            autoComplete="tel"
            maxLength={10}
            placeholder={isEdit ? undefined : "9876543210"}
            value={form.phone}
            onChange={handleChange}
          />
          <span className="field-error">{errors.phone}</span>
        </div>

        <div className="form-field">
          <label htmlFor={id.role}>Role</label>
          <select
            id={id.role}
            name="role"
            value={form.role}
            onChange={handleChange}
          >
            {/* Only a Super Admin is offered Certified Energy Auditor. */}
            {assignableRoles(isSuperAdmin).map((role) => (
              <option key={role} value={role}>
                {formatLabel(role)}
              </option>
            ))}
          </select>
          <span className="field-error">{errors.role}</span>
        </div>

        {showOrgPicker && (
          <div className="form-field">
            <label htmlFor={id.org}>Organisation</label>
            <select
              id={id.org}
              name="organization_id"
              value={form.organization_id}
              onChange={handleChange}
            >
              <option value="" disabled hidden>
                Select an organisation
              </option>
              {organizations.map((org) => (
                <option key={org.organization_id} value={org.organization_id}>
                  {org.name}
                </option>
              ))}
            </select>
            <span className="field-error">{errors.organization_id}</span>
            {isEdit && (
              <p className="muted-cell" style={{ marginTop: "6px" }}>
                This account has no organisation. Pick one to link it — this can
                only be done once.
              </p>
            )}
          </div>
        )}

        <div className="form-field">
          <label htmlFor={id.specialization}>Specialization</label>
          {/* Only technicians have a specialization, so the box is locked for
              every other role (it would not be saved anyway). */}
          <input
            id={id.specialization}
            name="specialization"
            placeholder="Required for Technicians"
            disabled={!TECHNICIAN_ROLES.includes(form.role)}
            value={form.specialization}
            onChange={handleChange}
          />
          <span className="field-error">{errors.specialization}</span>
        </div>

        <div className="form-field">
          <label htmlFor={id.password}>
            {isEdit ? "Reset password (optional)" : "Temporary Password"}
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              id={id.password}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={isEdit ? "Leave blank to keep" : "8-32 characters"}
              maxLength={32}
              style={{ flex: 1, minWidth: 0 }}
              value={form.password}
              onChange={handleChange}
            />
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? "…" : "Generate"}
            </button>
          </div>
          <span className="field-error">{errors.password}</span>
          <p className="muted-cell" style={{ marginTop: "6px" }}>
            8-32 characters with an uppercase letter, a lowercase letter, a
            number and a special character. The person must replace it when
            they first sign in.
          </p>
        </div>
      </form>
    </Modal>
  );
}
