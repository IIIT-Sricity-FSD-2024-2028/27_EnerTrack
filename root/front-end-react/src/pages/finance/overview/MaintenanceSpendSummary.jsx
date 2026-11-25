/**
 * MaintenanceSpendSummary — compact panel for Finance Overview uniting
 * pending pre-work quotes and pending expense bill verifications.
 * Both counts come from the Redux store, loaded when the panel appears.
 */
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { PATHS } from "../../../routes";
import { formatCurrency } from "../financeUtils";
import {
  fetchExpenseBills,
  selectPendingExpenseBills,
} from "../../../store/slices/expenseBillsSlice";
import { fetchWorkOrders, selectAllWorkOrders } from "../../../store/slices/workOrdersSlice";
import { useLiveData } from "../../../store/useLiveData";

// Loaded fresh each time the Overview opens; no polling.
const LOADS = [fetchWorkOrders, fetchExpenseBills];

export default function MaintenanceSpendSummary() {
  const { loading } = useLiveData(LOADS, { intervalMs: 0 });
  const quoteCount = useSelector(selectAllWorkOrders).filter((w) => w.status === "approval").length;
  const pendingBills = useSelector(selectPendingExpenseBills);
  const billCount = pendingBills.length;
  const billTotal = pendingBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const totalPending = quoteCount + billCount;

  return (
    <section className="fo-panel" aria-labelledby="spendSummaryTitle">
      <div className="fo-panel-head">
        <div>
          <h2 id="spendSummaryTitle">Maintenance Spend</h2>
          <p>Pre-work budget quotes and technician expense receipts waiting on you.</p>
        </div>
        <span className={totalPending > 0 ? "fo-count has-items" : "fo-count"}>
          {totalPending} pending
        </span>
      </div>

      {loading ? (
        <div className="fo-empty">Loading maintenance spend summary…</div>
      ) : quoteCount === 0 && billCount === 0 ? (
        <div className="fo-empty">
          All maintenance quotes and expense bills are up to date.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px",
            padding: "8px 0 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              padding: "14px 16px",
              borderRadius: "8px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#0f172a" }}>
                Pre-Work Quotes
              </div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                {quoteCount} quote(s) waiting for budget approval
              </div>
            </div>
            <Link
              to={`${PATHS.finance.expenses}?tab=quotes`}
              className="fo-panel-link"
              style={{ whiteSpace: "nowrap" }}
            >
              Review quotes
            </Link>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              padding: "14px 16px",
              borderRadius: "8px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#0f172a" }}>
                Expense Bills
              </div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                {billCount} bill(s) waiting for receipt verification ({formatCurrency(billTotal)})
              </div>
            </div>
            <Link
              to={PATHS.finance.expenses}
              className="fo-panel-link"
              style={{ whiteSpace: "nowrap" }}
            >
              Review bills
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
