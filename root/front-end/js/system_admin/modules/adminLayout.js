import { renderInfrastructureManager } from "./infrastructureManager.js";
import { renderUserManagement } from "./UserManagement.js";
import { formatLabel } from "../utils/ui.js";

export function renderAdminLayout(root, app) {
  syncChrome(app);

  root.innerHTML = `<div id="adminView"></div>`;

  wireTabs(app);

  const view = root.querySelector("#adminView");
  if (app.activeTab === "infrastructure") {
    renderInfrastructureManager(view, app);
  } else {
    renderUserManagement(view, app);
  }
}

function syncChrome(app) {
  let user = app.state.session.user;
  const currentUserData = localStorage.getItem("currentUser");
  if (currentUserData) {
    try {
      user = JSON.parse(currentUserData);
    } catch (_) {}
  }

  const firstName = user.name.split(" ")[0] || "Admin";

  setText("sidebarUserName", user.name);
  setText("sidebarUserRole", formatLabel(user.role));
  setText("welcomeHeading", `Welcome back, ${firstName}`);
  setText(
    "pageSubheading",
    app.activeTab === "infrastructure"
      ? "Maintain campuses, buildings, departments, and meter inventory."
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

