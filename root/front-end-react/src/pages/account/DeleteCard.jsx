/**
 * DeleteCard — delete your own account.
 *
 * Deleting cannot be undone, so the button only opens a confirmation popup,
 * and the popup asks for the password. If the backend refuses (for example
 * you are your organisation's only Organization Admin) its reason is shown in
 * the popup and nothing is deleted.
 *
 * On success the session is cleared and you land on the public home page,
 * exactly like Sign Out (see handleSignOut in DashboardLayout for why the
 * navigation comes first).
 */
import { startTransition, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { PATHS } from "../../routes";
import Modal from "../technician/components/Modal";
import { deleteAccount } from "../auth/authFlow";
import Field from "./Field";

export default function DeleteCard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  function openPopup() {
    setPassword("");
    setError("");
    setOpen(true);
  }

  async function handleDelete() {
    if (deleting) return;
    if (password === "") {
      setError("Enter your password to confirm.");
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount({ email: user.email, password });
      navigate(PATHS.landing);
      startTransition(() => logout());
    } catch (err) {
      const message = err.message || "Could not delete the account.";
      setError(
        /invalid email or password/i.test(message)
          ? "That is not your password."
          : message,
      );
      setDeleting(false);
    }
  }

  return (
    <div className="card account-delete">
      {/* A slim row, not a full card: the text on the left, the button right. */}
      <div className="header-row">
        <div>
          <h2>Delete account</h2>
          <p className="sub">
            This removes your sign-in for good. It cannot be undone.
          </p>
        </div>
        <button type="button" className="btn btn-red" onClick={openPopup}>
          Delete my account
        </button>
      </div>

      {open && (
        <Modal
          title="Delete your account"
          confirmLabel={deleting ? "Deleting…" : "Delete account"}
          danger
          onConfirm={handleDelete}
          onCancel={() => !deleting && setOpen(false)}
        >
          <p>
            Delete the account for <strong>{user.email}</strong>? You will be
            signed out and will not be able to sign in again.
          </p>
          <Field
            label="Your password"
            name="deletePassword"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            error={error}
            autoComplete="current-password"
            maxLength={128}
            autoFocus
          />
        </Modal>
      )}
    </div>
  );
}
