import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { PATHS, homeForRole } from "../../routes";
import FormField from "../../ui/FormField";
import "../../styles/sign_up/sign_up.css";

const ORG_TYPES = [
  "University",
  "Engineering College",
  "Polytechnic",
  "School",
  "Corporate Campus",
  "Hospital",
  "Other",
].map((type) => ({ value: type, label: type }));

// The required fields as DATA. One loop in validate() reads this table, so
// adding a field means adding a row here, not another if-block.
const RULES = [
  { name: "orgName", label: "an organisation name", min: 3 },
  { name: "orgType", label: "a type" },
  { name: "orgLocation", label: "a location", min: 2 },
  { name: "adminName", label: "your name", min: 2 },
  { name: "adminEmail", label: "your work email", email: true },
  { name: "adminPassword", label: "a password", min: 6 },
];

const EMPTY_FORM = {
  orgName: "",
  orgType: "",
  orgLocation: "",
  orgArea: "", // optional
  adminName: "",
  adminEmail: "",
  adminPhone: "", // optional
  adminPassword: "",
};

/** Returns { fieldName: message } for every rule that fails. Courtesy only:
 *  the backend re-checks everything. */
function validate(values) {
  const errors = {};
  for (const rule of RULES) {
    const value = values[rule.name].trim();
    if (!value) {
      errors[rule.name] = `Please enter ${rule.label}.`;
    } else if (rule.min && value.length < rule.min) {
      errors[rule.name] = `Please enter at least ${rule.min} characters.`;
    } else if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[rule.name] = "That does not look like an email address.";
    }
  }
  return errors;
}

export default function RegisterOrganisation() {
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const { adoptSession } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    // Editing a field clears just that field's error.
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Optional fields are only sent when filled in.
    const payload = {
      name: values.orgName.trim(),
      type: values.orgType,
      location: values.orgLocation.trim(),
      admin_name: values.adminName.trim(),
      admin_email: values.adminEmail.trim().toLowerCase(),
      admin_password: values.adminPassword,
    };
    if (values.orgArea.trim()) payload.floor_area_sqm = Number(values.orgArea);
    if (values.adminPhone.trim())
      payload.admin_phone = values.adminPhone.trim();

    setSubmitting(true);
    try {
      const result = await api.post("/organizations/register", payload);
      // The response has the same shape as a login, so start the session
      // instead of sending them to the sign-in page.
      adoptSession(result.admin);
      navigate(homeForRole(result.admin.role));
    } catch (err) {
      // The backend's messages say what to do (duplicate name or email), so
      // show them as they are, under the field they are about.
      const message = err.message || "Could not register. Please try again.";
      const field = /email/i.test(message) ? "adminEmail" : "orgName";
      setErrors({ [field]: message });
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page sign-up-page">
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
          <h1>Register your organisation</h1>
          <p className="sub">
            This creates your organisation and makes you its administrator. You
            can then request a site audit — nothing is charged until you accept
            a proposal.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label="Organisation name"
              name="orgName"
              value={values.orgName}
              onChange={handleChange}
              error={errors.orgName}
              placeholder="Deccan School of Engineering"
              autoComplete="organization"
            />
            <FormField
              label="Type"
              name="orgType"
              value={values.orgType}
              onChange={handleChange}
              error={errors.orgType}
              placeholder="Select a type"
              options={ORG_TYPES}
            />
            <FormField
              label="Location"
              name="orgLocation"
              value={values.orgLocation}
              onChange={handleChange}
              error={errors.orgLocation}
              placeholder="Pune, Maharashtra"
            />
            <FormField
              label="Approximate floor area in m² (optional)"
              name="orgArea"
              type="number"
              value={values.orgArea}
              onChange={handleChange}
              error={errors.orgArea}
              placeholder="18000"
            />

            <hr
              style={{
                border: "none",
                borderTop: "1px solid rgba(0, 0, 0, 0.1)",
                margin: "22px 0 18px",
              }}
            />
            <p className="sub" style={{ marginBottom: 16 }}>
              You will be the organisation's administrator — the account that
              receives EnerTrack's proposal and approves it.
            </p>

            <FormField
              label="Your full name"
              name="adminName"
              value={values.adminName}
              onChange={handleChange}
              error={errors.adminName}
              placeholder="Rohit Kale"
            />
            <FormField
              label="Work email"
              name="adminEmail"
              type="email"
              value={values.adminEmail}
              onChange={handleChange}
              error={errors.adminEmail}
              placeholder="rohit@deccan.edu"
            />
            <FormField
              label="Phone (optional)"
              name="adminPhone"
              type="tel"
              value={values.adminPhone}
              onChange={handleChange}
              error={errors.adminPhone}
              placeholder="9876543210"
            />
            <FormField
              label="Password"
              name="adminPassword"
              type="password"
              value={values.adminPassword}
              onChange={handleChange}
              error={errors.adminPassword}
              placeholder="At least 6 characters"
            />

            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Registering…" : "Register organisation"}
            </button>
          </form>

          <div className="footer">
            <p>Your organisation already on EnerTrack?</p>
            <Link to={PATHS.signUp} className="signin-link">
              Join it instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
