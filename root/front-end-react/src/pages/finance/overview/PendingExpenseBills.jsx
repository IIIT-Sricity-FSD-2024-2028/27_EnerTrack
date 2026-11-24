/**
 * PendingExpenseBills — Panel for Finance Overview showing submitted expense bills
 * waiting for financial verification and sign-off.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../api/client";
import { PATHS } from "../../../routes";
import { formatCurrency } from "../financeUtils";

export default function PendingExpenseBills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/expense-bills?status=submitted")
      .then((data) => {
        setBills(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching pending expense bills:", err);
        setLoading(false);
      });
  }, []);

  const totalAmount = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const overEstimateCount = bills.filter((b) => b.variance?.over_estimate).length;
  const topThree = bills.slice(0, 3);

  return (
    <section className="fo-panel mt-16" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "20px", marginTop: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", color: "#0f172a" }}>
            Pending Expense Bills & Receipts
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Technician material and repair receipts requiring financial sign-off.
          </p>
        </div>
        <Link
          to={PATHS.finance.expenses}
          className="fo-btn primary"
          style={{ textDecoration: "none", fontSize: "13px", padding: "6px 14px" }}
        >
          Review all in Expense Bills ({bills.length})
        </Link>
      </div>

      {loading ? (
        <div style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>Loading pending bills…</div>
      ) : bills.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "6px" }}>
          No expense bills currently waiting for review.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Pending Count:</span>{" "}
              <strong style={{ fontSize: "16px", color: "#0f172a" }}>{bills.length}</strong>
            </div>
            <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Total Pending Amount:</span>{" "}
              <strong style={{ fontSize: "16px", color: "#0369a1" }}>{formatCurrency(totalAmount)}</strong>
            </div>
            {overEstimateCount > 0 && (
              <div style={{ background: "#fef3c7", padding: "12px 16px", borderRadius: "6px", border: "1px solid #fde68a" }}>
                <span style={{ fontSize: "12px", color: "#92400e" }}>Over-Estimate Flagged:</span>{" "}
                <strong style={{ fontSize: "16px", color: "#b45309" }}>{overEstimateCount}</strong>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {topThree.map((b) => (
              <div
                key={b.expense_bill_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>{b.title}</div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    WO: {b.work_order_title} | Vendor: {b.vendor} | Tech: {b.submitted_by_name}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>
                    {formatCurrency(b.amount)}
                  </div>
                  {b.variance?.over_estimate ? (
                    <span style={{ fontSize: "11px", color: "#b45309", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>
                      Over estimate
                    </span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#15803d", background: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>
                      Within estimate
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
