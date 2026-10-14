import { Link } from "react-router-dom";
import { PATHS } from "../../routes";

// The page links are plain data. The nav renders them with .map(), so adding
// a link means adding one line here instead of another <a> in the markup.
const NAV_LINKS = [
  { label: "Home", href: "#hero" },
  { label: "What We Do", href: "#about" },
  { label: "How It Works", href: "#engagement" },
  { label: "Pricing", href: "#pricing" },
  { label: "Roles", href: "#roles" },
];

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="nav-inner">
        <div className="left-nav">
          <a href="#hero" className="logo">
            <img src="/assets/logo3.png" alt="EnerTrack Logo" />
            <span>EnerTrack</span>
          </a>
          <div className="nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="right-nav">
          <Link to={PATHS.signUp} className="btn-primary">
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}
