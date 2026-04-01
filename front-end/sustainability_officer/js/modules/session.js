/**
 * session.js
 * Handles user session for Sustainability Officer.
 */
import { showToast, openModal } from '../utils/utils.js';

const SessionModule = {
  initSession() {
    // Just a basic check.
    const currentUser = sessionStorage.getItem("et_current_user") || "Maya Patel";
    sessionStorage.setItem("et_current_user", currentUser);
    
    // Profile card click is now handled by ../dashboardProfileMenu.js
  },

  confirmLogout() {
    openModal({
      title: "Sign Out",
      bodyHTML: "<p>Are you sure you want to sign out of the Sustainability Dashboard?</p>",
      confirmLabel: "Sign Out",
      danger: true,
      onConfirm: () => {
        showToast("Signing out...", "info", 1000);
        setTimeout(() => {
          sessionStorage.removeItem("et_current_user");
          window.location.href = "../landing/landing.html"; 
        }, 1000);
      }
    });
  }
};

export default SessionModule;
