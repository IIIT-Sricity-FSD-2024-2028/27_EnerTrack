/**
 * ChangePassword — /change-password.
 *
 * An account an administrator created starts with a password the
 * administrator chose, so the first sign-in has to replace it before the
 * person can use anything else (RequireRole sends them here). Anyone signed in
 * can also open it later to change their password.
 */
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { PATHS, homeForRole } from "../../routes";
import FormField from "../../ui/FormField";
import { changePassword } from "./authFlow";
import { validateFields, validators } from "./validators";
import "../../styles/sign_in/sign_in.css";
import "../../styles/auth_page/auth_page.css";

const FIELDS = ["currentPassword", "newPassword", "confirmNewPassword"];
const EMPTY = { currentPassword: "", newPassword: "", confirmNewPassword: "" };

export default function ChangePassword() {
  const { user, adoptSession, logout } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!user) return <Navigate to={PATHS.signIn} replace />;

  const forced = Boolean(user.must_change_password);

  function handleChange(e) {
    const { name, value } = e.target;
    const nextValues = { ...values, [name]: value };
    setValues(nextValues);
    setFormError("");
    setErrors((prev) => {
      const next = {
        ...prev,
        [name]: value === "" ? "" : validators[name](value, nextValues),
      };
      if (name === "newPassword" && nextValues.confirmNewPassword !== "")
        next.confirmNewPassword = validators.confirmNewPassword(
          nextValues.confirmNewPassword,
          nextValues,
        );
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validateFields(FIELDS, values);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const account = await changePassword({
        email: user.email,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      adoptSession(account);
      navigate(homeForRole(account.role), { replace: true });
    } catch (err) {
      const message = err.message || "Could not change the password.";
      if (/invalid email or password/i.test(message))
        setErrors({ currentPassword: "That is not your current password." });
      else if (/different from the current/i.test(message))
        setErrors({ newPassword: message });
      else setFormError(message);
      setSubmitting(false);
    }
  }

  function handleSignOut() {
    navigate(PATHS.landing, { replace: true });
    logout();
  }

  const eye = (
    <span
      className="eye"
      role="button"
      tabIndex={0}
      aria-label="Show or hide passwords"
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
  const type = showPassword ? "text" : "password";

  return (
    <div className="auth-page sign-in-page">
      <div className="background">
        <img src="/assets/hero.png" alt="" aria-hidden="true" />
      </div>

      <div className="top-bar">
        <Link to={PATHS.landing} className="logo">
          <img src="/assets/logo.png" alt="EnerTrack" />
        </Link>
        {!forced && (
          <Link to={homeForRole(user.role)} className="back-link">
            ← Back to dashboard
          </Link>
        )}
      </div>

      <div className="main">
        <div className="card">
          <h1>{forced ? "Choose your own password" : "Change password"}</h1>
          <p className="sub">
            {forced
              ? "Your administrator gave you a temporary password. Set one only you know before you continue."
              : "Enter your current password and pick a new one."}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label={forced ? "Temporary password" : "Current password"}
              name="currentPassword"
              type={type}
              value={values.currentPassword}
              onChange={handleChange}
              error={errors.currentPassword}
              placeholder="The password you signed in with"
              autoComplete="current-password"
              maxLength={128}
              autoFocus
              adornment={eye}
            />
            <FormField
              label="New password"
              name="newPassword"
              type={type}
              value={values.newPassword}
              onChange={handleChange}
              error={errors.newPassword}
              placeholder="e.g. Str0ng@Pass!"
              autoComplete="new-password"
              maxLength={32}
              adornment={eye}
            />
            <FormField
              label="Confirm new password"
              name="confirmNewPassword"
              type={type}
              value={values.confirmNewPassword}
              onChange={handleChange}
              error={errors.confirmNewPassword}
              placeholder="Re-enter the new password"
              autoComplete="new-password"
              maxLength={32}
              adornment={eye}
            />

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
              {submitting ? "Saving…" : "Save password"}
            </button>
          </form>

          <div className="footer">
            <p>Not {user.name}?</p>
            <button
              type="button"
              className="register-link link-button"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
