import { renderInfrastructureManager } from "./infrastructureManager.js";
import { renderUserManagement } from "./UserManagement.js";
import { formatLabel } from "../utils/ui.js";

export function renderAdminLayout(root, app) {
  syncChrome(app);

  const totals = getTotals(app.state);
  root.innerHTML = `
    <div class="summary-grid" aria-label="Admin summary">
      <article class="summary-card">
        <span>Total Users</span>
        <strong>${totals.users}</strong>
      </article>
      <article class="summary-card">
        <span>Campuses</span>
        <strong>${totals.campuses}</strong>
      </article>
      <article class="summary-card">
        <span>Buildings</span>
        <strong>${totals.buildings}</strong>
      </article>
      <article class="summary-card">
        <span>Meters</span>
        <strong>${totals.meters}</strong>
      </article>
    </div>

    <div class="content-tabs" role="tablist" aria-label="Admin dashboard sections">
      <button class="tab-btn ${app.activeTab === "users" ? "active" : ""}" type="button" data-admin-tab="users">
        User Management
      </button>
      <button class="tab-btn ${app.activeTab === "infrastructure" ? "active" : ""}" type="button" data-admin-tab="infrastructure">
        Infrastructure
      </button>
    </div>

    <div id="adminView"></div>
  `;

  wireTabs(app);

  const view = root.querySelector("#adminView");
  if (app.activeTab === "infrastructure") {
    renderInfrastructureManager(view, app);
  } else {
    renderUserManagement(view, app);
  }
}

function syncChrome(app) {
  const user = app.state.session.user;
  const firstName = user.name.split(" ")[0] || "Admin";

  setText("sidebarUserName", user.name);
  setText("sidebarUserRole", formatLabel(user.role));
  setText("welcomeHeading", `Welcome back, ${firstName}`);
  setText(
    "pageSubheading",
    app.activeTab === "infrastructure"
      ? "Maintain campus buildings and meter inventory."
      : "Manage campus users, roles, and login access."
  );

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === app.activeTab);
  });
}

function wireTabs(app) {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.onclick = () => app.render(button.dataset.adminTab);
  });
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function getTotals(state) {
  return {
    users: state.users?.length || 0,
    campuses: state.campuses?.length || 0,
    buildings: state.buildings?.length || 0,
    meters: state.meters?.length || 0
  };
}
