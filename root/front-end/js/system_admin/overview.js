/**
 * overview.js
 * Admin Dashboard entrypoint.
 *
 * Backend handoff:
 * - A future React useEffect or plain fetch() boot call should replace getAdminState().
 * - Module CRUD handlers already flow through app.update(), which is the single sync point.
 */

import { getAdminState, resetAdminState, saveAdminState } from "./data/mockData.js";
import { renderAdminLayout } from "./modules/adminLayout.js";
import { cloneState, showToast } from "./utils/ui.js";

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("adminApp");
  if (!root) return;

  const app = {
    state: getAdminState(),
    activeTab: localStorage.getItem("admin_activeTab") || "users",
    selectedCampusId: localStorage.getItem("admin_selectedCampus") || null,
    selectedBuildingId: localStorage.getItem("admin_selectedBuilding") || null,

    render(nextTab = this.activeTab) {
      this.activeTab = nextTab;
      localStorage.setItem("admin_activeTab", nextTab);
      if (this.selectedCampusId) localStorage.setItem("admin_selectedCampus", this.selectedCampusId);
      if (this.selectedBuildingId) localStorage.setItem("admin_selectedBuilding", this.selectedBuildingId);
      renderAdminLayout(root, this);
    },

    update(mutator, message) {
      const nextState = cloneState(this.state);
      mutator(nextState);
      this.state = nextState;
      saveAdminState(this.state);
      this.state = getAdminState();
      this.render();
      if (message) showToast(message, "success");
    },

    reset() {
      this.state = resetAdminState();
      this.selectedCampusId = this.state.campuses[0]?.campus_id || null;
      this.selectedBuildingId = this.state.buildings[0]?.building_id || null;
      this.render();
      showToast("Demo data reset.", "info");
    }
  };

  // Only default if nothing was persisted
  if (!app.selectedCampusId || !app.state.campuses.some(c => c.campus_id === app.selectedCampusId)) {
    app.selectedCampusId = app.state.campuses[0]?.campus_id || null;
  }
  if (!app.selectedBuildingId || !app.state.buildings.some(b => b.building_id === app.selectedBuildingId)) {
    app.selectedBuildingId = app.state.buildings[0]?.building_id || null;
  }
  window.AdminDashboard = app;

  document.getElementById("resetDemoData")?.addEventListener("click", () => app.reset());
  app.render();
});
