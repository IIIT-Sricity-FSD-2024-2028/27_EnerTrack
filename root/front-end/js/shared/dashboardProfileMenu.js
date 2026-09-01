/*
 * dashboardProfileMenu.js
 * Shared script for all dashboard overview pages.
 * - Populates sidebar name/role from sessionStorage
 * - Adds a role-switching popup (for admins) or Sign Out popup
 * - Shows the impersonation banner when a Super Admin is acting as someone
 * - Light theme to match the landing page design
 */
(function () {
  "use strict";

  /* ═══════════════════════════════════════════════════════════════
     Impersonation banner

     Lives here because this script is the one thing already loaded by
     every dashboard page, which is exactly the property the banner needs:
     a Super Admin acting as someone else must be able to tell, and get
     back, from wherever they end up.

     enertrack_impersonator holds the real Super Admin session while
     currentUser holds the person being viewed. Restoring is just swapping
     them back.
     ═══════════════════════════════════════════════════════════════ */
  (function impersonationBanner() {
    var stashed = localStorage.getItem("enertrack_impersonator");
    if (!stashed) return;

    var admin, viewing;
    try {
      admin = JSON.parse(stashed);
      viewing = JSON.parse(localStorage.getItem("currentUser") || "null");
    } catch (e) {
      // A corrupt stash would otherwise strand the admin in someone else's
      // session with no way back, so drop it rather than leave it.
      localStorage.removeItem("enertrack_impersonator");
      return;
    }
    if (!admin || !viewing) return;

    var style = document.createElement("style");
    style.textContent =
      ".et-imp-bar{position:fixed;top:0;left:0;right:0;z-index:10000;display:flex;" +
      "align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;" +
      "background:#1e3a5f;color:#fff;font:600 13px/1.4 system-ui,sans-serif;" +
      "padding:9px 16px;box-shadow:0 2px 10px rgba(0,0,0,0.2);}" +
      ".et-imp-bar span{font-weight:400;opacity:0.85;}" +
      ".et-imp-bar strong{font-weight:700;}" +
      ".et-imp-bar button{background:#fff;color:#1e3a5f;border:none;border-radius:6px;" +
      "padding:6px 14px;font:600 13px system-ui,sans-serif;cursor:pointer;}" +
      ".et-imp-bar button:hover{background:#eaf0f6;}" +
      "body{padding-top:38px!important;}";
    document.head.appendChild(style);

    var bar = document.createElement("div");
    bar.className = "et-imp-bar";
    bar.innerHTML =
      "<span>Viewing as</span> <strong>" +
      escapeText(viewing.name) +
      "</strong> <span>(" +
      escapeText(viewing.role) +
      ")</span>";

    var back = document.createElement("button");
    back.type = "button";
    back.textContent = "Return to " + escapeText(admin.name);
    back.onclick = function () {
      localStorage.setItem("currentUser", stashed);
      localStorage.removeItem("enertrack_impersonator");
      window.location.href = window.roleRoutes
        ? window.roleRoutes.forRole(admin.role)
        : "../system_admin/system_admin_overview.html";
    };
    bar.appendChild(back);
    document.body.appendChild(bar);

    function escapeText(v) {
      return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }
  })();

  var userData = localStorage.getItem("currentUser");
  if (!userData) {
    // Fallback: build currentUser from sidebar DOM if available
    var nameEl = document.getElementById("sidebarUserName");
    var roleEl = document.getElementById("sidebarUserRole");
    if (nameEl && roleEl && nameEl.textContent.trim()) {
      var fallbackUser = {
        name: nameEl.textContent.trim(),
        role: roleEl.textContent.trim(),
      };
      // Deliberately NOT persisted. Writing this to localStorage fabricates a
      // reusable session out of the sidebar's placeholder markup, and api.js
      // reads localStorage.currentUser for the x-role header on every request
      // from then on, on every page. Keep it local to this render.
      userData = JSON.stringify(fallbackUser);
    } else {
      return;
    }
  }

  var user = JSON.parse(userData);
  var firstName = user.name.split(" ")[0];

  /* ───── Populate sidebar info ───── */
  var el = document.getElementById("welcomeHeading");
  if (el) el.textContent = "Welcome back, " + firstName;

  var sn = document.getElementById("sidebarUserName");
  if (sn) sn.textContent = user.name;

  var sr = document.getElementById("sidebarUserRole");
  if (sr) sr.textContent = user.role;

  /* Remove any existing three-dots profile-menu buttons */
  var dots = document.querySelectorAll(".profile-menu");
  for (var d = 0; d < dots.length; d++) {
    dots[d].remove();
  }

  /* ───── Inject popup CSS (light theme matching landing page) ───── */
  var style = document.createElement("style");
  style.textContent =
    ".dash-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px);z-index:9999;display:none;align-items:center;justify-content:center;}" +
    ".dash-popup-overlay.open{display:flex;}" +
    ".dash-popup-card{background:#ffffff;border:2px solid rgba(0,0,0,0.1);border-radius:16px;padding:28px 24px 20px;width:320px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.15);}" +
    ".dash-popup-name{color:#111111;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:600;margin-bottom:2px;}" +
    ".dash-popup-role{color:#555555;font-size:13px;margin-bottom:16px;font-weight:500;}" +
    ".dash-popup-divider{height:1px;background:rgba(0,0,0,0.1);margin:0 0 8px;}" +
    ".dash-popup-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;font-size:14px;font-weight:500;color:#333333;text-decoration:none;transition:background .15s,color .15s;border:none;background:none;width:100%;cursor:pointer;font-family:'Inter',system-ui,sans-serif;}" +
    ".dash-popup-item:hover{background:rgba(47,125,79,0.08);color:#2f7d4f;}" +
    ".dash-popup-item svg{flex-shrink:0;opacity:0.5;}" +
    ".dash-popup-item:hover svg{opacity:1;stroke:#2f7d4f;}" +
    ".dash-popup-logout{color:#dc2626;}" +
    ".dash-popup-logout:hover{background:rgba(220,38,38,0.08);color:#dc2626;}" +
    ".dash-popup-logout:hover svg{stroke:#dc2626;}";
  document.head.appendChild(style);

  /* ───── Build popup HTML ───── */
  var userRoleStr = (user.role || "").trim();
  // Only EnerTrack's own Super Admin gets a way back to the admin console
  // from here. An Organization Admin is a client's own admin, scoped to
  // their organisation's admin workflows — not a way to morph into other
  // roles, same boundary already drawn on the landing page.
  //
  // This used to list every actor's dashboard directly. Dropped in favor
  // of one link back to the admin console: those dashboards are
  // tenant-scoped and Super Admin has no tenant, so visiting one directly
  // wouldn't show real data anyway — "Act as" from the console is the
  // actual way to see a specific person's dashboard, correctly scoped to
  // their own organisation.
  var isAdmin = userRoleStr === "Super Admin";

  var linksHTML = "";
  if (isAdmin) {
    linksHTML =
      '<a href="../system_admin/system_admin_overview.html" class="dash-popup-item">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' +
      "Admin Console</a>" +
      '<div class="dash-popup-divider" style="margin-top:8px;"></div>';
  }

  var popupHTML =
    '<div class="dash-popup-overlay" id="dashProfilePopup">' +
    '<div class="dash-popup-card">' +
    '<div class="dash-popup-name">' +
    user.name +
    "</div>" +
    '<div class="dash-popup-role">' +
    user.role +
    "</div>" +
    '<div class="dash-popup-divider"></div>' +
    linksHTML +
    '<button class="dash-popup-item dash-popup-logout" id="dashLogoutBtn" type="button">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
    "Sign Out</button>" +
    "</div>" +
    "</div>";

  document.body.insertAdjacentHTML("beforeend", popupHTML);

  var popup = document.getElementById("dashProfilePopup");

  /* ───── Attach click to ALL profile card variants ───── */
  var profileCards = document.querySelectorAll(".profile-card, .profile");
  for (var i = 0; i < profileCards.length; i++) {
    profileCards[i].style.cursor = "pointer";
    profileCards[i].addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      popup.classList.add("open");
    });
  }

  /* Close on overlay click (not on card) */
  popup.addEventListener("click", function (e) {
    if (e.target === popup) {
      popup.classList.remove("open");
    }
  });

  /* Sign Out */
  document
    .getElementById("dashLogoutBtn")
    .addEventListener("click", function () {
      localStorage.removeItem("currentUser");
      window.location.href = "../landing/landing.html";
    });
})();
