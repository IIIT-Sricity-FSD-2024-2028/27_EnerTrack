/**
 * Overview — /finance/overview (was finance_overview.html).
 *
 * Loads the energy costs and financial reports once with useEffect and
 * passes them down as props to the summary cards and department bars.
 * The two workflow boxes load their own data.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import FinanceLayout from "./components/FinanceLayout";
import ToastProvider from "./components/ToastProvider";
import NotificationBell from "./components/NotificationBell";
import { useToast } from "./components/toastContext";
import { loadEnergyCosts, loadReports } from "./financeApi";
import DepartmentCostBars from "./overview/DepartmentCostBars";
import MaintenanceApprovals from "./overview/MaintenanceApprovals";
import SummaryCards from "./overview/SummaryCards";
import WastageReviewQueue from "./overview/WastageReviewQueue";
import overviewCss from "../../styles/finance-analyst/finance_overview.css?inline";
import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";
import pageCss from "./overview/overview.css?inline";

function OverviewContent() {
  const { user } = useAuth();
  const showToast = useToast();
  const [costs, setCosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [costResult, reportResult] = await Promise.all([loadEnergyCosts(), loadReports()]);
        setCosts(costResult.costs);
        setReports(reportResult.reports);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [showToast]);

  const firstName = (user.name || "").split(" ")[0];

  return (
    <FinanceLayout styles={[overviewCss, sharedCss, pageCss]}>
      <header className="fo-header">
        <div>
          <h1 className="welcome">{firstName ? `Welcome back, ${firstName}` : "Overview"}</h1>
          <p>Energy spend for the latest period, and the approvals and cost reviews waiting on you.</p>
        </div>
        <NotificationBell email={user.email} />
      </header>

      <SummaryCards costs={costs} reports={reports} loading={loading} />
      <MaintenanceApprovals />
      <WastageReviewQueue />
      <DepartmentCostBars costs={costs} />
    </FinanceLayout>
  );
}

/**
 * The page as App.jsx routes to it. ToastProvider sits here, above the page,
 * so the page's own useToast() calls can reach it.
 */
export default function FinanceOverview() {
  return (
    <ToastProvider>
      <OverviewContent />
    </ToastProvider>
  );
}
