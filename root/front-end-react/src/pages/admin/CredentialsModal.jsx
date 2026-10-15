/**
 * CredentialsModal — shown once after an administrator creates an account.
 *
 * The password is only known here: the backend never sends one back on a
 * later read. The administrator copies the details and passes them to the
 * person, who must replace the password when they first sign in.
 */
import { useState } from "react";
import Modal from "./Modal";

export default function CredentialsModal({ name, email, password, onClose }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = `EnerTrack sign-in\nEmail: ${email}\nTemporary password: ${password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard blocked: the details are on screen to copy by hand
    }
  }

  return (
    <Modal
      title="Account created"
      confirmLabel={copied ? "Copied" : "Copy details"}
      cancelLabel="Done"
      onConfirm={handleCopy}
      onClose={onClose}
    >
      <p>
        Give <strong>{name}</strong> these details. They will be asked to choose
        their own password when they first sign in.
      </p>
      <dl style={{ margin: "14px 0", display: "grid", gap: "8px" }}>
        <div>
          <dt className="muted-cell">Email</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{email}</dd>
        </div>
        <div>
          <dt className="muted-cell">Temporary password</dt>
          <dd
            style={{
              margin: 0,
              fontWeight: 600,
              fontFamily: "ui-monospace, Consolas, monospace",
            }}
          >
            {password}
          </dd>
        </div>
      </dl>
      <p className="muted-cell">
        This is the only time the password is shown. If it is lost, edit the
        user to set a new one.
      </p>
    </Modal>
  );
}
