/**
 * DepartmentCostBars — "Cost by Department" progress bars on the Overview.
 * Each bar's width is that department's cost relative to the largest one.
 */
import { Link } from "react-router-dom";
import { formatCurrency, latestPeriod } from "../financeUtils";

const COLORS = ["#111827", "#f59e0b", "#10b981", "#6366f1", "#ef4444"];

export default function DepartmentCostBars({ costs }) {
  const period = latestPeriod(costs);
  const records = costs.filter((c) => c.scope === "department" && c.period === period);
  const max = Math.max(...records.map((c) => c.total), 0);

  return (
    <div className="box">
      <div className="section-title">
        Cost by Department ({period || "Mar 2025"})
        <Link
          to="/finance/costs"
          style={{ fontSize: 13, color: "#6b7280", cursor: "pointer", fontWeight: 400 }}
        >
          View Details →
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="fa-empty">No department cost records yet.</div>
      ) : (
        records.map((c, i) => (
          <div className="cost-row" key={c.id}>
            <div className="cost-top">
              <span>{c.scopeLabel || "—"}</span>
              <span>{formatCurrency(c.total)}</span>
            </div>
            <div className="bar">
              <div
                className="fill"
                style={{
                  background: COLORS[i % COLORS.length],
                  width: `${max > 0 ? Math.round((c.total / max) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
