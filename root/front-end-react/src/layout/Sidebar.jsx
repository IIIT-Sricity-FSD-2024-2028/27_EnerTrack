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
 *
 * On narrow screens (≤ 900px, see Sidebar.css) it collapses to a slim top
 * bar: the brand and a Menu button that opens the links and the profile card.
 * On wider screens the button is hidden and everything is always shown.
 */
import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { NAV, PATHS } from "../routes";
import "./Sidebar.css";

export default function Sidebar({ area, role, title, footer, actions }) {
  // An unknown area gives an empty list rather than crashing on undefined.map.
  // A link with a `roles` list is only kept when the signed-in role is in it.
  const items = (NAV[area] ?? []).filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  const panelId = useId();
  const { pathname } = useLocation();
  // The menu is open only on the page it was opened on, so following a link
  // closes it without any extra bookkeeping.
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === pathname;
  const setOpen = (next) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenOn(value ? pathname : null);
  };

  // Escape closes an open menu.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current = items.find((item) => pathname.startsWith(item.to));

  return (
    <aside className={`app-sidebar${open ? " is-open" : ""}`}>
      <div className="app-sidebar__top">
        {/* Same mark and wordmark as the landing page's navbar, so the brand
            looks identical before and after signing in. Like most sites, it
            leads back to the landing page (the session stays signed in). */}
        <Link
          to={PATHS.landing}
          className="app-sidebar__brand"
          aria-label="EnerTrack home page"
        >
          <img src="/assets/logo3.png" alt="" />
          <span>EnerTrack</span>
        </Link>

        <div className="app-sidebar__tools">
          {actions}
          <button
            type="button"
            className="app-sidebar__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="app-sidebar__toggle-label">
              {open ? "Close" : current?.label || "Menu"}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className="app-sidebar__panel" id={panelId}>
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
      </div>
    </aside>
  );
}
