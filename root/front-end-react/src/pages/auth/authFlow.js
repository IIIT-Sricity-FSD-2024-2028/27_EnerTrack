/**
 * authFlow.js — which endpoint each auth action calls, with which payload.
 *
 * The auth screen is one page. It never asks anyone which kind of user they
 * are: what they are doing decides the call, and the role that comes back
 * decides where they go next.
 *
 *   sign in                  POST /users/login                  everyone: staff,
 *                                                               admins, auditors,
 *                                                               campus visitors
 *   campus sign-up           POST /users/signup                 a student or faculty
 *                                                               member; always a Campus
 *                                                               Visitor, organisation
 *                                                               found from the email
 *                                                               domain
 *   register organisation    POST /organizations/register       a new customer; the
 *                                                               person becomes its
 *                                                               Organization Admin
 *   change password          POST /users/change-password        first sign-in with an
 *                                                               admin-issued password
 *
 * Campus Visitor is the only role that creates its own account. Every other
 * account is created by the organisation's Organization Admin on /admin/users,
 * who follows the organisation's own email format and hands over the
 * credentials.
 *
 * Plain functions, no React: the page adopts the returned session itself.
 */
import api from "../../api/client";
import { PATHS, homeForRole } from "../../routes";

/** Signs anyone in. Returns the account (without password). */
export function signIn({ email, password }) {
  return api.post("/users/login", {
    email: email.trim().toLowerCase(),
    password,
  });
}

/** A student or faculty member's own account. Returns the account. */
export function signUpCampus(values) {
  return api.post("/users/signup", {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim(),
    password: values.password,
  });
}

/** Builds the payload for a new organisation; optional fields only when filled. */
function organisationPayload(values) {
  const payload = {
    name: values.orgName.trim(),
    type: values.orgType,
    location: values.orgLocation.trim(),
    admin_name: values.adminName.trim(),
    admin_email: values.adminEmail.trim().toLowerCase(),
    admin_password: values.adminPassword,
  };
  if (values.orgArea.trim()) payload.floor_area_sqm = Number(values.orgArea);
  if (values.emailDomain.trim())
    payload.email_domain = values.emailDomain.trim().toLowerCase();
  if (values.adminPhone.trim()) payload.admin_phone = values.adminPhone.trim();
  return payload;
}

/** Registers an organisation and its administrator. Returns { organization, admin }. */
export function registerOrganisation(values) {
  return api.post("/organizations/register", organisationPayload(values));
}

/** Replaces a password. Returns the updated account. */
export function changePassword({ email, currentPassword, newPassword }) {
  return api.post("/users/change-password", {
    email: email.trim().toLowerCase(),
    current_password: currentPassword,
    new_password: newPassword,
  });
}

/**
 * Where a freshly authenticated account goes. An account whose password was
 * issued by an administrator must replace it before anything else.
 */
export function destinationAfterAuth(account) {
  return account.must_change_password
    ? PATHS.changePassword
    : homeForRole(account.role);
}
