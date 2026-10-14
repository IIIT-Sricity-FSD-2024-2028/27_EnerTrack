import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { homeForRole } from "../../routes";

// What the dashboard link in the dropdown is called, per role. The address
// itself comes from homeForRole() in routes.js, so it is never typed here.
const DASHBOARD_LABEL = {
  "Super Admin": "Organisation Dashboard",
  "Organization Admin": "Organisation Dashboard",
  "Sustainability Officer": "Sustainability Dashboard",
  Technician: "Technician Dashboard",
  "Technician Administrator": "Technician Admin Dashboard",
  "Financial Analyst": "Finance Analyst Dashboard",
  "Campus Visitor": "Report an Issue",
  "Certified Energy Auditor": "Auditor Dashboard",
  "Economic Buyer": "Subscription Overview",
  "Facility Manager": "Facility Dashboard",
  "Department Head": "Department Dashboard",
};

/**
 * ProfileMenu — the round avatar in the navbar with its dropdown.
 * Props: `user` (name and role to show) and `onSignOut` (what the Sign Out
 * button does). The menu does not know how signing out works; the parent
 * passes that in.
 */
export default function ProfileMenu({ user, onSignOut }) {
  // Whether the dropdown is showing. Clicking the avatar flips it.
  const [open, setOpen] = useState(false);

  // A ref gives us the real DOM element, so we can ask "was that click inside
  // the menu?" below.
  const wrapperRef = useRef(null);

  // Side effect: listen for clicks anywhere on the page, and close the
  // dropdown when the click lands outside the menu.
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);

    // Cleanup: remove the listener when the menu leaves the screen (for
    // example after signing out). Otherwise listeners would pile up.
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const dashboardLabel = DASHBOARD_LABEL[user.role];

  return (
    <div className="profile-wrapper" ref={wrapperRef}>
      <button
        className="profile-circle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <img src="https://i.pravatar.cc/100" alt="User Profile" />
      </button>

      <div className={open ? "profile-dropdown open" : "profile-dropdown"}>
        <div className="dropdown-header">{user.name}</div>
        <div className="dropdown-role">{user.role}</div>
        <div className="dropdown-divider" />

        {dashboardLabel && (
          <Link to={homeForRole(user.role)} className="dropdown-item">
            {dashboardLabel}
          </Link>
        )}

        <div className="dropdown-divider" />
        <button
          className="dropdown-item dropdown-logout"
          type="button"
          onClick={() => {
            setOpen(false);
            onSignOut();
          }}
        >
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}
