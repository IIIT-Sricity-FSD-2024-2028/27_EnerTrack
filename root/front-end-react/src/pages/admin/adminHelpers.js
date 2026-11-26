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
  "Operations Coordinator",
  "Sustainability Officer",
  "Campus Visitor",
  "Certified Energy Auditor",
];

// Roles that belong to EnerTrack itself, not to a client organisation.
// Such a user has no organisation, so the form never asks for one.
export const PLATFORM_SIDE_ROLES = ["Certified Energy Auditor"];

// The roles the signed-in person may give someone. Only a Super Admin may give
// an EnerTrack staff role (the backend enforces this too; hiding the option
// just stops an Organization Admin choosing something that would be refused).
export function assignableRoles(isSuperAdmin) {
  return USER_ROLES.filter(
    (role) => isSuperAdmin || !PLATFORM_SIDE_ROLES.includes(role),
  );
}

// The trades a technician can belong to. The system only sends a job to
// someone on the matching team; "" means no automatic jobs.
export const TEAMS = [
  { value: "electrician", label: "Electrician" },
  { value: "plumber", label: "Plumber" },
  { value: "general", label: "General Maintenance" },
  { value: "hvac", label: "HVAC (AC and cooling)" },
];

export const teamLabel = (value) => TEAMS.find((t) => t.value === value)?.label || "";

// Friendly names for a few stored values; anything else is shown as it is
const LABELS = {
  systemAdministrator: "Organization Admin",
  financeAnalyst: "Finance Analyst",
  sustainabilityOfficer: "Sustainability Officer",
  technicianAdministrator: "Operations Coordinator",
  technician: "Technician",
  campusVisitor: "Occupant",
  "Campus Visitor": "Occupant", // stored role value; shown as Occupant
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
 * True when a dispatched load thunk (fetchUsers(), fetchOrganizations(), ...)
 * really failed. A load skipped because the list is already there also
 * comes back as a rejected action, with meta.condition set; that is not a
 * failure. (So never .unwrap() a cached fetch: a skipped one would throw.)
 */
export function loadFailed(result) {
  return Boolean(result?.error) && !result.meta?.condition;
}

/**
 * Checks the Add / Edit User form. Returns { field: message } for every
 * field that is wrong, or {} when everything is fine. Every text rule is the
 * same regular expression the backend enforces (see auth/validators.js).
 *
 *   values       { name, email, phone, role, team, password }
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

  // A technician is only sent jobs for their own team, so it is required.
  if (values.role === "Technician" && !TEAMS.some((t) => t.value === values.team)) {
    errors.team = "Select the technician's team.";
  }

  // A new account needs a password. When editing, a blank one means "leave it".
  if (!editingId || values.password !== "") {
    const passwordError = validators.password(values.password);
    if (passwordError) errors.password = passwordError;
  }

  return errors;
}

/**
 * Does a row match what was typed in a search box?
 *
 * Every word typed has to appear somewhere in the row (case-insensitive), so
 * "priya admin" finds Priya Nair, Super Admin. An empty box matches everything.
 * `fields` are the row's searchable values; blanks and nulls are ignored.
 */
export function matchesSearch(query, fields) {
  const words = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}
