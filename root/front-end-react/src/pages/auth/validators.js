/**
 * validators.js — the sign-up rules, as plain functions.
 *
 * Each validator takes the field's value (and all current values, for rules
 * that compare two fields) and returns an error message, or "" if the value
 * is fine. Nothing here knows about React, so each function can be read and
 * checked on its own.
 *
 * The rules are the same ones sign_up.js enforced, written as regular
 * expressions instead of character-by-character loops.
 */

const NAME_MIN = 2;
const NAME_MAX = 50;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 32;

// Roles the backend accepts for self-registration (SELF_REGISTERABLE_ROLES).
export const SELF_REGISTER_ROLES = [
  "Campus Visitor",
  "Financial Analyst",
  "Technician",
  "Technician Administrator",
  "Sustainability Officer",
];

// local part @ one or more dot-separated labels . letters-only TLD (2+)
const EMAIL_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

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
  if (!EMAIL_PATTERN.test(v)) return "Please enter a valid email address.";
  return "";
}

function phone(value) {
  if (value === "") return "Phone number is required.";
  if (!/^\d+$/.test(value)) return "Only digits are allowed.";
  if (value.length !== 10) return "Phone number must be exactly 10 digits.";
  if (value === "0000000000") return "Phone number cannot be all zeros.";
  return "";
}

function password(value) {
  if (value === "") return "Password is required.";
  if (value.length < PASSWORD_MIN)
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (value.length > PASSWORD_MAX)
    return `Password must not exceed ${PASSWORD_MAX} characters.`;
  const hasAll =
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9\s]/.test(value);
  if (!hasAll)
    return "Needs: 1 uppercase, 1 lowercase, 1 number, and 1 special character.";
  return "";
}

// The second argument is every current value, so this can compare two fields.
function confirmPassword(value, values) {
  if (value === "") return "Confirm password is required.";
  if (value !== values.password) return "Passwords do not match.";
  return "";
}

function role(value) {
  return value === "" ? "Please select a role." : "";
}

function organization_id(value) {
  return value === "" ? "Please select your organisation." : "";
}

// Keyed by the same names the form fields use, so one lookup does the job:
//   validators[fieldName](value, allValues)
export const validators = {
  name,
  email,
  phone,
  password,
  confirmPassword,
  role,
  organization_id,
};
