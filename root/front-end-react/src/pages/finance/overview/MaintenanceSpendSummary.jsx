/**
 * MaintenanceSpendSummary — compact panel for Finance Overview uniting
 * pending pre-work quotes and pending expense bill verifications.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../api/client";
import { PATHS } from "../../../routes";
import { formatCurrency } from "../financeUtils";

export default function MaintenanceSpendSummary() {
  const [quoteCount, setQuoteCount] = useState(0);
  const [billCount, setBillCount] = useState(0);
  const [billTotal, setBillTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/work-orders").catch(() => []),
      api.get("/expense-bills?status=submitted").catch(() => []),
    ]).then(([wos, bills]) => {
      if (cancelled) return;
      const pendingQuotes = Array.isArray(wos)
        ? wos.filter((w) => w.status === "approval")
        : [];
      const pendingBills = Array.isArray(bills) ? bills : [];
      setQuoteCount(pendingQuotes.length);
      setBillCount(pendingBills.length);
      setBillTotal(
        pendingBills.reduce((sum, b) => sum + Number(b.amount || 0), 0),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
