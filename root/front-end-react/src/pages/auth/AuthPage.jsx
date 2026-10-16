/**
 * AuthPage — the one public page for getting into EnerTrack.
 *
 * Three modes on the same screen, switched by ?mode=:
 *   sign in (default)       everyone: staff, admins, auditors, campus visitors
 *   campus                  a student or faculty member creating their own
 *                           Campus Visitor account
 *   register                a new customer asking for an audit. This only files a
 *                           request: a certified auditor must approve it before the
 *                           organisation and its Organization Admin exist
 *
 * Nobody picks a role or an organisation here. What the person is doing
 * selects the endpoint (see authFlow.js) and the role in the response selects
 * the dashboard. A campus visitor's organisation comes from their email
 * domain; every other account is created by the organisation's administrator,
 * so there is no "sign up as ..." form.
 */
import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { PATHS } from "../../routes";
import FormField from "../../ui/FormField";
import {
  destinationAfterAuth,
  requestAudit,
  signIn,
  signUpCampus,
} from "./authFlow";
import { ORG_TYPES, validateFields, validators } from "./validators";
import "../../styles/sign_in/sign_in.css";
import "../../styles/sign_up/sign_up.css";
import "../../styles/auth_page/auth_page.css";

const MODES = { signIn: "sign-in", register: "register", campus: "campus" };

const SIGN_IN_FIELDS = ["loginEmail", "loginPassword"];
const REGISTER_FIELDS = [
  "orgName",
  "orgType",
  "orgLocation",
  "orgArea",
  "emailDomain",
  "adminName",
  "adminEmail",
  "adminPhone",
  "adminPassword",
  "confirmAdminPassword",
];

const CAMPUS_FIELDS = ["name", "email", "phone", "password", "confirmPassword"];

const EMPTY_SIGN_IN = { loginEmail: "", loginPassword: "" };
const EMPTY_CAMPUS = Object.fromEntries(CAMPUS_FIELDS.map((f) => [f, ""]));
const EMPTY_REGISTER = Object.fromEntries(REGISTER_FIELDS.map((f) => [f, ""]));
const ORG_TYPE_OPTIONS = ORG_TYPES.map((t) => ({ value: t, label: t }));

// Which field a backend message is about, so it can be shown beside that field
const SERVER_FIELD_HINTS = [
  [/password/i, "adminPassword"],
  [/phone/i, "adminPhone"],
  [/domain/i, "emailDomain"],
  [/email/i, "adminEmail"],
  [/admin_name/i, "adminName"],
  [/location/i, "orgLocation"],
  [/type/i, "orgType"],
  [/name|already registered/i, "orgName"],
];

const CAMPUS_FIELD_HINTS = [
  [/password/i, "password"],
  [/phone/i, "phone"],
  [/email|domain/i, "email"],
  [/name/i, "name"],
];

function fieldForCampusMessage(message) {
  const hit = CAMPUS_FIELD_HINTS.find(([pattern]) => pattern.test(message));
  return hit ? hit[1] : null;
}

