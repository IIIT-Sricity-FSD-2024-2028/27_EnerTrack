/**
 * SummaryCards — the four KPI cards at the top of the Overview page.
 * Everything is calculated from the props, so the cards update by
 * themselves whenever the page passes in new data. Drawn with the same
 * MetricCard the Sustainability pages use, so the KPI rows match.
 */
import MetricCard from "../../sustainability/components/MetricCard";
import { formatCurrency, latestPeriod, periodLabel } from "../financeUtils";

const ICON_PROPS = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };

export default function SummaryCards({ costs, reports, loading }) {
  const period = latestPeriod(costs);
  const records = costs.filter((c) => c.period === period);

  const totalCost = records.reduce((sum, c) => sum + c.total, 0);
  const totalBudget = records.reduce((sum, c) => sum + c.budget, 0);
  const variance = totalBudget - totalCost;
  // "Savings" = how far the under-budget departments stayed below budget
  const underBudget = records.filter((c) => c.variance > 0);
  const totalSavings = underBudget.reduce((sum, c) => sum + c.variance, 0);
  const latestRoi = reports.length > 0 ? reports[0].roi : null;
  const hasData = costs.length > 0;
  const show = (text) => (loading ? "…" : hasData ? text : "—");
  const when = periodLabel(period);

  return (
    <section className="fo-metrics" aria-label="Financial summary">
      <MetricCard
        title="Energy cost"
        value={show(formatCurrency(totalCost))}
        description={hasData ? `All utility records for ${when}.` : "No utility records yet."}
        icon={
          <svg {...ICON_PROPS}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
      />
      <MetricCard
        title="Savings"
        value={show(formatCurrency(totalSavings))}
        description={
          hasData
            ? underBudget.length
              ? `Left unspent by ${underBudget.length} under-budget ${underBudget.length === 1 ? "record" : "records"}.`
              : `No record came in under budget in ${when}.`
            : "Appears once costs are recorded."
        }
        icon={
          <svg {...ICON_PROPS}>
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        }
      />
      <MetricCard
        title="ROI"
        value={loading ? "…" : latestRoi != null ? `${latestRoi}%` : "—"}
        description={latestRoi != null ? "From the most recent financial report." : "No financial reports yet."}
        icon={
          <svg {...ICON_PROPS}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        }
      />
      <MetricCard
        title="Budget variance"
        value={show((variance > 0 ? "+" : variance < 0 ? "−" : "") + formatCurrency(Math.abs(variance)))}
        // Percent spent over budget: positive (red) = overspend, negative (green) = under
        delta={hasData && !loading && totalBudget > 0 ? Number(((-variance / totalBudget) * 100).toFixed(1)) : null}
        description={hasData ? `Allocated ${formatCurrency(totalBudget)} for ${when}.` : "Appears once budgets are set."}
        icon={
          <svg {...ICON_PROPS}>
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 4 4 5-5" />
          </svg>
        }
      />
    </section>
  );
}
