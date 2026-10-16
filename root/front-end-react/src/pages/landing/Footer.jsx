import { Link } from "react-router-dom";
import { PATHS } from "../../routes";

// The footer links are plain data, like the navbar's, so adding one is one line.
const SECTION_LINKS = [
  { label: "What we do", href: "#about" },
  { label: "How it works", href: "#engagement" },
  { label: "Pricing", href: "#pricing" },
  { label: "Roles", href: "#roles" },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <strong>EnerTrack</strong>
          <p>
            Energy audits and monitoring for campuses: we audit, we monitor,
            you save.
          </p>
        </div>

        <nav className="footer-col" aria-label="Footer">
          <h5>Explore</h5>
          {SECTION_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="footer-col">
          <h5>Get started</h5>
          <Link to={PATHS.registerOrganisation}>Register your organisation</Link>
          <Link to={PATHS.signIn}>Sign in</Link>
          <Link to={`${PATHS.signIn}?mode=campus`}>
            Students and faculty: create an account
          </Link>
        </div>
      </div>
      <div className="copyright">© 2026 EnerTrack Energy Solutions.</div>
    </footer>
  );
}
