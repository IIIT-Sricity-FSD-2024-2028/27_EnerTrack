import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { PATHS, homeForRole } from "../../routes";
import FormField from "../../ui/FormField";
import "../../styles/sign_in/sign_in.css";

export default function SignIn() {
  // Each piece of changing data is its own state variable. When a setter is
  // called, React re-runs this function and the screen updates.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({}); // { email?: string, password?: string }
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault(); // stop the browser's full-page form submit

    if (email.trim() === "") {
      setErrors({ email: "Email is required." });
      return;
    }
    if (password === "") {
      setErrors({ password: "Password is required." });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const account = await login(email, password);
      navigate(homeForRole(account.role));
    } catch (err) {
      setErrors({ password: err.message || "Invalid email or password." });
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page sign-in-page">
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
          <h1>Welcome back</h1>
          <p className="sub">Sign in to reach your EnerTrack dashboard.</p>

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label="Email address"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="yourname@gmail.com"
              autoComplete="off"
              maxLength={50}
              autoFocus
            />

            <FormField
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              placeholder="Enter your password"
              autoComplete="new-password"
              maxLength={50}
              adornment={
                <span
                  className="eye"
                  role="button"
                  aria-label="Show or hide password"
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  {showPassword ? "Hide" : "Show"}
                </span>
              }
            />

            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="footer">
            <p>Don't have an account?</p>
            <Link to={PATHS.signUp} className="register-link">
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