function fieldForServerMessage(message) {
  const hit = SERVER_FIELD_HINTS.find(([pattern]) => pattern.test(message));
  return hit ? hit[1] : null;
}

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("mode");
  const mode =
    requested === MODES.register || requested === MODES.campus
      ? requested
      : MODES.signIn;
  const isRegister = mode === MODES.register;
  const isCampus = mode === MODES.campus;

  const { user, adoptSession } = useAuth();
  const navigate = useNavigate();

  const [signInValues, setSignInValues] = useState(EMPTY_SIGN_IN);
  const [registerValues, setRegisterValues] = useState(EMPTY_REGISTER);
  const [campusValues, setCampusValues] = useState(EMPTY_CAMPUS);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Set once an audit request is filed: { name, email }. The page then shows
  // a confirmation instead of the form, because nobody is signed in yet.
  const [requestSent, setRequestSent] = useState(null);
  const showConfirmation = isRegister && requestSent !== null;

  // Already signed in: there is nothing to do here.
  if (user) {
    return <Navigate to={destinationAfterAuth(user)} replace />;
  }

  const values = isRegister
    ? registerValues
    : isCampus
      ? campusValues
      : signInValues;
  const setValues = isRegister
    ? setRegisterValues
    : isCampus
      ? setCampusValues
      : setSignInValues;
  const fields = isRegister
    ? REGISTER_FIELDS
    : isCampus
      ? CAMPUS_FIELDS
      : SIGN_IN_FIELDS;

  function switchMode(next) {
    // Each mode starts clean: errors from the other mode mean nothing here.
    setErrors({});
    setFormError("");
    setRequestSent(null);
    setSearchParams(next === MODES.signIn ? {} : { mode: next }, {
      replace: true,
    });
  }

  // One handler for every field: the input's `name` says which key to change.
  function handleChange(e) {
    const { name, value } = e.target;
    const nextValues = { ...values, [name]: value };
    setValues(nextValues);
    setFormError("");

    // Live validation. An empty box just clears its error; "required" is only
    // reported on submit.
    setErrors((prev) => {
      const next = {
        ...prev,
        [name]: value === "" ? "" : validators[name](value, nextValues),
      };
      // A change can make an already-typed dependent field right or wrong.
      if (name === "password" && nextValues.confirmPassword !== "")
        next.confirmPassword = validators.confirmPassword(
          nextValues.confirmPassword,
          nextValues,
        );
      if (name === "adminPassword" && nextValues.confirmAdminPassword !== "")
        next.confirmAdminPassword = validators.confirmAdminPassword(
          nextValues.confirmAdminPassword,
          nextValues,
        );
      if (name === "emailDomain" && nextValues.adminEmail !== "")
        next.adminEmail = validators.adminEmail(
          nextValues.adminEmail,
          nextValues,
        );
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const found = validateFields(fields, values);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      if (isRegister) {
        // Files a pending request. Nothing is created and nobody is signed in
        // until a certified auditor approves it.
        await requestAudit(registerValues);
        setRequestSent({
          name: registerValues.orgName.trim(),
          email: registerValues.adminEmail.trim().toLowerCase(),
        });
        setRegisterValues(EMPTY_REGISTER);
        setSubmitting(false);
      } else if (isCampus) {
        const account = await signUpCampus(campusValues);
        adoptSession(account);
        navigate(destinationAfterAuth(account), { replace: true });
      } else {
        const account = await signIn({
          email: signInValues.loginEmail,
          password: signInValues.loginPassword,
        });
        adoptSession(account);
        navigate(destinationAfterAuth(account), { replace: true });
      }
    } catch (err) {
      const message =
        err.message ||
        (isRegister || isCampus
          ? "Could not submit. Please try again."
          : "Invalid email or password.");
      let field = "loginPassword";
      if (isRegister) field = fieldForServerMessage(message);
      if (isCampus) field = fieldForCampusMessage(message);
      if (field) setErrors({ [field]: message });
      else setFormError(message);
      setSubmitting(false);
    }
  }

  const passwordEye = (
    <span
      className="eye"
      role="button"
      tabIndex={0}
      aria-label="Show or hide password"
      onClick={() => setShowPassword((shown) => !shown)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setShowPassword((shown) => !shown);
        }
      }}
    >
      {showPassword ? "Hide" : "Show"}
    </span>
  );
  const passwordType = showPassword ? "text" : "password";

  return (
    <div
      className={`auth-page ${isRegister || isCampus ? "sign-up-page" : "sign-in-page"}`}
    >
      <div className="background">
        <img src="/assets/hero.png" alt="" aria-hidden="true" />
      </div>

      <div className="top-bar">
        <Link to={PATHS.landing} className="logo">
          <img src="/assets/logo.png" alt="EnerTrack" />
        </Link>
        <Link to={PATHS.landing} className="back-link">
          ← Back to site
        </Link>
      </div>

      <div className="main">
        <div className="card">
          <div className="auth-tabs" role="tablist" aria-label="Account">
            <button
              type="button"
              role="tab"
              className="auth-tab"
              aria-selected={!isRegister && !isCampus}
              onClick={() => switchMode(MODES.signIn)}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              className="auth-tab"
              aria-selected={isCampus}
              onClick={() => switchMode(MODES.campus)}
            >
              Campus sign up
            </button>
            <button
              type="button"
              role="tab"
              className="auth-tab"
              aria-selected={isRegister}
              onClick={() => switchMode(MODES.register)}
            >
              New organisation
            </button>
          </div>

          {showConfirmation ? (
            <>
              <h1>Request received</h1>
              <p className="sub">
                Thank you. <strong>{requestSent.name}</strong> is now waiting
                for an EnerTrack auditor to review it. Nothing has been created
                yet, and there is nothing more to do right now.
              </p>
              <p className="sub">
                Once it is approved, sign in with{" "}
                <strong>{requestSent.email}</strong> and the password you chose.
                If you try to sign in before then, the page will tell you where
                your request stands.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => switchMode(MODES.signIn)}
              >
                Go to sign in
              </button>
            </>
          ) : isRegister ? (
            <>
              <h1>Request an audit</h1>
              <p className="sub">
                Tell us about your organisation. An EnerTrack auditor reviews
                every request before an account is created, so you can sign in
                once it is approved. Nothing is charged until you accept a
                proposal.
              </p>
            </>
          ) : isCampus ? (
            <>
              <h1>Create your campus account</h1>
              <p className="sub">
                For students and faculty. Sign up with your campus email address
                and we will place you in your organisation. Staff accounts are
                created by your administrator instead.
              </p>
            </>
          ) : (
            <>
              <h1>Welcome back</h1>
              <p className="sub">
                Sign in with the account your organisation's administrator gave
                you.
              </p>
            </>
          )}

          {!showConfirmation && (
            <form onSubmit={handleSubmit} noValidate>
              {isRegister ? (
                <>
                  <FormField
                    label="Organisation name"
                    name="orgName"
                    value={registerValues.orgName}
                    onChange={handleChange}
                    error={errors.orgName}
                    placeholder="Deccan School of Engineering"
                    autoComplete="organization"
                    maxLength={100}
                  />
                  <FormField
                    label="Type"
                    name="orgType"
                    value={registerValues.orgType}
                    onChange={handleChange}
                    error={errors.orgType}
                    placeholder="Select a type"
                    options={ORG_TYPE_OPTIONS}
                  />
                  <FormField
                    label="Location"
                    name="orgLocation"
                    value={registerValues.orgLocation}
                    onChange={handleChange}
                    error={errors.orgLocation}
                    placeholder="Pune, Maharashtra"
                    maxLength={120}
                  />
                  <FormField
                    label="Approximate floor area in m² (optional)"
                    name="orgArea"
                    value={registerValues.orgArea}
                    onChange={handleChange}
                    error={errors.orgArea}
                    placeholder="18000"
                    maxLength={12}
                  />
                  <FormField
                    label="Email domain for your people (optional)"
                    name="emailDomain"
                    value={registerValues.emailDomain}
                    onChange={handleChange}
                    error={errors.emailDomain}
                    placeholder="deccan.edu"
                    autoComplete="off"
                    maxLength={120}
                  />
                  <p className="field-hint">
                    If set, every account you create must use it, for example
                    name@deccan.edu.
                  </p>

                  <hr className="form-divider" />
                  <p className="sub">
                    You will be the organisation's administrator: the account
                    that creates everyone else's and approves EnerTrack's
                    proposal.
                  </p>

                  <FormField
                    label="Your full name"
                    name="adminName"
                    value={registerValues.adminName}
                    onChange={handleChange}
                    error={errors.adminName}
                    placeholder="Rohit Kale"
                    autoComplete="name"
                    maxLength={50}
                  />
                  <FormField
                    label="Work email"
                    name="adminEmail"
                    type="email"
                    value={registerValues.adminEmail}
                    onChange={handleChange}
                    error={errors.adminEmail}
                    placeholder="rohit@deccan.edu"
                    autoComplete="email"
                    maxLength={254}
                  />
                  <FormField
                    label="Phone (optional)"
                    name="adminPhone"
                    type="tel"
                    value={registerValues.adminPhone}
                    onChange={handleChange}
                    error={errors.adminPhone}
                    placeholder="9876543210"
                    autoComplete="tel"
                    maxLength={10}
                  />
                  <FormField
                    label="Password"
                    name="adminPassword"
                    type={passwordType}
                    value={registerValues.adminPassword}
                    onChange={handleChange}
                    error={errors.adminPassword}
                    placeholder="e.g. Str0ng@Pass!"
                    autoComplete="new-password"
                    maxLength={32}
                    adornment={passwordEye}
                  />
                  <FormField
                    label="Confirm password"
                    name="confirmAdminPassword"
                    type={passwordType}
                    value={registerValues.confirmAdminPassword}
                    onChange={handleChange}
                    error={errors.confirmAdminPassword}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    maxLength={32}
                    adornment={passwordEye}
                  />
                </>
              ) : isCampus ? (
                <>
                  <FormField
                    label="Full name"
                    name="name"
                    value={campusValues.name}
                    onChange={handleChange}
                    error={errors.name}
                    placeholder="e.g. Asha Rao"
                    autoComplete="name"
                    maxLength={50}
                    autoFocus
                  />
                  <FormField
                    label="Campus email address"
                    name="email"
                    type="email"
                    value={campusValues.email}
                    onChange={handleChange}
                    error={errors.email}
                    placeholder="you@yourcampus.edu"
                    autoComplete="email"
                    maxLength={254}
                  />
                  <FormField
                    label="Phone number"
                    name="phone"
                    type="tel"
                    value={campusValues.phone}
                    onChange={handleChange}
                    error={errors.phone}
                    placeholder="e.g. 9876543210"
                    autoComplete="tel"
                    maxLength={10}
                  />
                  <FormField
                    label="Password"
                    name="password"
                    type={passwordType}
                    value={campusValues.password}
                    onChange={handleChange}
                    error={errors.password}
                    placeholder="e.g. Str0ng@Pass!"
                    autoComplete="new-password"
                    maxLength={32}
                    adornment={passwordEye}
                  />
                  <FormField
                    label="Confirm password"
                    name="confirmPassword"
                    type={passwordType}
                    value={campusValues.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    maxLength={32}
                    adornment={passwordEye}
                  />
                </>
              ) : (
                <>
                  <FormField
                    label="Email address"
                    name="loginEmail"
                    type="email"
                    value={signInValues.loginEmail}
                    onChange={handleChange}
                    error={errors.loginEmail}
                    placeholder="you@yourorganisation.edu"
                    autoComplete="username"
                    maxLength={254}
                    autoFocus
                  />
                  <FormField
                    label="Password"
                    name="loginPassword"
                    type={passwordType}
                    value={signInValues.loginPassword}
                    onChange={handleChange}
                    error={errors.loginPassword}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    maxLength={128}
                    adornment={passwordEye}
                  />
                </>
              )}

              {formError && (
                <span
                  className="field-error"
                  role="alert"
                  style={{ display: "block", marginBottom: 12 }}
                >
                  {formError}
                </span>
              )}

              <button type="submit" className="btn" disabled={submitting}>
                {isRegister
                  ? submitting
                    ? "Submitting…"
                    : "Submit request"
                  : isCampus
                    ? submitting
                      ? "Creating account…"
                      : "Create account"
                    : submitting
                      ? "Signing in…"
                      : "Sign In"}
              </button>
            </form>
          )}

          {!showConfirmation && (
            <div className="footer">
              {isRegister ? (
                <p>
                  Already part of an organisation? Sign in with the credentials
                  your administrator gave you.
                </p>
              ) : isCampus ? (
                <p>Already have an account?</p>
              ) : (
                <p>
                  Staff accounts come from your organisation's administrator.
                  Student or faculty?
                </p>
              )}
              <button
                type="button"
                className="register-link link-button"
                onClick={() =>
                  switchMode(
                    isRegister || isCampus ? MODES.signIn : MODES.campus,
                  )
                }
              >
                {isRegister || isCampus ? "Sign in" : "Create a campus account"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
