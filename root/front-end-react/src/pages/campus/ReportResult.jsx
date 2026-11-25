/**
 * ReportResult — the outcome of a finished wastage case: the remedy,
 * Finance's figures (only when the remedy needed spending), the target, and
 * the readings against it. Shown in the Sustainability Officer's archive
 * (pages/sustainability/archives/WastageArchive).
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
  const closed = report.status === "Closed" || report.status === "Delivered";
  const remedy = report.details?.remedy;
  const result = report.details?.targetOutcome?.result;

  return (
    <section className="rr" aria-label="Report outcome">
      <h4 className="rr-heading">Outcome</h4>
      <p className="rr-summary">
        {remedy ? (
          <>
            The fix for this {type} waste was <strong>{remedy.description}</strong>
            {remedy.type === "spend" ? ", which needed spending." : ", at no cost."}
          </>
        ) : (
          <>The Sustainability Officer opened this case for repeated {type} waste.</>
        )}
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
        {result === "met" && " The target was met."}
        {result === "missed" && " The target was not fully met."}
        {closed && " The case is closed and the people who reported the waste were told."}
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
