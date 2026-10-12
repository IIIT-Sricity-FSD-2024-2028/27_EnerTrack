/**
 * OverviewPage — /finance/overview (was finance_overview.html).
 *
 * Loads the energy costs and financial reports once with useEffect and
 * passes them down as props to the summary cards and department bars.
 * The two workflow boxes load their own data.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import FinanceLayout from "./components/FinanceLayout";
import NotificationBell from "./components/NotificationBell";
import { useToast } from "./components/toastContext";
import { loadEnergyCosts, loadReports } from "./financeApi";
import DepartmentCostBars from "./overview/DepartmentCostBars";
import MaintenanceApprovals from "./overview/MaintenanceApprovals";
import SummaryCards from "./overview/SummaryCards";
import WastageReviewQueue from "./overview/WastageReviewQueue";
import overviewCss from "../../styles/finance-analyst/finance_overview.css?inline";
import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";

export default function OverviewPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const [costs, setCosts] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [costResult, reportResult] = await Promise.all([loadEnergyCosts(), loadReports()]);
        setCosts(costResult.costs);
        setReports(reportResult.reports);
      } catch (error) {
        showToast(error.message, "error");
      }
    }
    loadData();
  }, [showToast]);

  const firstName = (user.name || "").split(" ")[0];

  return (
    <FinanceLayout styles={[overviewCss, sharedCss]}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 className="welcome">Welcome back, {firstName}</h1>
          <div className="sub">Track key financial metrics and access main tools.</div>
        </div>
        <NotificationBell email={user.email} />
      </div>

      <SummaryCards costs={costs} reports={reports} />
      <MaintenanceApprovals />
      <WastageReviewQueue />
      <DepartmentCostBars costs={costs} />
    </FinanceLayout>
  );
}
