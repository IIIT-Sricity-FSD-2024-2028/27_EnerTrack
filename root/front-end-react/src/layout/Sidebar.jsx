/**
 * Sidebar.jsx — one sidebar for the whole app.
 *
 * The old front end had <aside class="sidebar"> copy-pasted into 17 HTML
 * files. Because this renders OUTSIDE <Routes>, it is written once and stays
 * mounted while the page inside it changes.
 *
 * It takes the area as a prop rather than reading the signed-in user itself.
 * That keeps it a presentational component: give it an area, it renders those
 * links, and it behaves identically whether it is driven by a real session or
 * by a hardcoded value while you are building. DashboardLayout does the
 * role -> area lookup and passes the answer down.
 */
import { NavLink } from "react-router-dom";
import { NAV } from "../routes";
import "./Sidebar.css";

export default function Sidebar({ area, role, title, footer }) {
  // An unknown area gives an empty list rather than crashing on undefined.map.
  // A link with a `roles` list is only kept when the signed-in role is in it.
  const items = (NAV[area] ?? []).filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  return (
    <aside className="app-sidebar">
      {/* Same mark and wordmark as the landing page's navbar, so the brand
          looks identical before and after signing in. */}
      <div className="app-sidebar__brand">
        <img src="/assets/logo3.png" alt="" />
        <span>EnerTrack</span>
      </div>

      {title ? <p className="app-sidebar__title">{title}</p> : null}

      <nav className="app-sidebar__nav" aria-label="Main">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "app-sidebar__link is-active" : "app-sidebar__link"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Pinned to the bottom: margin-top: auto in Sidebar.css */}
      {footer ? <div className="app-sidebar__footer">{footer}</div> : null}
    </aside>
  );
}
