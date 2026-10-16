/**
 * ReportResult — the outcome of a finished wastage report: what was decided,
 * Finance's figures, the new target against the sensor readings, and the
 * officer's comment.
 *
 * It is what the occupant receives, so the same component is used in two
 * places: on the occupant's report card (pages/campus/WastageCard) and in the
 * Sustainability Officer's "Preview report" dialog before it is sent
 * (pages/sustainability/audit). Works with either page's report shape —
 * both carry type, status, costImpact, metricTarget and systemData.
 * Styles: ./ReportResult.css (rr-* classes, loaded globally).
 */
import "./ReportResult.css";

/** "23 Oct 2026" */
function formatDay(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "₹10,000" */
function money(value) {
  if (value == null || value === "" || isNaN(value)) return "—";
  return "₹" + Number(value).toLocaleString("en-IN");
}

/** ROI (%) and payback (years) from Finance's figures, or null for each. */
function getReturn(ci) {
  const roi =
    ci.roi != null ? ci.roi : ci.remediationCost > 0 ? ((ci.projectedSavings - ci.remediationCost) / ci.remediationCost) * 100 : null;
  const payback =
    ci.paybackPeriod != null ? ci.paybackPeriod : ci.projectedSavings > 0 ? ci.remediationCost / ci.projectedSavings : null;
  return { roi, payback };
}

export default function ReportResult({ report }) {
  const ci = report.costImpact;
  const target = report.metricTarget;
  const sensor = report.systemData || {};
  const type = (report.type || "").toLowerCase();
  const { roi, payback } = ci ? getReturn(ci) : {};
  const delivered = report.status === "Delivered";

  return (
    <section className="rr" aria-label="Report outcome">
      <h4 className="rr-heading">Outcome</h4>
      <p className="rr-summary">
        The Sustainability Officer checked this {type} report against the sensor data and confirmed it.
        {ci && (
          <>
            {" "}
            Finance estimates it would cost <strong>{money(ci.estimatedLoss)}</strong> if left alone. Fixing it costs{" "}
            <strong>{money(ci.remediationCost)}</strong> and should save <strong>{money(ci.projectedSavings)}</strong> a year.
          </>
        )}
        {target && (
          <>
            {" "}
            The new target is{" "}
            <strong>
              {target.value} {target.unit}
            </strong>{" "}
            by {formatDay(target.deadline)}.
          </>
        )}
        {delivered && " This report is now closed."}
      </p>

      {ci && (
        <div className="rr-figures">
          <div>
            Cost if left alone<strong className="loss">{money(ci.estimatedLoss)}</strong>
          </div>
          <div>
            Cost to fix<strong>{money(ci.remediationCost)}</strong>
          </div>
          <div>
            Yearly saving<strong className="gain">{money(ci.projectedSavings)}</strong>
          </div>
          <div>
            Return<strong>{roi != null ? `${roi.toFixed(1)}%` : "—"}</strong>
          </div>
          <div>
            Pays back in<strong>{payback != null ? `${payback.toFixed(1)} yrs` : "—"}</strong>
          </div>
        </div>
      )}

      {sensor.readingValue != null && sensor.baselineValue != null && <Readings sensor={sensor} target={target} />}

      {target?.justification && (
        <div className="rr-comment">
          <div className="rr-avatar" aria-hidden="true">
            SO
          </div>
          <div>
            <div className="rr-comment-head">
              <strong>{target.setBy || "Sustainability Officer"}</strong>
              <span>on the target</span>
              {target.setAt && <time dateTime={target.setAt}>{formatDay(target.setAt)}</time>}
            </div>
            <p>{target.justification}</p>
          </div>
        </div>
      )}
    </section>
  );
}

/** Baseline, measured and target on one scale. */
function Readings({ sensor, target }) {
  const baseline = Number(sensor.baselineValue) || 0;
  const measured = Number(sensor.readingValue) || 0;
  const goal = target ? Number(target.value) || 0 : null;
  const max = Math.max(baseline, measured, goal ?? 0) || 1;
  const unit = sensor.readingUnit || target?.unit || "";
  const rows = [
    { label: "Baseline", value: baseline, tone: "base" },
    { label: "Measured", value: measured, tone: measured > baseline ? "high" : "base" },
    ...(goal != null ? [{ label: "Target", value: goal, tone: "goal" }] : []),
  ];

  return (
    <div className="rr-readings">
      <div className="rr-readings-head">
        <h4 className="rr-heading">Readings</h4>
        {sensor.sensorId && <span>Sensor {sensor.sensorId}</span>}
      </div>
      {rows.map((r) => (
        <div className="rr-reading" key={r.label}>
          <span className="rr-reading-label">{r.label}</span>
          <span className="rr-track" aria-hidden="true">
            <span className={`rr-fill ${r.tone}`} style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
          </span>
          <span className="rr-reading-value">
            {r.value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
