/*
 * dashboardProfileMenu.js
<<<<<<< HEAD
 * Shared script for dashboard/profile navigation.
 * - Populates sidebar name/role/avatar from sessionStorage
 * - Logs page visits per user
 * - System Administrator users: opens old-style profile modal menu with role links + Profile + Sign Out
 * - Other users: profile card navigates to profile.html
=======
 * Shared script for all dashboard overview pages.
 * - Populates sidebar name/role from sessionStorage
 * - Adds a role-switching popup (for System Administrator) or Sign Out popup
 * - Light theme to match the landing page design
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
 */
(function () {
    "use strict";

<<<<<<< HEAD
    var SUBFOLDERS = [
        "/admin/",
        "/technician/",
        "/finance-analyst/",
        "/sustainability_officer/",
        "/sign_in/",
        "/sign_up/",
        "/landing/"
    ];

    function safeParse(raw, fallback) {
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch (_) { return fallback; }
    }

    function normalizeRole(role) {
        var roleMap = {
            admin: "System Administrator",
            superuser: "System Administrator",
            enduser: "End User"
        };
        return roleMap[role] || role || "User";
    }

    function getCurrentUser() {
        var fromCurrentUser = safeParse(sessionStorage.getItem("currentUser"), null);
        if (fromCurrentUser) {
            fromCurrentUser.role = normalizeRole(fromCurrentUser.role);
            return fromCurrentUser;
        }

        var fromAdminSession = safeParse(sessionStorage.getItem("enertrack_session"), null);
        if (fromAdminSession) {
            return {
                name: fromAdminSession.name || "User",
                role: normalizeRole(fromAdminSession.role),
                email: fromAdminSession.email || "",
                avatar: fromAdminSession.avatar || "",
                profileKey: fromAdminSession.profileKey || ""
            };
        }

        return null;
    }

    function inSubfolder() {
        var path = window.location.pathname;
        for (var i = 0; i < SUBFOLDERS.length; i++) {
            if (path.indexOf(SUBFOLDERS[i]) !== -1) return true;
        }
        return false;
    }

    function profilePath() {
        return inSubfolder() ? "../profile.html" : "profile.html";
    }

    function fromProjectRoot(pathFromRoot) {
        return inSubfolder() ? "../" + pathFromRoot : pathFromRoot;
    }

    function deriveUserScope(user) {
        if (user && user.email) return String(user.email).toLowerCase();
        if (user && user.name) return String(user.name).trim().toLowerCase().replace(/\s+/g, "_");
        return "guest";
    }

    function scopedKey(base, user) {
        var scope = user && user.profileKey ? user.profileKey : deriveUserScope(user);
        return base + "::" + scope;
    }

    function ensureStableProfileKey(user) {
        if (!user) return;
        if (!user.profileKey) user.profileKey = deriveUserScope(user);

        var currentUser = safeParse(sessionStorage.getItem("currentUser"), null);
        if (currentUser) {
            currentUser.profileKey = user.profileKey;
            sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
        }

        var adminSession = safeParse(sessionStorage.getItem("enertrack_session"), null);
        if (adminSession) {
            adminSession.profileKey = user.profileKey;
            sessionStorage.setItem("enertrack_session", JSON.stringify(adminSession));
        }
    }

    function defaultAvatarPath() {
        return inSubfolder() ? "../sign_in/images/logo.png" : "sign_in/images/logo.png";
    }

    function getScopedAvatar(user) {
        var key = scopedKey("enertrack.avatar", user);
        return sessionStorage.getItem(key) || user.avatar || defaultAvatarPath();
    }

    function setProfileImages(user) {
        var avatar = getScopedAvatar(user);
        var fallback = defaultAvatarPath();
        var selectors = ".profile-img, .profile-card img, .profile img, .sidebar-profile img";
        var images = document.querySelectorAll(selectors);
        for (var i = 0; i < images.length; i++) {
            images[i].src = avatar;
            images[i].onerror = function () {
                this.onerror = null;
                this.src = fallback;
            };
        }
    }

    function logPageVisit(user) {
        var key = scopedKey("enertrack.activityLog", user);
        try {
            var log = safeParse(sessionStorage.getItem(key), []);
            log.unshift({
                action: "Visited " + document.title,
                timestamp: new Date().toLocaleString()
            });
            if (log.length > 20) log = log.slice(0, 20);
            sessionStorage.setItem(key, JSON.stringify(log));
        } catch (_) {}
    }

    function populateSidebar(user) {
        var firstName = user.name ? user.name.split(" ")[0] : "User";

        var welcome = document.getElementById("welcomeHeading");
        if (welcome) welcome.textContent = "Welcome back, " + firstName;

        var sidebarName = document.getElementById("sidebarUserName");
        if (sidebarName) sidebarName.textContent = user.name || "User";

        var sidebarRole = document.getElementById("sidebarUserRole");
        if (sidebarRole) sidebarRole.textContent = user.role || "User";
    }

    function isSystemAdministrator(user) {
        var normalized = user && user.role ? String(user.role).trim().toLowerCase() : "";
        return normalized === "system administrator" || normalized === "admin" || normalized === "superuser";
    }

    function wireDirectProfileNavigation(dest) {
        var links = document.querySelectorAll("a.profile-card");
        for (var p = 0; p < links.length; p++) {
            links[p].href = dest;
        }

        var cards = document.querySelectorAll(".profile-card, .profile, .sidebar-bottom .profile-card");
        for (var i = 0; i < cards.length; i++) {
            cards[i].style.cursor = "pointer";
            if (cards[i].dataset.etProfileWired === "1") continue;
            cards[i].dataset.etProfileWired = "1";
            cards[i].addEventListener("click", function (e) {
                e.preventDefault();
                window.location.href = dest;
            });
        }
    }

    function injectAdminMenuStyles() {
        if (document.getElementById("etAdminProfileMenuStyles")) return;

        var style = document.createElement("style");
        style.id = "etAdminProfileMenuStyles";
        style.textContent = "" +
            ".et-admin-profile-overlay{" +
            "position:fixed;inset:0;background:rgba(15,23,42,.35);display:none;" +
            "align-items:center;justify-content:center;z-index:2000;padding:20px}" +
            ".et-admin-profile-overlay.open{display:flex}" +
            ".et-admin-profile-close{" +
            "position:fixed;top:10px;right:10px;width:44px;height:44px;border-radius:999px;border:none;" +
            "background:#334155;color:#fff;font-size:28px;line-height:1;cursor:pointer}" +
            ".et-admin-profile-menu{" +
            "width:min(360px,92vw);background:#fff;border:1px solid #e5e7eb;border-radius:16px;" +
            "box-shadow:0 20px 55px rgba(0,0,0,.22);padding:22px}" +
            ".et-admin-profile-head{padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:12px}" +
            ".et-admin-profile-name{font-family:'PT Serif',serif;font-size:26px;font-weight:700;color:#111827}" +
            ".et-admin-profile-role{font-size:13px;color:#6b7280;margin-top:2px}" +
            ".et-admin-profile-links{display:flex;flex-direction:column;gap:4px}" +
            ".et-admin-profile-link{" +
            "display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:10px;" +
            "color:#111827;text-decoration:none;font-size:14px;font-weight:500}" +
            ".et-admin-profile-link:hover{background:#f3f4f6}" +
            ".et-admin-profile-divider{height:1px;background:#e5e7eb;margin:12px 0}" +
            ".et-admin-profile-logout{" +
            "display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:none;" +
            "color:#dc2626;font-size:15px;font-weight:600;cursor:pointer;padding:8px 10px;border-radius:10px}" +
            ".et-admin-profile-logout:hover{background:#fef2f2}";
        document.head.appendChild(style);
    }

    function adminRoleLinks() {
        return [
            { label: "System Administration", href: fromProjectRoot("admin/admin_overview.html"), icon: "A" },
            { label: "Sustainability Management", href: fromProjectRoot("sustainability_officer/sust_overview.html"), icon: "S" },
            { label: "Technician Operations", href: fromProjectRoot("technician/technician_overview.html"), icon: "T" },
            { label: "Financial Analysis", href: fromProjectRoot("finance-analyst/finance_overview.html"), icon: "$" }
        ];
    }

    function createAdminProfileMenu(user, profileDest) {
        injectAdminMenuStyles();

        var oldOverlay = document.getElementById("etAdminProfileOverlay");
        if (oldOverlay) oldOverlay.remove();

        var overlay = document.createElement("div");
        overlay.className = "et-admin-profile-overlay";
        overlay.id = "etAdminProfileOverlay";

        var closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "et-admin-profile-close";
        closeBtn.setAttribute("aria-label", "Close profile menu");
        closeBtn.textContent = "x";

        var menu = document.createElement("div");
        menu.className = "et-admin-profile-menu";
        menu.innerHTML =
            '<div class="et-admin-profile-head">' +
                '<div class="et-admin-profile-name">' + (user.name || "User") + '</div>' +
                '<div class="et-admin-profile-role">' + (user.role || "User") + '</div>' +
            '</div>' +
            '<div class="et-admin-profile-links" id="etAdminProfileLinks"></div>' +
            '<div class="et-admin-profile-divider"></div>' +
            '<button type="button" class="et-admin-profile-logout" id="etAdminProfileLogout">Sign Out</button>';

        overlay.appendChild(closeBtn);
        overlay.appendChild(menu);
        document.body.appendChild(overlay);

        var linksHost = menu.querySelector("#etAdminProfileLinks");
        var links = adminRoleLinks();
        links.push({ label: "Profile", href: profileDest, icon: "P" });
        for (var i = 0; i < links.length; i++) {
            var a = document.createElement("a");
            a.className = "et-admin-profile-link";
            a.href = links[i].href;
            a.innerHTML = "<span>" + links[i].icon + "</span><span>" + links[i].label + "</span>";
            linksHost.appendChild(a);
        }

        function closeMenu() {
            overlay.classList.remove("open");
        }
        function openMenu() {
            overlay.classList.add("open");
        }

        closeBtn.addEventListener("click", closeMenu);
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) closeMenu();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeMenu();
        });

        var logoutBtn = menu.querySelector("#etAdminProfileLogout");
        logoutBtn.addEventListener("click", function () {
            sessionStorage.removeItem("currentUser");
            sessionStorage.removeItem("enertrack_session");
            closeMenu();
            window.location.href = fromProjectRoot("landing/landing.html");
        });

        var cards = document.querySelectorAll(".profile-card, .profile, .sidebar-bottom .profile-card");
        for (var j = 0; j < cards.length; j++) {
            cards[j].style.cursor = "pointer";
            cards[j].addEventListener("click", function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                openMenu();
            }, true);
        }
    }

    var user = getCurrentUser();
    if (!user) return;

    ensureStableProfileKey(user);
    populateSidebar(user);
    setProfileImages(user);
    logPageVisit(user);

    // Remove stale/legacy menu artifacts
    var staleMenus = document.querySelectorAll(".profile-menu");
    for (var d = 0; d < staleMenus.length; d++) {
        staleMenus[d].remove();
    }

    var dest = profilePath();
    if (isSystemAdministrator(user)) createAdminProfileMenu(user, dest);
    else wireDirectProfileNavigation(dest);
=======
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
>>>>>>> 4c9ad4e385c59c452a6fa12788086dac413ce076
})();
