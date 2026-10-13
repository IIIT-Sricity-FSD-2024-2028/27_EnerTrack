/**
 * SignInCard — shown instead of a finance page when nobody is signed in.
 * The shared sign-in page is not ported yet, and every API call needs the
 * user's role (sent as the x-role header), so the finance section offers
 * this small controlled form that calls useAuth().login().
 */
import { useState } from "react";
import { useAuth } from "../../../auth/useAuth";

export default function SignInCard() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="fa-signin-wrap">
      <form className="fa-signin" onSubmit={handleSubmit}>
        <img src="/assets/logo_finance-analyst.png" alt="" width="32" />
        <h2>Sign in to EnerTrack</h2>
        <p>Use a Financial Analyst account (demo: husaam@gmail.com / Husaam@123).</p>
        <div className="fm-group">
          <label>Email</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} required />
        </div>
        <div className="fm-group">
          <label>Password</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} required />
        </div>
        {error && <span className="field-error-msg">{error}</span>}
        <button className="fa-modal-confirm" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
