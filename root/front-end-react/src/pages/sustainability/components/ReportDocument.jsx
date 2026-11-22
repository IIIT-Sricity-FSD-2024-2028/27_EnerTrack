/**
 * ReportDocument — a sustainability report as a plain, printable document.
 *
 * Used for the live preview on the Reports page and for saved reports in
 * Archives, so a report looks the same before and after it is saved. It only
 * renders what the server computed (report.totals, report.previous, ...);
 * where something could not be measured it says so instead of showing a
 * number.
 */
import { periodName } from "../periods";
import "./reportDocument.css";

const num = (value, digits = 0) =>
  Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

function change(pct) {
  if (pct === null || pct === undefined) return "—";
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : "−"}${num(Math.abs(pct), 1)}%`;
}

const STATUS = {
  preview: "Preview, not saved",
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  published: "Published",
};

export default function ReportDocument({ report, status }) {
  const t = report.totals || {};
  const prev = report.previous || null;
  const d = report.deltas || {};
  const cov = report.meter_coverage || {};
  const f = report.emission_factors || {};
  const hasPrev = !!prev && (prev.energy_kwh > 0 || prev.water_kl > 0);
  const state = status || report.status;

  const rows = [
    { label: "Electricity", unit: "MWh", now: t.energy_kwh / 1000, before: prev && prev.energy_kwh / 1000, pct: d.energy_pct, digits: 1 },
    { label: "Water", unit: "kL", now: t.water_kl, before: prev && prev.water_kl, pct: d.water_pct, digits: 0 },
    { label: "Natural gas", unit: "m³", now: t.gas_m3, before: prev && prev.gas_m3, pct: d.gas_pct, digits: 0 },
    { label: "Food waste", unit: "kg", now: t.food_kg, before: prev && prev.food_kg, pct: d.food_pct, digits: 0 },
    { label: "Emissions", unit: "t CO₂e", now: t.emissions_kg / 1000, before: prev && prev.emissions_kg / 1000, pct: d.emissions_pct, digits: 1, strong: true },
  ];

  const prepared = report.generated_at
    ? new Date(report.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const comparedWith = report.compared_with?.from
    ? periodName(report.compared_with.from, report.compared_with.to)
    : null;
  const active = cov.active ?? 0;
  const reporting = cov.active_reporting ?? cov.reporting_in_period ?? 0;
  const gaps = Array.isArray(report.data_gaps) ? report.data_gaps : [];

  return (
    <article className="rdoc">
      <header className="rdoc__head">
        <p className="rdoc__kind">Sustainability report</p>
        <h2 className="rdoc__title">{periodName(report.from, report.to) || report.period}</h2>
        <dl className="rdoc__meta">
          <div>
            <dt>Period</dt>
            <dd>{periodName(report.from, report.to) || report.period}</dd>
          </div>
          <div>
            <dt>Compared with</dt>
            <dd>{comparedWith ? `${comparedWith}${hasPrev ? "" : " (no readings)"}` : "—"}</dd>
          </div>
          {prepared && (
            <div>
              <dt>Prepared</dt>
              <dd>{prepared}</dd>
            </div>
          )}
          {state && (
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`rdoc__status rdoc__status--${state}`}>{STATUS[state] || state}</span>
              </dd>
            </div>
          )}
        </dl>
      </header>

      <section className="rdoc__section" aria-labelledby="rdoc-summary">
        <h3 id="rdoc-summary">Summary</h3>
        <div className="rdoc__scroll">
          <table className="rdoc__table">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  <span className="rdoc__long">This period</span>
                  <span className="rdoc__short" aria-hidden="true">This</span>
                </th>
                <th scope="col" className="num">
                  <span className="rdoc__long">Previous period</span>
                  <span className="rdoc__short" aria-hidden="true">Previous</span>
                </th>
                <th scope="col" className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={r.strong ? "is-total" : undefined}>
                  <th scope="row">
                    {r.label} <span className="rdoc__unit">{r.unit}</span>
                  </th>
                  <td className="num">{num(r.now || 0, r.digits)}</td>
                  <td className="num">{hasPrev ? num(r.before || 0, r.digits) : "—"}</td>
                  <td className="num">{change(r.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasPrev && <p className="rdoc__note">— There are no readings for the previous period, so no comparison is shown.</p>}
      </section>

      <section className="rdoc__section" aria-labelledby="rdoc-emissions">
        <h3 id="rdoc-emissions">Emissions by scope</h3>
        <div className="rdoc__scroll">
          <table className="rdoc__table">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Calculation</th>
                <th scope="col" className="num">t CO₂e</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Scope 1: natural gas</th>
                <td>
                  {num(t.gas_m3 || 0)} m³ × {f.gas_kg_per_m3 ?? "—"} kg/m³
                </td>
                <td className="num">{num((t.scope1_kg || 0) / 1000, 1)}</td>
              </tr>
              <tr>
                <th scope="row">Scope 2: grid electricity</th>
                <td>
                  {num(t.energy_kwh || 0)} kWh × {f.grid_kg_per_kwh ?? "—"} kg/kWh
                </td>
                <td className="num">{num((t.scope2_kg || 0) / 1000, 1)}</td>
              </tr>
              <tr className="is-total">
                <th scope="row">Total</th>
                <td />
                <td className="num">{num((t.emissions_kg || 0) / 1000, 1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {Array.isArray(report.targets) && report.targets.length > 0 && (
        <section className="rdoc__section" aria-labelledby="rdoc-targets">
          <h3 id="rdoc-targets">Targets</h3>
          <div className="rdoc__scroll">
            <table className="rdoc__table">
              <thead>
                <tr>
                  <th scope="col">Target</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Cut so far</th>
                </tr>
              </thead>
              <tbody>
                {report.targets.map((tg, i) => (
                  <tr key={i}>
                    <th scope="row">{tg.summary ? tg.summary.charAt(0).toUpperCase() + tg.summary.slice(1) : "—"}</th>
                    <td>
                      {tg.status === "active"
                        ? tg.on_track == null
                          ? "Active"
                          : tg.on_track
                            ? "Active, on track"
                            : "Active, behind"
                        : tg.status === "met"
                          ? "Met"
                          : "Missed"}
                    </td>
                    <td className="num">
                      {tg.achieved_reduction_pct == null ? "—" : `${num(tg.achieved_reduction_pct, 1)}%`}
                      {tg.required_reduction_pct != null && (
                        <span className="rdoc__unit"> (needs {num(tg.required_reduction_pct, 1)}% by now)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rdoc__note">Progress is measured up to the last full month when the report was prepared.</p>
        </section>
      )}

      {Array.isArray(report.buildings) && report.buildings.length > 0 && (
        <section className="rdoc__section" aria-labelledby="rdoc-buildings">
          <h3 id="rdoc-buildings">Buildings using the most electricity</h3>
          <div className="rdoc__scroll">
            <table className="rdoc__table">
              <thead>
                <tr>
                  <th scope="col">Building</th>
                  <th scope="col" className="num">
                    <span className="rdoc__long">Electricity</span>
                    <span className="rdoc__short" aria-hidden="true">Elec.</span> <span className="rdoc__unit">MWh</span>
                  </th>
                  <th scope="col" className="num">
                    t CO₂e
                  </th>
                  <th scope="col" className="num">
                    <span className="rdoc__long">vs last year</span>
                    <span className="rdoc__short" aria-hidden="true">vs LY</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.buildings.map((b) => (
                  <tr key={b.name}>
                    <th scope="row">{b.name}</th>
                    <td className="num">{num((b.energy_kwh || 0) / 1000, 1)}</td>
                    <td className="num">{num((b.emissions_kg || 0) / 1000, 1)}</td>
                    <td className="num">{change(b.yoy_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {Array.isArray(report.initiatives) && report.initiatives.length > 0 && (
        <section className="rdoc__section" aria-labelledby="rdoc-initiatives">
          <h3 id="rdoc-initiatives">Initiatives completed in this period</h3>
          <div className="rdoc__scroll">
            <table className="rdoc__table">
              <thead>
                <tr>
                  <th scope="col">Initiative</th>
                  <th scope="col" className="num">Measured saving</th>
                  <th scope="col" className="num">
                    <span className="rdoc__long">Expected a year</span>
                    <span className="rdoc__short" aria-hidden="true">Expected/yr</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.initiatives.map((i, idx) => (
                  <tr key={idx}>
                    <th scope="row">{i.title}</th>
                    <td className="num">{i.verified_saving == null ? "Not measured" : `${num(i.verified_saving)} ${i.unit || ""}`}</td>
                    <td className="num">{i.expected_saving == null ? "—" : `${num(i.expected_saving)} ${i.unit || ""}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rdoc__section" aria-labelledby="rdoc-quality">
        <h3 id="rdoc-quality">Data quality</h3>
        <p>
          {reporting} of {active} active meters sent readings for this period.
          {gaps.length === 0 ? " No other gaps were found." : ""}
        </p>
        {gaps.length > 0 && (
          <ul className="rdoc__gaps">
            {gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </section>

      <footer className="rdoc__foot">
        Figures are totals of monthly meter readings. Change compares this period with the
        previous period of the same length.
      </footer>
    </article>
  );
}
