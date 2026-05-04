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
    activeTab: "users",
    selectedBuildingId: null,

    render(nextTab = this.activeTab) {
      this.activeTab = nextTab;
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
      this.selectedBuildingId = this.state.buildings[0]?.building_id || null;
      this.render();
      showToast("Demo data reset.", "info");
    }
  };

  app.selectedBuildingId = app.state.buildings[0]?.building_id || null;
  window.AdminDashboard = app;

  document.getElementById("resetDemoData")?.addEventListener("click", () => app.reset());
  app.render();
});
