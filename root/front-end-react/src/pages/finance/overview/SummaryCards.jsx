/**
 * SummaryCards — the four KPI cards at the top of the Overview page.
 * Everything is calculated from the props, so the cards update by
 * themselves whenever the page passes in new data.
 */
import { formatCurrency, latestPeriod } from "../financeUtils";

function Card({ title, icon, value, valueClass = "value green", valueColor, caption, captionClass = "change" }) {
  return (
    <div className="card">
      <div className="card-title">
        {title}
        <span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </span>
      </div>
      <div className={valueClass} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <div className={captionClass}>{caption}</div>
    </div>
  );
}

export default function SummaryCards({ costs, reports }) {
  const period = latestPeriod(costs);
  const records = costs.filter((c) => c.period === period);

  const totalCost = records.reduce((sum, c) => sum + c.total, 0);
  const totalBudget = records.reduce((sum, c) => sum + c.budget, 0);
  const variance = totalBudget - totalCost;
  // "Savings" = how far the under-budget departments stayed below budget
  const totalSavings = records
    .filter((c) => c.variance > 0)
    .reduce((sum, c) => sum + c.variance, 0);
  const latestRoi = reports.length > 0 ? reports[0].roi : null;
  const hasData = costs.length > 0;

  return (
    <div className="cards">
      <Card
        title="Total Energy Cost"
        icon={
          <>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </>
        }
        value={hasData ? formatCurrency(totalCost) : "—"}
        caption={hasData ? `Latest period (${period})` : "Latest month (Mar 2025)"}
      />
      <Card
        title="Total Savings"
        icon={
          <>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </>
        }
        value={hasData ? formatCurrency(totalSavings) : "—"}
        caption="↗ Under-budget depts"
      />
      <Card
        title="ROI %"
        icon={
          <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </>
        }
        value={hasData && latestRoi != null ? `${latestRoi}%` : "—"}
        caption="Latest report"
      />
      <Card
        title="Budget Variance"
        icon={
          <>
            <path d="M12 1L12 23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </>
        }
        valueClass="value"
        valueColor={hasData ? (variance >= 0 ? "#22c55e" : "#dc2626") : undefined}
        value={hasData ? (variance >= 0 ? "+" : "") + formatCurrency(variance) : "—"}
        caption="vs allocated budget"
        captionClass="gray"
      />
    </div>
  );
}
