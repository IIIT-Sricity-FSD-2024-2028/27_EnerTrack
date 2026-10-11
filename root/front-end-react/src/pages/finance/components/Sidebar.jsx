/**
 * Sidebar — logo, the five Financial Analyst menu items and the profile card.
 * NavLink adds the "active" class to the item for the current page, which
 * replaces the hard-coded `class="menu-item active"` in each HTML file.
 */
import { Link, NavLink } from "react-router-dom";

const ICONS = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>
  ),
  reports: (
    <>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="17" x2="9" y2="13" />
      <line x1="12" y1="17" x2="12" y2="11" />
      <line x1="15" y1="17" x2="15" y2="15" />
    </>
  ),
  costs: (
    <>
      <path d="M7 9v3a5 5 0 0 0 10 0V9" />
      <line x1="10" y1="4" x2="10" y2="8" />
      <line x1="14" y1="4" x2="14" y2="8" />
      <path d="M12 17v3" />
    </>
  ),
  subscription: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </>
  ),
  archives: (
    <>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </>
  ),
};

const MENU = [
  { path: "overview", label: <>Overview</> },
  { path: "reports", label: <>Financial<br />Reports &amp; Impact</> },
  { path: "costs", label: <>Utility Costs</> },
  { path: "subscription", label: <>Your EnerTrack<br />Subscription</> },
  { path: "archives", label: <>Archives</> },
];

export default function Sidebar({ user, onProfileClick }) {
  return (
    <div className="sidebar">
      <div>
        <Link to="/" className="logo">
          <img src="/assets/logo_finance-analyst.png" alt="EnerTrack Logo" className="logo-icon" />
          <img src="/assets/EnerTrack_text.png" alt="EnerTrack" className="logo-text" />
        </Link>
        <div className="menu">
          {MENU.map((item) => (
            <NavLink
              key={item.path}
              to={`/finance/${item.path}`}
              className={({ isActive }) => (isActive ? "menu-item active" : "menu-item")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[item.path]}
              </svg>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="profile" onClick={onProfileClick}>
        <div className="profile-left">
          <img src="https://i.pravatar.cc/40?img=12" alt="" />
          <div>
            <div className="profile-name">{user.name}</div>
            <div className="profile-role">{user.role}</div>
          </div>
        </div>
        ⋮
      </div>
    </div>
  );
}
