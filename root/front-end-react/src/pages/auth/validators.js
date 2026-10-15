/**
 * validators.js — the rules for every field on the auth screens and the admin
 * account forms, as plain functions.
 *
 * Each validator takes the field's value (and all current values, for rules
 * that compare two fields) and returns an error message, or "" if the value
 * is fine. Nothing here knows about React, so each function can be read and
 * checked on its own.
 *
 * Every text rule is a regular expression, and each one is the twin of a rule
 * in backend/src/common/patterns.ts. These run for fast feedback; the
 * backend re-checks everything, because anyone can call the API directly.
 * When you change a pattern here, change it there too.
 */

export const PATTERNS = {
  // Starts with a letter; letters, digits and single spaces; no edge spaces.
  name: /^[A-Za-z][A-Za-z0-9]*(?: [A-Za-z0-9]+)*$/,
  // local part @ dot-separated labels . letters-only TLD (2+), no `..`.
  email:
    /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/,
  // Exactly 10 digits, not all zeros.
  phone: /^(?!0{10}$)\d{10}$/,
  // 8-32 characters with upper, lower, digit and a special character.
  password: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,32}$/,
  // "St. Mary's College (North)"
  orgName: /^[A-Za-z0-9][A-Za-z0-9 .,&'()-]{1,98}[A-Za-z0-9.)]$/,
  // "Corporate Campus", "Electrical"
  label: /^[A-Za-z][A-Za-z &/-]{1,59}$/,
  // "Sri City, Andhra Pradesh"
  location: /^[A-Za-z0-9][A-Za-z0-9 .,'/()-]{1,118}$/,
  // A bare hostname such as iiits.in
  emailDomain: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
  // Whole or decimal number with at most two decimals
  area: /^\d{1,9}(?:\.\d{1,2})?$/,
};

/** Public mailbox providers say nothing about which organisation owns an address. */
export const FREE_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "rediffmail.com",
];

export const ORG_TYPES = [
  "University",
  "Engineering College",
  "Polytechnic",
  "School",
  "Corporate Campus",
  "Hospital",
  "Other",
];

const NAME_MIN = 2;
const NAME_MAX = 50;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 32;

function name(value) {
  if (value === "") return "Name is required.";
  if (/^\s|\s$/.test(value)) return "Name must not start or end with a space.";
  if (value.length < NAME_MIN)
    return `Name must be at least ${NAME_MIN} characters.`;
  if (value.length > NAME_MAX)
    return `Name must not exceed ${NAME_MAX} characters.`;
  if (!/^[A-Za-z]/.test(value)) return "Name must start with a letter.";
  if (!/^[A-Za-z0-9 ]+$/.test(value))
    return "Name can only contain letters, numbers, and spaces.";
  if (/ {2}/.test(value)) return "Name must not contain consecutive spaces.";
  return "";
}

function email(value) {
  const v = value.trim();
  if (v === "") return "Email is required.";
  if (v.length > EMAIL_MAX)
    return `Email must not exceed ${EMAIL_MAX} characters.`;
  if (/\s/.test(v)) return "Email must not contain spaces.";
  if (v.includes("..")) return "Email must not contain consecutive dots.";
  if (!PATTERNS.email.test(v)) return "Please enter a valid email address.";
  return "";
}

/** The email also has to sit on the organisation's domain, when it has one. */
export function emailOnDomain(value, domain) {
  const problem = email(value);
  if (problem) return problem;
  if (domain && value.trim().toLowerCase().split("@")[1] !== domain)
    return `Use an @${domain} address.`;
  return "";
}

function phone(value) {
  if (value === "") return "Phone number is required.";
  if (!/^\d+$/.test(value)) return "Only digits are allowed.";
  if (value.length !== 10) return "Phone number must be exactly 10 digits.";
  if (!PATTERNS.phone.test(value)) return "Phone number cannot be all zeros.";
  return "";
}

function optionalPhone(value) {
  return value === "" ? "" : phone(value);
}

