/**
 * adminHelpers.js — fixed lists and small helpers shared by the admin pages.
 * Plain JavaScript, no React.
 *
 * Taken from js/system_admin/data/mockData.js, js/system_admin/utils/ui.js
 * and js/system_admin/modules/UserManagement.js. (The meter lists and labels
 * there belong to the Infrastructure page, which is not part of these pages.)
 */

import { emailOnDomain, validators } from "../auth/validators";

// Every role a user can be given, in the order the dropdowns show them
export const USER_ROLES = [
  "Organization Admin",
  "Financial Analyst",
  "Technician",
  "Technician Administrator",
  "Sustainability Officer",
  "Campus Visitor",
  "Certified Energy Auditor",
];

// Roles that belong to EnerTrack itself, not to a client organisation.
// Such a user has no organisation, so the form never asks for one.
export const PLATFORM_SIDE_ROLES = ["Certified Energy Auditor"];

// Roles that must have a specialization (e.g. "Electrical")
export const TECHNICIAN_ROLES = ["Technician", "Technician Administrator"];

// Friendly names for a few stored values; anything else is shown as it is
const LABELS = {
  systemAdministrator: "Organization Admin",
  financeAnalyst: "Finance Analyst",
  sustainabilityOfficer: "Sustainability Officer",
  technicianAdministrator: "Technician Administrator",
  technician: "Technician",
  campusVisitor: "Campus Visitor",
  active: "Active",
  inactive: "Inactive",
};

export function formatLabel(value) {
  return LABELS[value] || value;
}

// 12000 -> "₹12,000" (Indian digit grouping, no paise)
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

/**
 * Shows a toast for 3 seconds. Each page keeps its own list of toasts in
 * state and passes its setter here:  addToast(setToasts, "Saved.", "success")
 * type: "info" (dark), "success" (green), "warning" (amber), "error" (red).
 *
 * The setter is given a function (list) => newList instead of a new list:
 * the removal runs 3 seconds later, when the list may already hold other
 * toasts, and this form always works on the latest list.
 */
export function addToast(setToasts, message, type = "info") {
  const id = Date.now() + Math.random(); // unique enough to be a React key
  setToasts((list) => [...list, { id, message, type }]);
  setTimeout(() => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, 3000);
}

/**
 * Checks the Add / Edit User form. Returns { field: message } for every
 * field that is wrong, or {} when everything is fine. Every text rule is the
 * same regular expression the backend enforces (see auth/validators.js).
 *
 *   values       { name, email, phone, role, specialization, password }
 *                (already trimmed)
 *   users        every existing user, to catch a repeated email or phone
 *   editingId    the id of the user being edited, or null when adding;
 *                that user is skipped in the "already exists" checks
 *   emailDomain  the organisation's required mail domain, or "" for none
 */
export function getUserErrors(values, users, editingId, emailDomain = "") {
  const errors = {};
  const others = users.filter((user) => user.user_id !== editingId);

  const nameError = validators.name(values.name);
  if (nameError) errors.name = nameError;

  const emailError = emailOnDomain(values.email, emailDomain);
  if (emailError) {
    errors.email = emailError;
  } else if (
    others.some(
      (user) => user.email.toLowerCase() === values.email.toLowerCase(),
    )
  ) {
    errors.email = "A user with this email already exists.";
  }

  const phoneError = validators.phone(values.phone);
  if (phoneError) {
    errors.phone = phoneError;
  } else if (others.some((user) => user.phone && user.phone === values.phone)) {
    errors.phone = "A user with this phone number already exists.";
  }

  if (!USER_ROLES.includes(values.role)) {
    errors.role = "Select a valid role.";
  }

  if (TECHNICIAN_ROLES.includes(values.role) && values.specialization === "") {
    errors.specialization = "Technician specialization is required.";
  } else {
    const specializationError = validators.specialization(
      values.specialization,
    );
    if (specializationError) errors.specialization = specializationError;
  }

  // A new account needs a password. When editing, a blank one means "leave it".
  if (!editingId || values.password !== "") {
    const passwordError = validators.password(values.password);
    if (passwordError) errors.password = passwordError;
  }

  return errors;
}
