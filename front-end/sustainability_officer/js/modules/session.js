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
    
    // Wire logout profile card if exists
    const profileCard = document.querySelector(".profile-card");
    if (profileCard) {
      profileCard.addEventListener("click", (e) => {
        e.preventDefault();
        this.confirmLogout();
      });
    }
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
          window.location.href = "../sign_in/sign_in.html"; 
        }, 1000);
      }
    });
  }
};

export default SessionModule;
