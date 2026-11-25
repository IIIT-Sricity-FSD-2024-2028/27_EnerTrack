/**
 * initiativeShared — pieces several pages use to show initiatives the same way:
 *
 *   SpendLine           "Spent ₹12,000 of ₹85,000" with amber at 90%, red over
 *   InitiativeSummary   the full story of one initiative: work, result,
 *                       timeline, money. Used by the officer's Archives, the
 *                       Organization Admin's history and Finance.
 *
 * Styles: ./initiativeShared.css (loaded by the component itself).
 */
import { useTeams, rupees, day } from "./initiativeUtils";
import "./initiativeShared.css";

/**
 * "Spent ₹12,000 of ₹85,000" (approved expense bills on its jobs). Amber
 * from 90% of the approved cost, red once over it. Bills still waiting for
 * Finance are mentioned separately.
 */
export function SpendLine({ money, compact = false }) {
  if (!money) return null;
  const { cost, spent = 0, spend_pending: pending = 0 } = money;
  if (!cost && !spent && !pending) return null;
  const ratio = cost ? spent / cost : 0;
  const tone = cost && ratio > 1 ? "red" : cost && ratio >= 0.9 ? "amber" : "ok";
  return (
    <div className={`spend spend--${tone}${compact ? " spend--compact" : ""}`}>
      <p className="spend-line">
        Spent <strong>{rupees(spent)}</strong>
        {cost ? <> of {rupees(cost)}</> : null}
        {tone === "red" && <span className="spend-flag"> · over budget</span>}
      </p>
      {cost ? (
        <div className="spend-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
        </div>
      ) : null}
      {pending > 0 && <p className="spend-note">{rupees(pending)} in bills waiting for Finance</p>}
    </div>
  );
}

const MEASURE = {
  energy_kwh: { label: "Electricity", unit: "kWh" },
  water_kl: { label: "Water", unit: "kL" },
  gas_m3: { label: "Natural gas", unit: "m³" },
  emissions_kg: { label: "Emissions", unit: "kg CO₂e" },
};
const num = (n) => Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });

/** Days late (positive) or early (negative) against the target date; null when it can't be said. */
function lateness(init) {
  if (!init.completed_at || !init.target_date) return null;
  const done = new Date(init.completed_at.slice(0, 10) + "T00:00:00");
  const due = new Date(`${init.target_date}T00:00:00`);
  return Math.round((done - due) / 86_400_000);
}

/**
 * The full record of one initiative, for anyone who looks back at it.
 *
 * Props: init (from GET /initiatives), buildings [{ building_id, name }],
 * targets [{ target_id, summary }], showDescription (default true).
 */
export function InitiativeSummary({ init, buildings = [], targets = [], showDescription = true }) {
  const { label: teamLabel } = useTeams();
  const m = MEASURE[init.metric];
  const where = (init.building_ids || []).map((id) => buildings.find((b) => b.building_id === id)?.name || id);
  const target = init.target_id ? targets.find((t) => t.target_id === init.target_id)?.summary : null;
  const late = lateness(init);
  const rejected = init.status === "rejected";
  const jobs = init.jobs || [];

  const steps = [
    { label: "Proposed", when: init.created_at, who: init.created_by_name },
    rejected
      ? { label: "Rejected", when: init.decided_at, who: init.decided_by_name, note: init.decision_note || (init.outcomes || [])[0] }
      : { label: "Approved and started", when: init.decided_at || init.start_date, who: init.decided_by_name, note: init.decision_note },
    !rejected && init.completed_at
      ? {
          label: "Completed",
          when: init.completed_at,
          note:
            late == null ? null : late > 0 ? `${late} day${late === 1 ? "" : "s"} after the target date` : "On time",
        }
      : null,
    init.archived_at ? { label: "Archived", when: init.archived_at } : null,
  ].filter(Boolean);

  return (
    <div className="isum">
      {showDescription && init.description && <p className="isum-desc">{init.description}</p>}

      <div className="isum-grid">
        <section>
          <h4>Work</h4>
          {!init.onsite_work ? (
            <p className="isum-muted">No on-site work.</p>
          ) : jobs.length === 0 ? (
            <p className="isum-muted">
              Needs {(init.teams || []).map(teamLabel).join(", ")}; no jobs were sent.
            </p>
          ) : (
            <ul className="isum-jobs">
              {jobs.map((j) => (
                <li key={j.ticket_id}>
                  <strong>
                    {teamLabel(j.team)}
                    {j.rework_of ? " (rework)" : ""}
                  </strong>{" "}
                  · {j.technician_name || "nobody assigned"} · {j.open ? j.stage : `closed ${day(j.closed_at)}`}
                  {j.task && <span className="isum-sub">Task: {j.task}</span>}
                  {j.rework_reason && <span className="isum-sub">Rework requested: {j.rework_reason}</span>}
                  {j.spent > 0 && <span className="isum-sub">Spent {rupees(j.spent)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4>Result</h4>
          <p>
            {m ? `${m.label}` : "Not measured"}
            {where.length ? ` · ${where.join(", ")}` : m ? " · whole campus" : ""}
          </p>
          {init.expected_saving != null && m && (
            <p className="isum-muted">
              Expected {num(init.expected_saving)} {m.unit} a year
            </p>
          )}
          {init.verified_saving != null && m && (
            <p>
              Verified saving <strong>{num(init.verified_saving)} {m.unit}</strong>
            </p>
          )}
          {init.performance?.rating && (
            <p className="isum-muted">
              {{ green: "On track", amber: "Behind", red: "Well behind" }[init.performance.rating]}
            </p>
          )}
          {target && <p className="isum-muted">Counts towards: {target}</p>}
        </section>

        <section>
          <h4>Timeline</h4>
          <ol className="isum-timeline">
            {steps.map((s) => (
              <li key={s.label}>
                <strong>{s.label}</strong> {s.when ? day(s.when) : ""}
                {s.who ? ` by ${s.who}` : ""}
                {s.note && <span className="isum-sub">{s.note}</span>}
              </li>
            ))}
          </ol>
          {init.target_date && <p className="isum-muted">Target date {day(init.target_date)}</p>}
        </section>

        <section>
          <h4>Money</h4>
          <p>Cost {rupees(init.capex ?? null)}</p>
          <SpendLine money={init.money} compact />
          {init.money?.expected_saving_per_year ? (
            <p className="isum-muted">
              Saves about {rupees(init.money.expected_saving_per_year)} a year
              {init.money.payback_years ? ` · pays back in ${init.money.payback_years} years` : ""}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
