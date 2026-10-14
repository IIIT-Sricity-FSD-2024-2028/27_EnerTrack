/**
 * NotFound — shown for any URL that no route matches (the `path="*"` route in
 * App.jsx). The old page used a script to copy window.location.pathname into
 * the markup; here useLocation() gives the same value as plain data.
 */
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { PATHS, homeForRole } from "../routes";
import "../styles/404.css";

// The three shortcuts are data; the page renders them with .map().
const QUICK_LINKS = [
  {
    label: "Home",
    to: PATHS.landing,
    icon: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
  {
    label: "Sign In",
    to: PATHS.signIn,
    icon: (
      <>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </>
    ),
  },
  {
    label: "Sign Up",
    to: PATHS.signUp,
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </>
    ),
  },
];

export default function NotFound() {
  // The address the visitor asked for, e.g. "/admin/oops".
  const { pathname } = useLocation();

  // "Back to Dashboard" goes to the signed-in user's own home page. For a
  // visitor who is not signed in, homeForRole falls back to the landing page.
  const { role } = useAuth();

  return (
    <div className="not-found-page">
      <nav className="navbar">
        <div className="left-nav">
          <Link to={PATHS.landing} className="logo">
            <img src="/assets/logo3.png" alt="EnerTrack Logo" />
            <span>EnerTrack</span>
          </Link>
          <div className="nav-links">
            <Link to={PATHS.landing}>Home</Link>
          </div>
        </div>
      </nav>

      <main className="error-container">
        <div className="error-card">
          <div className="error-code">
            <span className="digit">4</span>
            <span className="digit">0</span>
            <span className="digit">4</span>
          </div>

          <h1 className="error-title">Page not found.</h1>
          <p className="error-description">
            The page you're looking for doesn't exist or has been moved. Let's
            get you back on track.
          </p>

          <div className="error-links">
            {QUICK_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="error-link">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {link.icon}
                </svg>
                {link.label}
              </Link>
            ))}
          </div>

          <Link to={homeForRole(role)} className="btn-home">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Dashboard
          </Link>

          <div className="error-path">
            Requested: <strong>{pathname}</strong>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="copyright">© 2026 EnerTrack Energy Solutions.</div>
      </footer>
    </div>
  );
}
