/**
 * Overview — /finance/overview (was finance_overview.html).
 *
 * Loads the energy costs and financial reports into the Redux store when the
 * page opens. The summary cards and department bars read them through the
 * slice selectors. The two workflow boxes load their own data.
 */
import { useEffect } from "react";
import { useAuth } from "../../auth/useAuth";
import FinanceLayout from "./components/FinanceLayout";
import { useToast } from "../../ui/useToast";
import { fetchBuildings } from "../../store/slices/buildingsSlice";
import { fetchDepartments } from "../../store/slices/departmentsSlice";
import { fetchEnergyCosts } from "../../store/slices/energyCostsSlice";
import { fetchFinancialReports } from "../../store/slices/financialReportsSlice";
import { useLiveData } from "../../store/useLiveData";
import DepartmentCostBars from "./overview/DepartmentCostBars";
import MaintenanceSpendSummary from "./overview/MaintenanceSpendSummary";
import SummaryCards from "./overview/SummaryCards";
import WastageReviewQueue from "./overview/WastageReviewQueue";
import overviewCss from "../../styles/finance-analyst/finance_overview.css?inline";
import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";
import pageCss from "./overview/overview.css?inline";

// Loaded fresh each time the page opens; no polling. Departments and
// buildings give the cost records their names.
const LOADS = [fetchEnergyCosts, fetchFinancialReports, fetchDepartments, fetchBuildings];

function OverviewContent() {
  const { user } = useAuth();
  const showToast = useToast();
  const { loading, error } = useLiveData(LOADS, { intervalMs: 0 });

  useEffect(() => {
    if (error) showToast(error, "error");
  }, [error, showToast]);

  const firstName = (user.name || "").split(" ")[0];

  return (
    <FinanceLayout styles={[overviewCss, sharedCss, pageCss]}>
      <header className="fo-header">
        <div>
          <h1 className="welcome">{firstName ? `Welcome back, ${firstName}` : "Overview"}</h1>
          <p>Energy spend for the latest period, and the approvals and cost reviews waiting on you.</p>
        </div>
      </header>

      <SummaryCards loading={loading} />
      <MaintenanceSpendSummary />
      <WastageReviewQueue />
      <DepartmentCostBars />
    </FinanceLayout>
  );
}

/**
 * The page as App.jsx routes to it.
 */
export default function FinanceOverview() {
  return (
    <OverviewContent />
  );
}
