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
 *   register organisation    POST /audit-requests               a new customer. Creates
 *                                                               only a PENDING request:
 *                                                               a Super Admin must
 *                                                               approve it before the
 *                                                               organisation and its
 *                                                               Organization Admin exist
 *   change password          POST /users/change-password        first sign-in with an
 *                                                               admin-issued password
 *
 * Campus Visitor is the only role that creates its own account. Every other
 * account is created by the organisation's Organization Admin on /admin/users,
 * who follows the organisation's own email format and hands over the
 * credentials.
 *
 * The calls themselves are thunks in store/slices/authSlice.js (signIn,
 * signUpCampus, requestAudit, changePassword, ...). This file keeps the pure
 * helpers: the audit-request payload and where to go after signing in.
 */
import { PATHS, homeForRole } from "../../routes";

/** Builds the payload for an audit request; optional fields only when filled. */
export function organisationPayload(values) {
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

/**
 * Where a freshly authenticated account goes. An account whose password was
 * issued by an administrator must replace it before anything else.
 */
export function destinationAfterAuth(account) {
  return account.must_change_password
    ? PATHS.changePassword
    : homeForRole(account.role);
}
