/**
 * routes.js — every URL in the app, in one place.
 *
 * Not React. Plain data that Sidebar, RequireRole and every <Link> read, so
 * a route can be renamed by editing one file instead of hunting through 31.
 */

export const PATHS = {
  landing: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  registerOrganisation: "/register-organisation",

  admin: {
    users: "/admin/users",
    organizations: "/admin/organizations",
    plans: "/admin/plans",
    revenue: "/admin/revenue",
    proposals: "/admin/proposals",
    infrastructure: "/admin/infrastructure",
  },
  finance: {
    overview: "/finance/overview",
    reports: "/finance/reports",
    costs: "/finance/costs",
    subscription: "/finance/subscription",
    archives: "/finance/archives",
  },
  sustainability: {
    overview: "/sustainability/overview",
    monitoring: "/sustainability/monitoring",
    report: "/sustainability/report",
    initiatives: "/sustainability/initiatives",
    archives: "/sustainability/archives",
  },
  technician: {
    overview: "/technician/overview",
    alerts: "/technician/alerts",
    maintenance: "/technician/maintenance",
    workOrders: "/technician/work-orders",
  },
  technicianJr: {
    overview: "/technician-jr/overview",
    workOrders: "/technician-jr/work-orders",
  },
  auditor: {
    overview: "/auditor/overview",
    audits: "/auditor/audits",
  },
  campus: {
    dashboard: "/campus/dashboard",
    wastage: "/campus/wastage",
    archives: "/campus/archives",
  },
};

/**
 * Where each role lands after signing in. Ported from
 * js/shared/roleRoutes.js — values are references into PATHS, never strings,
 * so renaming a route updates this map automatically.
 */
export const ROLE_HOME = {
  "Organization Admin": PATHS.admin.users,
  "Financial Analyst": PATHS.finance.overview,
  "Technician Administrator": PATHS.technician.overview,
  Technician: PATHS.technicianJr.overview,
  "Sustainability Officer": PATHS.sustainability.overview,
  "Campus Visitor": PATHS.campus.dashboard,

  // EnerTrack's own staff — they send no x-org-id, so their dashboards
  // render the cross-tenant view rather than one client's.
  "Super Admin": PATHS.admin.users,
  "Certified Energy Auditor": PATHS.auditor.overview,

  // B2B roles with no dashboard of their own, mapped onto the one they match.
  // Economic Buyer lands on subscription, not costs — they sign the cheque.
  "Facility Manager": PATHS.technician.overview,
  "Economic Buyer": PATHS.finance.subscription,
  "Department Head": PATHS.campus.dashboard,
};

/**
 * The landing page for a role, falling back to the public landing page.
 *
 * Callers go through this rather than reading ROLE_HOME directly, because an
 * unrecognised role would give undefined, and <Navigate to={undefined} />
 * fails in a way that is horrible to trace back to its cause.
 */
export function homeForRole(role) {
  return ROLE_HOME[role] ?? PATHS.landing;
}

/**
 * Which sidebar an actor sees. Eleven roles collapse onto seven areas,
 * because the B2B roles reuse another role's dashboard rather than having
 * one of their own — the same collapsing the backend does in ROLE_EQUIVALENTS.
 *
 * This lives here rather than inside Sidebar because RequireRole needs the
 * same answer when deciding whether someone may open a given branch.
 */
export const ROLE_AREA = {
  "Organization Admin": "admin",
  "Super Admin": "admin",

  "Financial Analyst": "finance",
  "Economic Buyer": "finance",

  "Sustainability Officer": "sustainability",

  "Technician Administrator": "technician",
  "Facility Manager": "technician",

  Technician: "technicianJr",

  "Certified Energy Auditor": "auditor",

  "Campus Visitor": "campus",
  "Department Head": "campus",
};

/** The nav area for a role, or null for a role with no dashboard. */
export function areaForRole(role) {
  return ROLE_AREA[role] ?? null;
}

/**
 * Sidebar links per role area, in display order.
 * Labels taken verbatim from the old HTML sidebars.
 */
export const NAV = {
  admin: [
    { label: "User Management", to: PATHS.admin.users },
    { label: "Organisations", to: PATHS.admin.organizations },
    { label: "Pricing Plans", to: PATHS.admin.plans },
    { label: "Revenue", to: PATHS.admin.revenue },
    { label: "EnerTrack Proposal", to: PATHS.admin.proposals },
    { label: "Infrastructure", to: PATHS.admin.infrastructure },
  ],
  finance: [
    { label: "Overview", to: PATHS.finance.overview },
    { label: "Financial Reports & Impact", to: PATHS.finance.reports },
    { label: "Utility Costs", to: PATHS.finance.costs },
    { label: "Your EnerTrack Subscription", to: PATHS.finance.subscription },
    { label: "Archives", to: PATHS.finance.archives },
  ],
  sustainability: [
    { label: "Overview", to: PATHS.sustainability.overview },
    {
      label: "Environmental Impact Monitoring",
      to: PATHS.sustainability.monitoring,
    },
    { label: "Sustainability Reporting", to: PATHS.sustainability.report },
    {
      label: "Sustainable Conservation Initiatives",
      to: PATHS.sustainability.initiatives,
    },
    { label: "Archives", to: PATHS.sustainability.archives },
  ],
  technician: [
    { label: "Overview", to: PATHS.technician.overview },
    { label: "Real-Time Anomaly Alerts", to: PATHS.technician.alerts },
    {
      label: "Fault Detection & Diagnostics",
      to: PATHS.technician.maintenance,
    },
    { label: "Maintenance Work Orders", to: PATHS.technician.workOrders },
  ],
  technicianJr: [
    { label: "Overview", to: PATHS.technicianJr.overview },
    { label: "My Work Orders", to: PATHS.technicianJr.workOrders },
  ],
  auditor: [
    { label: "Overview", to: PATHS.auditor.overview },
    { label: "Audits & Recommendations", to: PATHS.auditor.audits },
  ],
  campus: [
    { label: "Report an Issue", to: PATHS.campus.dashboard },
    { label: "Report Wastage", to: PATHS.campus.wastage },
    { label: "My Archives", to: PATHS.campus.archives },
  ],
};
