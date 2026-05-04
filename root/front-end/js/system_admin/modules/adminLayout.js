import { renderInfrastructureManager } from "./infrastructureManager.js";
import { renderUserManagement } from "./UserManagement.js";
import { formatLabel } from "../utils/ui.js";

export function renderAdminLayout(root, app) {
  // Show a loading skeleton while backend data is being fetched
  if (app.loading) {
    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:80px;flex-direction:column;gap:16px;color:#6b7280;">
        <div style="width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#111827;border-radius:50%;animation:spin 0.7s linear infinite;"></div>
        <p style="font-size:14px;font-weight:500;">Loading from backend…</p>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      </div>`;
    return;
  }

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
  // Session may be null on first render; fall back to currentUser in localStorage
  let user = app.state.session?.user || null;
  const currentUserData = localStorage.getItem("currentUser");
  if (currentUserData) {
    try {
      user = JSON.parse(currentUserData);
    } catch (_) {}
  }
  if (!user) return; // nothing to render yet

  const firstName = user.name?.split(" ")[0] || "Admin";

  setText("sidebarUserName", user.name);
  setText("sidebarUserRole", formatLabel(user.role));
  setText("welcomeHeading", `Welcome back, ${firstName}`);
  setText(
    "pageSubheading",
    app.activeTab === "infrastructure"
      ? "Maintain campuses, buildings, departments, and meter inventory."
      : "Manage campus users, roles, and login access.",
  );

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.adminTab === app.activeTab,
    );
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
