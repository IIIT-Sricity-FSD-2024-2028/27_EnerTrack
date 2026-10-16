/**
 * DetailsCard — change your own name and phone.
 *
 * A controlled form: every input's value lives in `values`, and typing
 * updates it. Email and role are shown but not editable. The current password
 * is asked for because the backend has no login token: it is how it knows who
 * is asking.
 *
 *   <DetailsCard notify={showToast} />
 */
import { useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { roleLabel } from "../../routes";
import { updateDetails } from "../auth/authFlow";
import { validators } from "../auth/validators";
import Field from "./Field";

// Which rule checks which field. The phone is optional here, so a blank one
// is allowed (it clears the number).
const RULES = {
  name: validators.name,
  phone: validators.optionalPhone,
  currentPassword: validators.currentPassword,
};

function findErrors(values) {
  const errors = {};
  for (const field of Object.keys(RULES)) {
    const message = RULES[field](values[field], values);
    if (message) errors[field] = message;
  }
  return errors;
}

export default function DetailsCard({ notify }) {
  const { user, adoptSession } = useAuth();

  const [values, setValues] = useState({
    name: user.name || "",
    phone: user.phone || "",
    currentPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // One handler for every input: its `name` says which value changed. The
  // field is checked as you type, but a blank one stays quiet until submit.
  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
    setFormError("");
    setErrors({
      ...errors,
      [name]: value === "" ? "" : RULES[name](value, values),
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = findErrors(values);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const account = await updateDetails({
        email: user.email,
        currentPassword: values.currentPassword,
        name: values.name,
        phone: values.phone,
      });
      // Keep the signed-in session in step, so the sidebar shows the new name.
      adoptSession(account);
      setValues({ ...values, currentPassword: "" });
      notify("Your details were saved.", "success");
    } catch (err) {
      const message = err.message || "Could not save your details.";
      if (/invalid email or password/i.test(message))
        setErrors({ currentPassword: "That is not your current password." });
      else if (/duplicate phone/i.test(message))
        setErrors({ phone: "That phone number belongs to another account." });
      else setFormError(message);
    }
    setSaving(false);
  }

  return (
    <div className="card">
      <h2>Your details</h2>
      {/* Email and role are only shown: they decide which organisation's data
          you can reach, so an administrator sets them. */}
      <p className="sub">
        {user.email} · {roleLabel(user.role)}
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Name"
          name="name"
          value={values.name}
          onChange={handleChange}
          error={errors.name}
          autoComplete="name"
          maxLength={50}
        />
        <Field
          label="Phone"
          name="phone"
          value={values.phone}
          onChange={handleChange}
          error={errors.phone}
          autoComplete="tel"
          maxLength={10}
          placeholder="10 digits, or leave blank"
        />
        <Field
          label="Current password"
          name="currentPassword"
          id="detailsCurrentPassword"
          type="password"
          value={values.currentPassword}
          onChange={handleChange}
          error={errors.currentPassword}
          autoComplete="current-password"
          maxLength={128}
          placeholder="Needed to save changes"
        />

        {formError && <span className="field-error">{formError}</span>}

        <button type="submit" className="btn btn-dark" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
