/**
 * adminHelpers.js — fixed lists and small helpers shared by the admin pages.
 * Plain JavaScript, no React.
 *
 * Taken from js/system_admin/data/mockData.js, js/system_admin/utils/ui.js
 * and js/system_admin/modules/UserManagement.js. (The meter lists and labels
 * there belong to the Infrastructure page, which is not part of these pages.)
 */

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

// Something@something.something
export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// "" when the phone number is fine, otherwise what is wrong with it
export function getPhoneError(phone) {
  const number = String(phone || "").trim();

  if (number.length === 0) return "Phone number is required.";
  if (!/^[0-9]+$/.test(number)) return "Only digits are allowed.";
  if (number.length !== 10) return "Phone number must be exactly 10 digits.";
  if (number === "0000000000") return "Phone number cannot be all zeros.";
  if (/^(\d)\1{9}$/.test(number)) {
    return "Phone number cannot repeat the same digit.";
  }
  return "";
}

/**
 * Checks the Add / Edit User form. Returns { field: message } for every
 * field that is wrong, or {} when everything is fine.
 *
 *   values     { name, email, phone, role, specialization, password }
 *              (already trimmed)
 *   users      every existing user, to catch a repeated email or phone
 *   editingId  the id of the user being edited, or null when adding;
 *              that user is skipped in the "already exists" checks
 */
export function getUserErrors(values, users, editingId) {
  const errors = {};
  const others = users.filter((user) => user.user_id !== editingId);

  if (!values.name || values.name.length < 2) {
    errors.name = "Enter a name with at least 2 characters.";
  }

  if (!values.email) {
    errors.email = "Email is required.";
  } else if (!isEmail(values.email)) {
    errors.email = "Enter a valid email address.";
  } else if (
    others.some(
      (user) => user.email.toLowerCase() === values.email.toLowerCase(),
    )
  ) {
    errors.email = "A user with this email already exists.";
  }

  const phoneError = getPhoneError(values.phone);
  if (phoneError) {
    errors.phone = phoneError;
  } else if (others.some((user) => user.phone && user.phone === values.phone)) {
    errors.phone = "A user with this phone number already exists.";
  }

  if (!USER_ROLES.includes(values.role)) {
    errors.role = "Select a valid DB role.";
  }

  if (
    TECHNICIAN_ROLES.includes(values.role) &&
    values.specialization.length < 2
  ) {
    errors.specialization = "Technician specialization is required.";
  }

  if (!values.password || values.password.length < 8) {
    errors.password = editingId
      ? "Password must be at least 8 characters."
      : "Temporary password must be at least 8 characters.";
  }

  return errors;
}
