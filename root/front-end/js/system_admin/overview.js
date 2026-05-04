/**
 * overview.js
 * Admin Dashboard entrypoint.
 *
 * Data strategy:
 * - Users, campuses, buildings, departments, meters come ONLY from the backend API (DTOs).
 * - localStorage is used only for UI state (active tab, selected campus/building).
 * - The local universalDB / mockData is NOT used as a data source for these entities.
 */

import { resetAdminState, saveAdminState } from "./data/mockData.js";
import { renderAdminLayout } from "./modules/adminLayout.js";
import { cloneState, showToast } from "./utils/ui.js";

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("adminApp");
  if (!root) return;

  const app = {
    // Start with empty arrays — data comes exclusively from the backend
    state: {
      session: null,
      users: [],
      campuses: [],
      buildings: [],
      departments: [],
      meters: []
    },
    loading: true,
    activeTab: localStorage.getItem("admin_activeTab") || "users",
    selectedCampusId: localStorage.getItem("admin_selectedCampus") || null,
    selectedBuildingId: localStorage.getItem("admin_selectedBuilding") || null,

    async render(nextTab = this.activeTab) {
      this.activeTab = nextTab;
      localStorage.setItem("admin_activeTab", nextTab);
      if (this.selectedCampusId) localStorage.setItem("admin_selectedCampus", this.selectedCampusId);
      if (this.selectedBuildingId) localStorage.setItem("admin_selectedBuilding", this.selectedBuildingId);
      renderAdminLayout(root, this);
    },

    async update(mutator, message) {
      const nextState = cloneState(this.state);
      const result = mutator(nextState);
      if (result instanceof Promise) {
        await result;
      }
      this.state = nextState;
      this.render();
      if (message) showToast(message, "success");
    },

    async loadFromBackend() {
      if (!window.api) {
        showToast("Backend API unavailable — no data loaded.", "error");
        this.loading = false;
        this.render();
        return;
      }

      try {
        this.loading = true;
        this.render(); // render loading skeleton

        const [users, campuses, buildings, departments, meters] = await Promise.all([
          window.api.get('/users'),
          window.api.get('/campus'),
          window.api.get('/buildings'),
          window.api.get('/departments'),
          window.api.get('/meters')
        ]);

        this.state.users       = Array.isArray(users)       ? users       : [];
        this.state.campuses    = Array.isArray(campuses)    ? campuses    : [];
        this.state.buildings   = Array.isArray(buildings)   ? buildings   : [];
        this.state.departments = Array.isArray(departments) ? departments : [];
        this.state.meters      = Array.isArray(meters)      ? meters      : [];

        // Restore or default selected campus/building from persisted UI prefs
        if (!this.selectedCampusId || !this.state.campuses.some(c => c.campus_id === this.selectedCampusId)) {
          this.selectedCampusId = this.state.campuses[0]?.campus_id || null;
        }
        if (!this.selectedBuildingId || !this.state.buildings.some(b => b.building_id === this.selectedBuildingId)) {
          this.selectedBuildingId = this.state.buildings[0]?.building_id || null;
        }
      } catch (err) {
        console.error("Failed to load from backend:", err);
        showToast("Failed to load data from backend.", "error");
      } finally {
        this.loading = false;
        this.render();
      }
    },

    reset() {
      this.state = resetAdminState();
      this.selectedCampusId = this.state.campuses[0]?.campus_id || null;
      this.selectedBuildingId = this.state.buildings[0]?.building_id || null;
      this.render();
      showToast("Demo data reset.", "info");
    }
  };

  window.AdminDashboard = app;
  document.getElementById("resetDemoData")?.addEventListener("click", () => app.reset());

  // Boot: fetch everything from the backend. No localStorage seed for data.
  app.render(); // show loading state immediately
  app.loadFromBackend();
});

