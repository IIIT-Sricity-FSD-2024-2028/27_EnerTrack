/**
 * Field patterns shared by every DTO that takes user-typed text.
 *
 * The React app enforces the same rules in
 * front-end-react/src/pages/auth/validators.js. The frontend copy is only
 * for fast feedback; this one is the control, because anyone can POST the
 * API directly. When you change a rule, change both.
 */

/** Starts with a letter; letters, digits and single spaces; no edge spaces. */
export const NAME = /^[A-Za-z][A-Za-z0-9]*(?: [A-Za-z0-9]+)*$/;
export const NAME_MESSAGE =
  "must start with a letter and contain only letters, numbers and single spaces";

const LOCAL = "[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?";
const DOMAIN = "(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\\.)+[A-Za-z]{2,}";
/** local part @ dot-separated labels . letters-only TLD (2+), no `..`. */
export const EMAIL = new RegExp(`^(?!.*\\.\\.)${LOCAL}@${DOMAIN}$`);
export const EMAIL_MESSAGE = "must be a valid email address";

/** Exactly 10 digits, not all zeros. */
export const PHONE = /^(?!0{10}$)\d{10}$/;
export const PHONE_MESSAGE = "must be exactly 10 digits and not all zeros";

/** 8-32 characters with upper, lower, digit and a special character. */
export const PASSWORD =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,32}$/;
export const PASSWORD_MESSAGE =
  "must be 8-32 characters with an uppercase letter, a lowercase letter, a number and a special character";

/** Organisation display name, e.g. "St. Mary's College (North)". */
export const ORG_NAME = /^[A-Za-z0-9][A-Za-z0-9 .,&'()-]{1,98}[A-Za-z0-9.)]$/;
export const ORG_NAME_MESSAGE =
  "must be 3-100 characters: letters, numbers, spaces and . , & ' ( ) -";

/** Organisation type / role-style label, e.g. "Corporate Campus". */
export const LABEL = /^[A-Za-z][A-Za-z &/-]{1,59}$/;
export const LABEL_MESSAGE =
  "must be 2-60 characters: letters, spaces and & / -";

/** Free-text place name, e.g. "Sri City, Andhra Pradesh". */
export const LOCATION = /^[A-Za-z0-9][A-Za-z0-9 .,'/()-]{1,118}$/;
export const LOCATION_MESSAGE =
  "must be 2-120 characters: letters, numbers, spaces and . , ' / ( ) -";

/** A bare hostname such as `iiits.in` (no scheme, no @, no path). */
export const EMAIL_DOMAIN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
export const EMAIL_DOMAIN_MESSAGE =
  "must be a domain such as example.edu (lowercase, no @ or https://)";

/** Public mailbox providers. They say nothing about which organisation an address belongs to. */
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

/** Login accepts any existing password: older accounts predate the strength rule. */
export const LOGIN_PASSWORD = /^.{1,128}$/;
export const LOGIN_PASSWORD_MESSAGE = "is required (max 128 characters)";
