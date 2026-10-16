import { Link } from "react-router-dom";
import { PATHS } from "../../routes";
import ProfileMenu from "./ProfileMenu";

// The page links are plain data. The nav renders them with .map(), so adding
// a link means adding one line here instead of another <a> in the markup.
const NAV_LINKS = [
  { label: "Home", href: "#hero" },
  { label: "What We Do", href: "#about" },
  { label: "How It Works", href: "#engagement" },
  { label: "Pricing", href: "#pricing" },
  { label: "Roles", href: "#roles" },
];

// `user` is null when signed out. `onSignOut` is passed on to the profile menu.
// `scrolled` is true once the page has been scrolled; it adds the shadow.
export default function Navbar({ user, onSignOut, scrolled }) {
  return (
    <nav className={scrolled ? "navbar scrolled" : "navbar"} aria-label="Main">
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
          {user ? (
            <ProfileMenu user={user} onSignOut={onSignOut} />
          ) : (
            <>
              <Link to={PATHS.signIn} className="btn-secondary">
                Sign In
              </Link>
              <Link to={PATHS.registerOrganisation} className="btn-primary">
                Request an audit
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