function password(value) {
  if (value === "") return "Password is required.";
  if (value.length < PASSWORD_MIN)
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (value.length > PASSWORD_MAX)
    return `Password must not exceed ${PASSWORD_MAX} characters.`;
  if (!PATTERNS.password.test(value))
    return "Needs: 1 uppercase, 1 lowercase, 1 number, and 1 special character.";
  return "";
}

// Sign-in accepts any existing password: older accounts predate the strength
// rule, and telling someone their *current* password is "too weak" helps no one.
function loginPassword(value) {
  if (value === "") return "Password is required.";
  if (value.length > 128) return "Password must not exceed 128 characters.";
  return "";
}

function loginEmail(value) {
  return email(value);
}

// The second argument is every current value, so this can compare two fields.
function confirmPassword(value, values) {
  if (value === "") return "Confirm your password.";
  if (value !== values.password) return "Passwords do not match.";
  return "";
}

function orgName(value) {
  const v = value.trim();
  if (v === "") return "Organisation name is required.";
  if (v.length < 3) return "Organisation name must be at least 3 characters.";
  if (v.length > 100) return "Organisation name must not exceed 100 characters.";
  if (!PATTERNS.orgName.test(v))
    return "Use letters, numbers, spaces and . , & ' ( ) - only.";
  return "";
}

function orgType(value) {
  return value === "" ? "Please select a type." : "";
}

function orgLocation(value) {
  const v = value.trim();
  if (v === "") return "Location is required.";
  if (!PATTERNS.location.test(v))
    return "Use 2-120 characters: letters, numbers, spaces and . , ' / ( ) -";
  return "";
}

function orgArea(value) {
  const v = value.trim();
  if (v === "") return ""; // optional
  if (!PATTERNS.area.test(v))
    return "Enter a positive number, with at most 2 decimals.";
  if (Number(v) < 1) return "Floor area must be at least 1.";
  return "";
}

function emailDomain(value) {
  const v = value.trim();
  if (v === "") return ""; // optional
  if (!PATTERNS.emailDomain.test(v))
    return "Enter a domain like example.edu (lowercase, no @ or https://).";
  if (FREE_EMAIL_DOMAINS.includes(v))
    return "Use your organisation's own domain, not a public mailbox provider.";
  return "";
}

function specialization(value) {
  const v = value.trim();
  if (v === "") return "";
  return PATTERNS.label.test(v)
    ? ""
    : "Use 2-60 characters: letters, spaces and & / -";
}

// Admin fields on the register form reuse the person rules, with their own
// wording, and the email must match the organisation's domain when given.
function adminEmail(value, values) {
  return emailOnDomain(value, (values.emailDomain || "").trim().toLowerCase());
}

function newPassword(value, values) {
  const problem = password(value);
  if (problem) return problem;
  if (values.currentPassword && value === values.currentPassword)
    return "Choose a password different from the current one.";
  return "";
}

function confirmNewPassword(value, values) {
  if (value === "") return "Confirm your new password.";
  if (value !== values.newPassword) return "Passwords do not match.";
  return "";
}

// Keyed by the same names the form fields use, so one lookup does the job:
//   validators[fieldName](value, allValues)
export const validators = {
  name,
  email,
  phone,
  password,
  confirmPassword,
  loginEmail,
  loginPassword,
  orgName,
  orgType,
  orgLocation,
  orgArea,
  emailDomain,
  adminName: name,
  adminEmail,
  adminPhone: optionalPhone,
  adminPassword: password,
  confirmAdminPassword: (value, values) =>
    value === ""
      ? "Confirm your password."
      : value !== values.adminPassword
        ? "Passwords do not match."
        : "",
  currentPassword: loginPassword,
  newPassword,
  confirmNewPassword,
  specialization,
  optionalPhone,
};

/**
 * Runs the validators for `fields` against `values` and returns
 * { field: message } for each one that fails ({} when all pass).
 */
export function validateFields(fields, values) {
  const errors = {};
  for (const field of fields) {
    const message = validators[field](values[field] ?? "", values);
    if (message) errors[field] = message;
  }
  return errors;
}
