/**
 * roleRoutes.js
 * Where each role lands after signing in.
 *
 * Loaded as a classic script so it can set window.roleRoutes for both
 * module and non-module consumers, the same way api.js does.
 *
 * This map used to live inside sign_in.js. It moved here because a second
 * caller appeared: when a Super Admin acts as another user, they have to be
 * sent to that user's dashboard, which is exactly the same question. Two
 * copies would have drifted apart the first time a page was renamed.
 *
 * Paths are relative to any html/<role>/ folder, since every dashboard page
 * sits one level down from html/.
 */
(function () {
  "use strict";

  var ROUTES = {
    // ── The client's own staff ──────────────────────────────────────
    "Organization Admin": "../system_admin/system_admin_overview.html",
    "Financial Analyst": "../finance-analyst/finance_overview.html",
    "Technician Administrator": "../technician/technician_overview.html",
    Technician: "../technician_jr/technician_jr_work_orders.html",
    "Sustainability Officer": "../sustainability_officer/sust_overview.html",
    "Campus Visitor": "../enduser/enduser_dashboard.html",

    // ── EnerTrack's own staff ───────────────────────────────────────
    // They send no x-org-id, so their dashboards render the cross-tenant
    // view rather than a single client's.
    "Super Admin": "../system_admin/system_admin_overview.html",
    "Certified Energy Auditor": "../auditor/auditor_overview.html",

    // ── Client-side B2B roles ───────────────────────────────────────
    // Routed to the dashboard each one maps onto, mirroring
    // ROLE_EQUIVALENTS in the backend. The Economic Buyer is the
    // exception: they are the person who signs the cheque, so they land
    // on the subscription page rather than on utility costs.
    "Facility Manager": "../technician/technician_overview.html",
    "Economic Buyer": "../finance-analyst/finance_subscription.html",
    "Department Head": "../enduser/enduser_dashboard.html",
  };

  window.roleRoutes = {
    /** Landing page for a role, falling back to the public landing page. */
    forRole: function (role) {
      return ROUTES[role] || "../landing/landing.html";
    },
    all: ROUTES,
  };
})();
