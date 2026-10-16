/**
 * DepartmentCostBars — "Cost by department" bars on the Overview.
 * Each bar's width is that department's cost relative to the largest one.
 * One colour for every bar (the bar length already carries the comparison);
 * an over-budget department is called out in red text next to its name.
 */
import { Link } from "react-router-dom";
import { formatCurrency, latestPeriod, periodLabel } from "../financeUtils";

export default function DepartmentCostBars({ costs }) {
  const period = latestPeriod(costs);
  const records = costs
    .filter((c) => c.scope === "department" && c.period === period)
    .sort((a, b) => b.total - a.total);
  const max = Math.max(...records.map((c) => c.total), 0);

  return (
    <section className="fo-panel" aria-labelledby="deptCostTitle">
      <div className="fo-panel-head">
        <div>
          <h2 id="deptCostTitle">Cost by department</h2>
          <p>{period ? `Utility spend per department for ${periodLabel(period)}, largest first.` : "Utility spend per department."}</p>
        </div>
        <Link to="/finance/costs" className="fo-panel-link">
          Open utility costs
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="fo-empty">No department cost records yet. Add one on the Utility Costs page.</div>
      ) : (
        records.map((c) => {
          const over = c.variance < 0;
          return (
            <div className="fo-dept" key={c.id}>
              <div className="fo-dept-top">
                <span>
                  {c.scopeLabel || "—"}
                  {over && <span className="fo-dept-over">{formatCurrency(-c.variance)} over budget</span>}
                </span>
                <strong>{formatCurrency(c.total)}</strong>
              </div>
              <div className="fo-bar" role="presentation">
                <span style={{ width: `${max > 0 ? Math.round((c.total / max) * 100) : 0}%` }} />
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
