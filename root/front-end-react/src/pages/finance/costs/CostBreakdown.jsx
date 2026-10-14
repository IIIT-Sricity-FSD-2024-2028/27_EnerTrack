/**
 * CostBreakdown — "Cost Breakdown & Output" card on the Utility Costs page:
 * three headline metrics, the bar chart with its three tabs, and the
 * Budget vs Actual cards.
 *
 * Until "Retrieve & Calculate" has run (`pending` is true) the numbers show
 * "—" and the chart shows a hint, exactly like the original page.
 */
import { useState } from "react";
import { formatCurrency } from "../financeUtils";

const TABS = [
  { key: "energy", label: "By Energy Type" },
  { key: "building", label: "By Building" },
  { key: "time", label: "By Time" },
];
const CHART_HEIGHT = 160;

const sum = (rows, pick) => rows.reduce((total, r) => total + (Number(pick(r)) || 0), 0);

/** Turns the cost records into chart bars [{ label, value, isDemand }]. */
function chartData(costs, view) {
  if (view === "building") {
    const labels = [...new Set(costs.map((r) => r.scopeLabel))];
    return labels.map((label) => ({
      label: label.split(" – ")[0],
      value: sum(costs.filter((r) => r.scopeLabel === label), (r) => r.total),
    }));
  }
  if (view === "time") {
    const periods = [...new Set(costs.map((r) => r.period))].sort();
    return periods.map((p) => ({
      label: p,
      value: sum(costs.filter((r) => r.period === p), (r) => r.total),
    }));
  }
  return [
    { label: "Electricity", value: sum(costs, (r) => r.electricity) },
    { label: "Gas", value: sum(costs, (r) => r.gas) },
    { label: "Water", value: sum(costs, (r) => r.water) },
    { label: "Wastewater", value: sum(costs, (r) => r.wastewater) },
    { label: "Demand", value: sum(costs, (r) => r.demand), isDemand: true },
  ];
}

export default function CostBreakdown({ costs, pending, onExportCsv, onExportPdf }) {
  const [view, setView] = useState("energy");

  const actual = sum(costs, (r) => r.total);
  const budget = sum(costs, (r) => r.budget);
  const variance = budget - actual;
  const data = chartData(costs, view);
  const maxValue = Math.max(...data.map((d) => d.value)) || 1;

  return (
    <div className="card">
      <div className="top">
        <div>
          <div className="card-title">Cost Breakdown &amp; Output</div>
          <div className="card-sub">
            Generated utility cost view for the selected monthly department scope.
          </div>
        </div>
        <div className="export">
          <button onClick={onExportPdf}>Export PDF</button>
          <button onClick={onExportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          Consumption retrieved
          <strong>{pending ? "—" : (costs.length * 1.24).toFixed(2) + "M kWh"}</strong>
          <small>Across electricity, gas, and water</small>
        </div>
        <div className="metric">
          Calculated cost
          <strong>{pending ? "—" : formatCurrency(actual)}</strong>
          <small>After tariff and demand charges</small>
        </div>
        <div className="metric" style={pending ? undefined : { color: variance >= 0 ? "#059669" : "#dc2626" }}>
          Budget status
          <strong>{pending ? "—" : (variance >= 0 ? "+" : "") + formatCurrency(variance)}</strong>
          <small>Over current monthly budget</small>
        </div>
      </div>

      <div className="graph">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 4 }}>
              Cost breakdown panel
            </div>
            <div style={{ fontSize: 13, color: "#8a95a2", maxWidth: 280, lineHeight: 1.4 }}>
              Toggle between By Energy Type, By Building, and By Time. Energy type view is currently shown.
            </div>
          </div>
          <div className="tabs toggle">
            {TABS.map((tab) => (
              <div
                key={tab.key}
                className={view === tab.key ? "pill active" : "pill"}
                onClick={() => setView(tab.key)}
              >
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        <div className="bars">
          {pending ? (
            <div style={{ width: "100%", textAlign: "center", color: "#9ca3af", paddingTop: 20, fontStyle: "italic" }}>
              Analytics pending. Click &quot;Retrieve &amp; Calculate&quot; to begin simulation.
            </div>
          ) : (
            data.map((d, i) => {
              const height = (d.value / maxValue) * CHART_HEIGHT;
              const isMax = d.value === maxValue && d.value > 0;
              return (
                <div
                  key={`${d.label}-${i}`}
                  className="bar-group"
                  style={isMax ? { border: "2px solid #059669", borderRadius: 8, padding: 6, marginTop: -10, background: "rgba(5, 150, 105, 0.05)" } : undefined}
                >
                  <div
                    className="stacked-bar"
                    style={{ height, width: 44, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column-reverse", borderRadius: 4 }}
                  >
                    {d.isDemand ? (
                      <div className="bar bg-blue" style={{ height: "100%", width: "100%" }} />
                    ) : (
                      <>
                        {/* 85% base cost (green) + 15% taxes (yellow) */}
                        <div className="bar bg-green" style={{ height: "85%", width: "100%" }} title={`Base: ${formatCurrency(d.value * 0.85)}`} />
                        <div className="bar bg-yellow" style={{ height: "15%", width: "100%" }} title={`Taxes: ${formatCurrency(d.value * 0.15)}`} />
                      </>
                    )}
                  </div>
                  <div className="bar-label" style={{ fontWeight: isMax ? 700 : 500, color: isMax ? "#0f8f63" : "#8a95a2" }}>
                    {d.label}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="legend">
          <div><span className="dot bg-green"></span>Base utility cost</div>
          <div><span className="dot bg-yellow"></span>Taxes &amp; surcharges</div>
          <div><span className="dot bg-blue"></span>Demand charge</div>
        </div>
      </div>

      <div className="card-title" style={{ marginTop: 32 }}>Budget vs Actual Cost</div>
      <div className="card-sub">
        Three summary cards show the current budget, actual cost, and variance with savings or loss color coding.
      </div>

      <div className="budget">
        <div className="budget-card">
          Budget Actual
          <strong>{pending ? "—" : formatCurrency(budget)}</strong>
          Approved monthly utility allocation for the selected department.
        </div>
        <div className={pending || actual > budget ? "budget-card red" : "budget-card"}>
          Actual Cost
          <strong>{pending ? "—" : formatCurrency(actual)}</strong>
          Current utility spend after retrieval and calculation.
        </div>
        <div className={pending || variance < 0 ? "budget-card red" : "budget-card"}>
          Budget Variance
          <strong>{pending ? "—" : (variance >= 0 ? "+" : "") + formatCurrency(variance)}</strong>
          {pending
            ? "Loss against target due to peak demand and gas rate pressure."
            : variance < 0
              ? `Over budget by ${formatCurrency(Math.abs(variance))} (Loss)`
              : `${formatCurrency(variance)} savings against target.`}
        </div>
      </div>
    </div>
  );
}
