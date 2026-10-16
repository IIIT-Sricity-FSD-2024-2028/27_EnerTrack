/**
 * PasswordCard — change your own password.
 *
 * The same three fields and rules as the forced change-password screen
 * (validators.js), as a card inside the dashboard instead of a full page.
 *
 *   <PasswordCard notify={showToast} />
 */
import { useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { changePassword } from "../auth/authFlow";
import { validateFields, validators } from "../auth/validators";
import Field from "./Field";

const FIELDS = ["currentPassword", "newPassword", "confirmNewPassword"];
const EMPTY = { currentPassword: "", newPassword: "", confirmNewPassword: "" };

export default function PasswordCard({ notify }) {
  const { user, adoptSession } = useAuth();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    const nextValues = { ...values, [name]: value };
    setValues(nextValues);
    setFormError("");

    const next = {
      ...errors,
      [name]: value === "" ? "" : validators[name](value, nextValues),
    };
    // Changing the new password can make an already typed confirmation wrong.
    if (name === "newPassword" && nextValues.confirmNewPassword !== "")
      next.confirmNewPassword = validators.confirmNewPassword(
        nextValues.confirmNewPassword,
        nextValues,
      );
    setErrors(next);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validateFields(FIELDS, values);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const account = await changePassword({
        email: user.email,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      adoptSession(account);
      setValues(EMPTY);
      notify("Your password was changed.", "success");
    } catch (err) {
      const message = err.message || "Could not change the password.";
      if (/invalid email or password/i.test(message))
        setErrors({ currentPassword: "That is not your current password." });
      else if (/different from the current/i.test(message))
        setErrors({ newPassword: message });
      else setFormError(message);
    }
    setSaving(false);
  }

  return (
    <div className="card">
      <h2>Change password</h2>
      <p className="sub">
        8-32 characters with upper and lower case, a number and a symbol.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          value={values.currentPassword}
          onChange={handleChange}
          error={errors.currentPassword}
          autoComplete="current-password"
          maxLength={128}
        />
        <Field
          label="New password"
          name="newPassword"
          type="password"
          value={values.newPassword}
          onChange={handleChange}
          error={errors.newPassword}
          autoComplete="new-password"
          maxLength={32}
        />
        <Field
          label="Confirm new password"
          name="confirmNewPassword"
          type="password"
          value={values.confirmNewPassword}
          onChange={handleChange}
          error={errors.confirmNewPassword}
          autoComplete="new-password"
          maxLength={32}
        />

        {formError && <span className="field-error">{formError}</span>}

        <button type="submit" className="btn btn-dark" disabled={saving}>
          {saving ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
