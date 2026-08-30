import { renderInfrastructureManager } from "./infrastructureManager.js";
import { renderOrganizationsManager } from "./organizationsManager.js";
import { renderPlansManager } from "./plansManager.js";
import { renderProposalManager } from "./proposalManager.js";
import { renderRevenueManager } from "./revenueManager.js";
import { renderUserManagement } from "./UserManagement.js";
import { formatLabel } from "../utils/ui.js";

/**
 * Tabs only EnerTrack's own operator may open.
 *
 * activeTab is restored from localStorage, so a client's admin sitting at a
 * machine where a Super Admin was last signed in would otherwise land
 * straight on a tab whose every request answers 403. Convenience only —
 * every rule behind these tabs is enforced by the backend.
 */
const PLATFORM_ONLY_TABS = ["organizations", "plans", "revenue"];

/** The signed-in user, or null. Session first, localStorage as the fallback. */
function currentUser(app) {
  const stored = localStorage.getItem("currentUser");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (_) {}
  }
  return app.state.session?.user || null;
}

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

  if (
    PLATFORM_ONLY_TABS.includes(app.activeTab) &&
    currentUser(app)?.role !== "Super Admin"
  ) {
    app.activeTab = "users";
  }

  if (app.activeTab === "infrastructure") {
    renderInfrastructureManager(view, app);
  } else if (app.activeTab === "organizations") {
    renderOrganizationsManager(view, app);
  } else if (app.activeTab === "plans") {
    renderPlansManager(view, app);
  } else if (app.activeTab === "revenue") {
    renderRevenueManager(view, app);
  } else if (app.activeTab === "proposal") {
    // Client-side on purpose: this is where an Organization Admin answers
    // the proposal their auditor sent, so it must not be platform-only.
    renderProposalManager(view, app);
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
  // Runs before the early return below: with no session at all the tab must
  // be hidden, not left visible by default. Convenience only, since every rule
  // behind these tabs is enforced by the backend.
  document.querySelectorAll("[data-requires-role]").forEach((button) => {
    button.style.display =
      user && user.role === button.dataset.requiresRole ? "" : "none";
  });

  if (!user) return; // nothing to render yet

  const firstName = user.name?.split(" ")[0] || "Admin";

  setText("sidebarUserName", user.name);
  setText("sidebarUserRole", formatLabel(user.role));
  setText("welcomeHeading", `Welcome back, ${firstName}`);
  setText(
    "pageSubheading",
    {
      infrastructure:
        "Maintain campuses, buildings, departments, and meter inventory.",
      organizations:
        "Client organisations. Each one is a separate tenant with its own isolated data.",
      plans:
        "EnerTrack's price catalogue. Every figure the billing engine uses lives on these rows.",
      revenue:
        "Platform revenue across every client. MRR reflects live contracts and current staff counts.",
      proposal:
        "What EnerTrack's auditor recommends for your organisation, and what it would cost.",
    }[app.activeTab] || "Manage campus users, roles, and login access.",
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
