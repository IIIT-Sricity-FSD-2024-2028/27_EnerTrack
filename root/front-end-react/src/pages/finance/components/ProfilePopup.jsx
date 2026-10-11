/**
 * ProfilePopup — opens when the profile card is clicked.
 * Port of dashboardProfileMenu.js: shows the name and role and a Sign Out
 * button. Signing out goes through useAuth().logout().
 */
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";

export default function ProfilePopup({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate("/");
  }

  return (
    <div
      className="dash-popup-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dash-popup-card">
        <div className="dash-popup-name">{user.name}</div>
        <div className="dash-popup-role">{user.role}</div>
        <div className="dash-popup-divider"></div>
        <button className="dash-popup-item dash-popup-logout" type="button" onClick={handleSignOut}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
