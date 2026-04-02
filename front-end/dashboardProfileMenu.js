/*
 * dashboardProfileMenu.js
 * Shared script for all dashboard overview pages.
 * - Populates sidebar name/role from sessionStorage
 * - Adds a role-switching popup (for System Administrator) or Sign Out popup
 * - Light theme to match the landing page design
 */
(function () {
    "use strict";

    var userData = sessionStorage.getItem("currentUser");
    if (!userData) return;

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
    var isAdmin = user.role === "System Administrator";

    var linksHTML = "";
    if (isAdmin) {
        linksHTML =
            '<a href="../admin/admin_overview.html" class="dash-popup-item">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' +
                "System Administration</a>" +
            '<a href="../sustainability_officer/sust_overview.html" class="dash-popup-item">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 2 8a7 7 0 0 1-7 7c0 1 0 3-2 3z"/></svg>' +
                "Sustainability Management</a>" +
            '<a href="../technician/technician_overview.html" class="dash-popup-item">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' +
                "Technician Operations</a>" +
            '<a href="../finance-analyst/finance_overview.html" class="dash-popup-item">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' +
                "Financial Analysis</a>" +
            '<div class="dash-popup-divider" style="margin-top:8px;"></div>';
    }

    var popupHTML =
        '<div class="dash-popup-overlay" id="dashProfilePopup">' +
            '<div class="dash-popup-card">' +
                '<div class="dash-popup-name">' + user.name + "</div>" +
                '<div class="dash-popup-role">' + user.role + "</div>" +
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
    document.getElementById("dashLogoutBtn").addEventListener("click", function () {
        sessionStorage.removeItem("currentUser");
        window.location.href = "../landing/landing.html";
    });
})();
