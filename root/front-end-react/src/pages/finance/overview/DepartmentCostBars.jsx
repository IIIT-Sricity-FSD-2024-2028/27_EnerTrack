/**
 * DepartmentCostBars — "Cost by department" on the Overview.
 *
 * One row per department: what it spent against its own budget. Every row
 * shares one scale (the largest of any spend or budget), so lengths compare
 * across departments too. The fill is green up to the budget; anything past
 * it is red, and a dark tick marks where the budget ends.
 */
import { Link } from "react-router-dom";
import { formatCurrency, latestPeriod, periodLabel } from "../financeUtils";

/** Percentage of the shared scale, for a CSS width or left. */
const pct = (value, scale) => `${scale > 0 ? (value / scale) * 100 : 0}%`;

export default function DepartmentCostBars({ costs }) {
  const period = latestPeriod(costs);
  const records = costs
    .filter((c) => c.scope === "department" && c.period === period)
    .sort((a, b) => b.total - a.total);
  const scale = Math.max(...records.map((c) => Math.max(c.total, c.budget || 0)), 0);
  const overCount = records.filter((c) => c.variance < 0).length;

  return (
    <section className="fo-panel" aria-labelledby="deptCostTitle">
      <div className="fo-panel-head">
        <div>
          <h2 id="deptCostTitle">Cost by department</h2>
          <p>
            {period ? `Spend against budget for ${periodLabel(period)}.` : "Spend against budget."}
            {records.length > 0 &&
              (overCount > 0
                ? ` ${overCount} of ${records.length} over budget.`
                : " Every department is within budget.")}
          </p>
        </div>
        <Link to="/finance/costs" className="fo-panel-link">
          Open utility costs
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="fo-empty">No department cost records yet. Add one on the Utility Costs page.</div>
      ) : (
        <>
          <ul className="fo-dept-list">
            {records.map((c) => {
              const over = c.variance < 0;
              const budget = c.budget || 0;
              return (
                <li className="fo-dept" key={c.id}>
                  <div className="fo-dept-name">
                    <strong>{c.scopeLabel || "—"}</strong>
                    <span className={over ? "fo-dept-status over" : "fo-dept-status"}>
                      {over
                        ? `${formatCurrency(-c.variance)} over budget`
                        : c.variance > 0
                          ? `${formatCurrency(c.variance)} under budget`
                          : "On budget"}
                    </span>
                  </div>

                  <div
                    className="fo-dept-bar"
                    role="img"
                    aria-label={`${formatCurrency(c.total)} spent of a ${formatCurrency(budget)} budget`}
                  >
                    <span className={over ? "fo-dept-fill" : "fo-dept-fill whole"} style={{ width: pct(Math.min(c.total, budget), scale) }} />
                    {over && (
                      <span
                        className="fo-dept-overrun"
                        style={{ left: pct(budget, scale), width: pct(c.total - budget, scale) }}
                      />
                    )}
                    {budget > 0 && <span className="fo-dept-budget" style={{ left: pct(budget, scale) }} />}
                  </div>

                  <div className="fo-dept-figures">
                    <strong>{formatCurrency(c.total)}</strong>
                    <span>of {formatCurrency(budget)}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="fo-dept-legend" aria-hidden="true">
            <span><i className="sw spent" />Spent within budget</span>
            <span><i className="sw over" />Over budget</span>
            <span><i className="sw tick" />Budget</span>
          </div>
        </>
      )}
    </section>
  );
}
