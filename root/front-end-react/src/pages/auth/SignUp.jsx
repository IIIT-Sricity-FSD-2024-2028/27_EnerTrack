import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { PATHS } from "../../routes";
import FormField from "../../ui/FormField";
import { SELF_REGISTER_ROLES, validators } from "./validators";
import "../../styles/sign_up/sign_up.css";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  role: "",
  organization_id: "",
};

const ROLE_OPTIONS = SELF_REGISTER_ROLES.map((r) => ({ value: r, label: r }));

export default function SignUp() {
  // ONE object holds every field; the key is the input's `name`.
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [organisations, setOrganisations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [popupMessage, setPopupMessage] = useState(null); // null = hidden

  const { adoptSession } = useAuth();
  const navigate = useNavigate();

  // Side effect: fetch the organisation list once, when the page first shows.
  // The empty [] means "run after the first render only".
  useEffect(() => {
    let ignore = false; // set by the cleanup below

    async function loadOrganisations() {
      try {
        const orgs = await api.get("/organizations/public");
        if (!ignore) setOrganisations(orgs);
      } catch {
        if (!ignore) {
          setErrors((prev) => ({
            ...prev,
            organization_id:
              "Could not reach the server. Please refresh and try again.",
          }));
        }
      } finally {
        if (!ignore) setLoadingOrgs(false);
      }
    }
    loadOrganisations();

    // Cleanup: if the user leaves the page before the reply arrives, do not
    // set state on a component that is gone.
    return () => {
      ignore = true;
    };
  }, []);

  // One handler for every field: the input's `name` says which key to change.
  function handleChange(e) {
    const { name, value } = e.target;
    const nextValues = { ...values, [name]: value };
    setValues(nextValues);

    // Live validation. An empty box just clears its error (like the old page);
    // "required" is only reported on submit.
    setErrors((prev) => {
      const next = {
        ...prev,
        [name]: value === "" ? "" : validators[name](value, nextValues),
      };
      // Changing the password can make an already-typed confirm wrong/right.
      if (name === "password" && nextValues.confirmPassword !== "") {
        next.confirmPassword = validators.confirmPassword(
          nextValues.confirmPassword,
          nextValues,
        );
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Run every validator, including the "required" check.
    const allErrors = {};
    for (const field of Object.keys(EMPTY_FORM)) {
      allErrors[field] = validators[field](values[field], values);
    }
    setErrors(allErrors);
    if (Object.values(allErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const account = await api.post("/users/register", {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        password: values.password,
        role: values.role,
        organization_id: values.organization_id,
      });
      adoptSession(account);
      navigate(PATHS.landing);
    } catch (err) {
      setPopupMessage(err.message || "Signup failed. Please try again.");
      setSubmitting(false);
    }
  }

  const passwordEye = (
    <span
      className="eye"
      role="button"
      aria-label="Show or hide password"
      onClick={() => setShowPassword((shown) => !shown)}
    >
      {showPassword ? "Hide" : "Show"}
    </span>
  );

  return (
    <>
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
          <h1>Get started with EnerTrack</h1>
          <p className="sub">Create a free account. It takes about a minute.</p>

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label="Full name"
              name="name"
              value={values.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="e.g. John Doe"
              autoComplete="off"
              maxLength={50}
            />
            <FormField
              label="Email address"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="e.g. john.doe@example.com"
              autoComplete="off"
              maxLength={254}
            />
            <FormField
              label="Phone number"
              name="phone"
              type="tel"
              value={values.phone}
              onChange={handleChange}
              error={errors.phone}
              placeholder="e.g. 9876543210"
              autoComplete="off"
              maxLength={10}
            />
            <FormField
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={values.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="e.g. Str0ng@Pass!"
              autoComplete="new-password"
              adornment={passwordEye}
            />
            <FormField
              label="Confirm password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={values.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              adornment={passwordEye}
            />
            <FormField
              label="Your organisation"
              name="organization_id"
              value={values.organization_id}
              onChange={handleChange}
              error={errors.organization_id}
              placeholder={
                loadingOrgs
                  ? "Loading organisations..."
                  : "Select your organisation"
              }
              options={organisations.map((o) => ({
                value: o.organization_id,
                label: o.name,
              }))}
            />
            <FormField
              label="Your role"
              name="role"
              value={values.role}
              onChange={handleChange}
              error={errors.role}
              placeholder="Select a role"
              options={ROLE_OPTIONS}
            />

            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Signing up..." : "Sign Up"}
            </button>
          </form>

          <div className="footer">
            <p>Already have an account?</p>
            <Link to={PATHS.signIn} className="signin-link">
              Sign in
            </Link>
          </div>
          <div className="footer">
            <p>Organisation not listed?</p>
            <Link to={PATHS.registerOrganisation} className="signin-link">
              Register it
            </Link>
          </div>
        </div>
      </div>

      {popupMessage && (
        <div className="popup-overlay" style={{ display: "flex" }}>
          <div className="popup-card">
            <h3>Could not sign up</h3>
            <p>{popupMessage}</p>
            <div className="popup-actions">
              <button
                type="button"
                className="popup-btn popup-btn-secondary"
                onClick={() => setPopupMessage(null)}
              >
                Go Back
              </button>
              <Link to={PATHS.signIn} className="popup-btn popup-btn-primary">
                Sign In Instead
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
