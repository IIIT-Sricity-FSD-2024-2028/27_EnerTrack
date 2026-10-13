import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { NAV, PATHS } from "../routes";
import "./Sidebar.css";

const ROLE_LOGOS = {
  sustainability: "/assets/logo_sustainability_officer.png",
  finance: "/assets/logo_finance-analyst.png",
  technician: "/assets/logo_technician.png",
  technicianJr: "/assets/logo_technician.png",
  admin: "/assets/system_admin_logo.png",
  auditor: "/assets/logo_shared.png",
  campus: "/assets/logo_shared.png",
};

function getNavIcon(to, label) {
  // Sustainability
  if (to.includes("/sustainability/overview")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    );
  }
  if (to.includes("/sustainability/monitoring")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }
  if (to.includes("/sustainability/report")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    );
  }
  if (to.includes("/sustainability/initiatives")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    );
  }
  if (to.includes("/sustainability/archives") || label === "Archives") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    );
  }

  // Finance
  if (to.includes("/finance/overview")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }
  if (to.includes("/finance/reports")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="17" x2="9" y2="13" />
        <line x1="12" y1="17" x2="12" y2="11" />
        <line x1="15" y1="17" x2="15" y2="15" />
      </svg>
    );
  }
  if (to.includes("/finance/costs")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 9v3a5 5 0 0 0 10 0V9" />
        <line x1="10" y1="4" x2="10" y2="8" />
        <line x1="14" y1="4" x2="14" y2="8" />
        <path d="M12 17v3" />
      </svg>
    );
  }
  if (to.includes("/finance/subscription")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="15" x2="10" y2="15" />
      </svg>
    );
  }

  // Technician & TechnicianJr
  if (to.includes("/technician/overview") || to.includes("/technician-jr/overview")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    );
  }
  if (to.includes("/technician/alerts")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    );
  }
  if (to.includes("/technician/maintenance")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );
  }
  if (to.includes("work-orders")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    );
  }

  // Fallback
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export default function Sidebar({ area, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // An unknown area gives an empty list rather than crashing on undefined.map
  const items = NAV[area] ?? [];
  const brandLogo = ROLE_LOGOS[area] || "/assets/logo_sustainability_officer.png";

  const handleSignOut = () => {
    logout();
    setIsProfileOpen(false);
    navigate(PATHS.landing);
  };

  const displayName = user?.name || "Maya Patel";
  const displayRole = user?.role || "Sustainability Officer";

  return (
    <>
      <aside className="app-sidebar">
        <NavLink to="/" className="app-sidebar__brand">
          <img
            src={brandLogo}
            alt="EnerTrack Logo"
            className="app-sidebar__logo-icon"
          />
          <img
            src="/assets/EnerTrack_text.png"
            alt="EnerTrack"
            className="app-sidebar__logo-text"
          />
        </NavLink>

        {title ? <p className="app-sidebar__title">{title}</p> : null}

        <nav className="app-sidebar__nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "app-sidebar__link is-active" : "app-sidebar__link"
              }
            >
              <span className="app-sidebar__icon">{getNavIcon(item.to, item.label)}</span>
              <span className="app-sidebar__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Profile Card in Sidebar Bottom */}
        <div style={{ marginTop: "auto", paddingTop: "12px" }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsProfileOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setIsProfileOpen(true);
            }}
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <img
              src="/assets/maya_patel.png"
              alt={displayName}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#e5e7eb",
              }}
            />
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#111827",
                }}
              >
                {displayName}
              </div>
              <div style={{ fontSize: "11px", color: "#6b7280" }}>
                {displayRole}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Profile Popup Modal matching dashboardProfileMenu.js */}
      {isProfileOpen && (
        <div
          className="dash-popup-overlay open"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setIsProfileOpen(false)}
        >
          <div
            className="dash-popup-card"
            style={{
              background: "#ffffff",
              border: "2px solid rgba(0, 0, 0, 0.1)",
              borderRadius: "16px",
              padding: "28px 24px 20px",
              width: "320px",
              maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="dash-popup-name"
              style={{
                color: "#111111",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "18px",
                fontWeight: 600,
                marginBottom: "2px",
              }}
            >
              {displayName}
            </div>
            <div
              className="dash-popup-role"
              style={{
                color: "#555555",
                fontSize: "13px",
                marginBottom: "16px",
                fontWeight: 500,
              }}
            >
              {displayRole}
            </div>
            <div
              className="dash-popup-divider"
              style={{
                height: "1px",
                background: "rgba(0, 0, 0, 0.1)",
                margin: "0 0 8px",
              }}
            />
            <button
              type="button"
              className="dash-popup-item dash-popup-logout"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 14px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 500,
                color: "#dc2626",
                border: "none",
                background: "none",
                width: "100%",
                cursor: "pointer",
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: "background 0.15s",
              }}
              onClick={handleSignOut}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
