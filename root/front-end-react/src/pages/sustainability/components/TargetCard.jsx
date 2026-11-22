/**
 * TargetCard — one sustainability target and how it is doing, in words and a
 * single bar. Used on the Sustainability Officer's Targets page and on the
 * Organization Admin's approvals page. `actions` are buttons for the card's
 * footer (approve, reject, withdraw), supplied by the page.
 */
import { periodName } from "../periods";
import "./targets.css";

const STATUS = {
  proposed: { label: "Waiting for approval", tone: "wait" },
  active: { label: "Active", tone: "active" },
  met: { label: "Met", tone: "good" },
  missed: { label: "Missed", tone: "bad" },
  rejected: { label: "Not approved", tone: "muted" },
};

const pct = (n) => `${Number(Math.abs(n)).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;

function sentence(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function TargetCard({ target: t, actions, children }) {
  const p = t.progress || {};
  const baseline = periodName(t.baseline_from, t.baseline_to);
  const status = STATUS[t.status] || { label: t.status, tone: "muted" };
  const achieved = p.achieved_reduction_pct;
  const required = p.required_reduction_pct;
  const closed = t.status === "met" || t.status === "missed";
  const final = closed ? (t.final_reduction_pct ?? achieved) : achieved;

  // Bar: 0 → the full target reduction. The marker is where it should be by now.
  const fill = final == null ? 0 : Math.max(0, Math.min(1, final / t.reduction_pct));
  const marker = required == null ? null : Math.max(0, Math.min(1, required / t.reduction_pct));

  let measured;
  if (final == null) measured = "No months with readings on both sides yet.";
  else if (final > 0) measured = `${pct(final)} lower than ${baseline}${closed ? "" : " so far"}.`;
  else if (final < 0) measured = `${pct(final)} higher than ${baseline}${closed ? "" : " so far"}.`;
  else measured = `The same as ${baseline}${closed ? "" : " so far"}.`;

  return (
    <article className={`tcard tcard--${status.tone}`}>
      <div className="tcard__head">
        <h3 className="tcard__title">{sentence(t.summary)}</h3>
        <span className={`tcard__chip tcard__chip--${status.tone}`}>{status.label}</span>
        {t.status === "active" && p.on_track != null && (
          <span className={`tcard__chip ${p.on_track ? "tcard__chip--good" : "tcard__chip--bad"}`}>
            {p.on_track ? "On track" : "Behind"}
          </span>
        )}
      </div>

      {t.note && <p className="tcard__note">{t.note}</p>}

      <div className="tcard__progress">
        <p className="tcard__measured">
          <strong>{measured}</strong>
          {t.status === "active" && required != null && (
            <> It needs {pct(required)} by now and {pct(t.reduction_pct)} by {periodName(t.deadline)}.</>
          )}
          {closed && <> The target was {pct(t.reduction_pct)}.</>}
          {t.status === "proposed" && <> Tracking starts once it is approved.</>}
        </p>
        {/* No bar until it is tracked: a proposal's "so far" is a preview only. */}
        {t.status !== "rejected" && t.status !== "proposed" && (
          <div
            className="tcard__bar"
            role="img"
            aria-label={`${final == null ? "No" : pct(Math.max(0, final))} reduction of a ${pct(t.reduction_pct)} target${required != null ? `; ${pct(required)} expected by now` : ""}`}
          >
            <span className="tcard__fill" style={{ width: `${fill * 100}%` }} />
            {marker != null && <span className="tcard__marker" style={{ left: `${marker * 100}%` }} />}
          </div>
        )}
        {p.months_compared > 0 && (
          <p className="tcard__basis">
            Based on {p.months_compared} month{p.months_compared === 1 ? "" : "s"} with readings on both sides
            {p.tracking_from && p.tracking_to ? ` (${periodName(p.tracking_from, p.tracking_to)}, each against the same month of ${baseline})` : ""}
            {p.meter_count ? `, from ${p.meter_count} meter${p.meter_count === 1 ? "" : "s"}` : ""}.
          </p>
        )}
      </div>

      {t.status === "rejected" && t.decision_note && (
        <p className="tcard__decision">Reason given: {t.decision_note}</p>
      )}

      {children}
      {actions && <div className="tcard__actions">{actions}</div>}
    </article>
  );
}
