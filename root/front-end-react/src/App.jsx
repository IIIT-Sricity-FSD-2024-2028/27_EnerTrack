/**
 * App.jsx — the route table.
 *
 * <Routes> renders exactly one matching <Route> for the current URL. Anything
 * outside it — the <Sidebar> below — renders on every page. That is the whole
 * mechanism: one sidebar serves every dashboard, where the old front end had
 * 17 copies of the same markup.
 *
 * Every path comes from routes.js. No URL string is ever typed here.
 */
import { Routes, Route } from "react-router-dom";
import { PATHS } from "./routes";
import Sidebar from "./layout/Sidebar";

import Landing from "./pages/landing/Landing";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import RegisterOrganisation from "./pages/auth/RegisterOrganisation";

import AdminUsers from "./pages/admin/Users";
import AdminOrganizations from "./pages/admin/Organizations";
import AdminPlans from "./pages/admin/Plans";
import AdminRevenue from "./pages/admin/Revenue";
import AdminProposals from "./pages/admin/Proposals";
import AdminInfrastructure from "./pages/admin/Infrastructure";

import FinanceOverview from "./pages/finance/Overview";
import FinanceReports from "./pages/finance/Reports";
import FinanceCosts from "./pages/finance/Costs";
import FinanceSubscription from "./pages/finance/Subscription";
import FinanceArchives from "./pages/finance/Archives";

import SustainabilityOverview from "./pages/sustainability/Overview";
import SustainabilityMonitoring from "./pages/sustainability/Monitoring";
import SustainabilityReport from "./pages/sustainability/Report";
import SustainabilityInitiatives from "./pages/sustainability/Initiatives";
import SustainabilityArchives from "./pages/sustainability/Archives";

import TechnicianOverview from "./pages/technician/Overview";
import TechnicianAlerts from "./pages/technician/Alerts";
import TechnicianMaintenance from "./pages/technician/Maintenance";
import TechnicianWorkOrders from "./pages/technician/WorkOrders";

import TechnicianJrOverview from "./pages/technician-jr/Overview";
import TechnicianJrWorkOrders from "./pages/technician-jr/WorkOrders";

import AuditorOverview from "./pages/auditor/Overview";
import AuditorAudits from "./pages/auditor/Audits";

import CampusDashboard from "./pages/campus/Dashboard";
import CampusWastage from "./pages/campus/Wastage";
import CampusArchives from "./pages/campus/Archives";

import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Temporary: the area is hardcoded until DashboardLayout derives it
          from the signed-in user's role. Sidebar does not care which — that is
          the point of passing it as a prop. */}
      <Sidebar area="technician" title="Navigation" />

      <main style={{ flex: 1, padding: "24px" }}>
        <Routes>
          {/* Public */}
          <Route path={PATHS.landing} element={<Landing />} />
          <Route path={PATHS.signIn} element={<SignIn />} />
          <Route path={PATHS.signUp} element={<SignUp />} />
          <Route
            path={PATHS.registerOrganisation}
            element={<RegisterOrganisation />}
          />

          {/* Organisation Admin / Super Admin */}
          <Route path={PATHS.admin.users} element={<AdminUsers />} />
          <Route
            path={PATHS.admin.organizations}
            element={<AdminOrganizations />}
          />
          <Route path={PATHS.admin.plans} element={<AdminPlans />} />
          <Route path={PATHS.admin.revenue} element={<AdminRevenue />} />
          <Route path={PATHS.admin.proposals} element={<AdminProposals />} />
          <Route
            path={PATHS.admin.infrastructure}
            element={<AdminInfrastructure />}
          />

          {/* Financial Analyst */}
          <Route path={PATHS.finance.overview} element={<FinanceOverview />} />
          <Route path={PATHS.finance.reports} element={<FinanceReports />} />
          <Route path={PATHS.finance.costs} element={<FinanceCosts />} />
          <Route
            path={PATHS.finance.subscription}
            element={<FinanceSubscription />}
          />
          <Route path={PATHS.finance.archives} element={<FinanceArchives />} />

          {/* Sustainability Officer */}
          <Route
            path={PATHS.sustainability.overview}
            element={<SustainabilityOverview />}
          />
          <Route
            path={PATHS.sustainability.monitoring}
            element={<SustainabilityMonitoring />}
          />
          <Route
            path={PATHS.sustainability.report}
            element={<SustainabilityReport />}
          />
          <Route
            path={PATHS.sustainability.initiatives}
            element={<SustainabilityInitiatives />}
          />
          <Route
            path={PATHS.sustainability.archives}
            element={<SustainabilityArchives />}
          />

          {/* Technician Administrator */}
          <Route
            path={PATHS.technician.overview}
            element={<TechnicianOverview />}
          />
          <Route
            path={PATHS.technician.alerts}
            element={<TechnicianAlerts />}
          />
          <Route
            path={PATHS.technician.maintenance}
            element={<TechnicianMaintenance />}
          />
          <Route
            path={PATHS.technician.workOrders}
            element={<TechnicianWorkOrders />}
          />

          {/* Technician */}
          <Route
            path={PATHS.technicianJr.overview}
            element={<TechnicianJrOverview />}
          />
          <Route
            path={PATHS.technicianJr.workOrders}
            element={<TechnicianJrWorkOrders />}
          />

          {/* Certified Energy Auditor */}
          <Route path={PATHS.auditor.overview} element={<AuditorOverview />} />
          <Route path={PATHS.auditor.audits} element={<AuditorAudits />} />

          {/* Campus Visitor */}
          <Route path={PATHS.campus.dashboard} element={<CampusDashboard />} />
          <Route path={PATHS.campus.wastage} element={<CampusWastage />} />
          <Route path={PATHS.campus.archives} element={<CampusArchives />} />

          {/* Catch-all. Position does not matter: React Router v6+ ranks routes
            by specificity rather than matching top-to-bottom like v5 did. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
