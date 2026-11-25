/**
 * WastageReportCard — one wastage case waiting for cost review.
 *
 * Only cases whose remedy needs spending come to Finance (a no-cost remedy
 * goes straight to a target). The row shows the case and the remedy with the
 * officer's rough estimate, the meter reading when the case has one, then the
 * cost impact (once added), any revision request, the comment thread and the
 * buttons. The buttons only call the callbacks passed in as props; the
 * parent (WastageReviewQueue) does the saving.
 */
import { useState } from "react";
import { formatCurrency, formatDateTime, reportRef, wastageSummary } from "../financeUtils";

// Same per-metric colours as the Monitoring chart legend
const TYPE_COLORS = { Energy: "#059669", Water: "#0284c7", Emissions: "#7c3aed", Food: "#dc2626" };

const TYPE_ICONS = {
  Energy: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  Water: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  Emissions: <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />,
  Food: (
    <>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    </>
  ),
};

const ROLE_BADGES = {
  "Sustainability Officer": { label: "SO", color: "#059669" },
  "Finance Analyst": { label: "FA", color: "#6366f1" },
  // POST /:id/comments records the RBAC role name
  "Financial Analyst": { label: "FA", color: "#6366f1" },
};

/** "+127% over baseline" — from the stored deviation, or worked out. */
function deviationText(sd) {
  let pct = Number(sd.deviation);
  if (!Number.isFinite(pct)) {
    const cur = Number(sd.readingValue);
    const base = Number(sd.baselineValue);
    if (!(Number.isFinite(cur) && Number.isFinite(base) && base > 0)) return null;
    pct = ((cur - base) / base) * 100;
  }
  return `${pct > 0 ? "+" : ""}${pct.toFixed(0)}% over baseline`;
}

export default function WastageReportCard({ report, onEditCostImpact, onReturn, onAddComment }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const sd = report.systemData || {};
  const { summary, location } = wastageSummary(report);
  const pending = report.status === "Forwarded to Finance";
  const ci = report.costImpact;
  const comments = report.comments || [];
  const anomaly = sd.anomalyDetected || sd.status === "abnormal";
  const deviation = deviationText(sd);
  const remedy = report.details?.remedy || null;
  const hasSensor = sd.readingValue !== undefined && sd.readingValue !== null;
  const linked = report.sourceRequestIds?.length || 0;

  // ROI and payback are worked out from the saved figures for display.
  const roi = ci && ci.remediationCost > 0 ? ((ci.projectedSavings - ci.remediationCost) / ci.remediationCost) * 100 : null;
  const payback = ci && ci.projectedSavings > 0 ? ci.remediationCost / ci.projectedSavings : null;

  function handleSend() {
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText("");
  }

  return (
    <article className="fo-row" aria-label={`${report.type} wastage case WR-${reportRef(report.id)}`}>
      <div className="fo-row-top">
        <div className="fo-row-title">
          <span className="fo-type-icon" style={{ color: TYPE_COLORS[report.type] || "#6b7280" }} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {TYPE_ICONS[report.type]}
            </svg>
          </span>
          <strong>{report.type} waste</strong>
          {location && <span title={location}>{location}</span>}
        </div>
        <span className={pending ? "fo-chip action" : "fo-chip ready"}>{pending ? "Needs cost impact" : "Ready to return"}</span>
      </div>

      <div className="fo-report-body">
        <div className="fo-report-main">
          <p className="fo-observation">{summary || "No description provided."}</p>
          <div className="fo-meta">
            <span>Opened by {report.reporterName}</span>
            {linked > 0 && <span>From {linked} waste report{linked === 1 ? "" : "s"}</span>}
            {report.details?.forwardedAt && <span>Sent {formatDateTime(report.details.forwardedAt, false)}</span>}
            <span title={report.id}>WR-{reportRef(report.id)}</span>
          </div>

          {remedy && (
            <p className="fo-note">
              <strong>Remedy to cost:</strong> {remedy.description}
              {remedy.estimate ? <> (officer's rough estimate {formatCurrency(remedy.estimate)})</> : null}
            </p>
          )}

          {report.revisionRequest && pending && (
            <p className="fo-note revision">
              <strong>The officer asked for a revision:</strong> {report.revisionRequest.reason}
              {report.revisionRequest.notes && <> ({report.revisionRequest.notes})</>}
            </p>
          )}

          {ci && (
            <div className="fo-figures" aria-label="Cost impact">
              <div>
                Estimated loss<strong style={{ color: "#b91c1c" }}>{formatCurrency(ci.estimatedLoss)}</strong>
              </div>
              <div>
                Remediation cost<strong>{formatCurrency(ci.remediationCost)}</strong>
              </div>
              <div>
                Projected savings<strong style={{ color: "#065f46" }}>{formatCurrency(ci.projectedSavings)}</strong>
              </div>
              <div>
                ROI<strong>{roi !== null ? roi.toFixed(1) + "%" : "—"}</strong>
              </div>
              <div>
                Payback<strong>{payback !== null ? payback.toFixed(1) + " yrs" : "—"}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="fo-actions">
          {pending ? (
            <button type="button" className="fo-btn primary" onClick={onEditCostImpact}>
              Add cost impact
            </button>
          ) : (
            <>
              <button type="button" className="fo-btn positive" onClick={onReturn}>
                Return to Sustainability Officer
              </button>
              <button type="button" className="fo-btn" onClick={onEditCostImpact}>
                Edit cost impact
              </button>
            </>
          )}
          <button type="button" className="fo-link" aria-expanded={showComments} onClick={() => setShowComments(!showComments)}>
            {showComments ? "Hide comments" : comments.length ? `Comments (${comments.length})` : "Add comment"}
          </button>
        </div>

        {hasSensor && (
        <div className="fo-sensor">
          <div>Sensor {sd.sensorId || "not linked"}</div>
          <div className="fo-sensor-value">
            {sd.readingValue ?? "—"} <small>{sd.readingUnit || ""}</small>
          </div>
          <div>
            Baseline {sd.baselineValue ?? "—"} {sd.readingUnit || ""}
          </div>
          <div style={{ marginTop: 4 }}>
            <span className={anomaly ? "anomaly" : "normal"}>
              {anomaly ? `Anomaly${deviation ? `, ${deviation}` : ""}` : "Within normal range"}
            </span>
          </div>
        </div>
        )}
      </div>

      {showComments && (
        <div className="fo-comments">
          {comments.map((c, i) => {
            const badge = ROLE_BADGES[c.role] || { label: "OC", color: "#6b7280" };
            return (
              <div className="fo-comment" key={i}>
                <div className="fo-comment-avatar" style={{ background: badge.color }} aria-hidden="true">
                  {badge.label}
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ color: "#111827" }}>{c.author}</strong>
                  <time dateTime={c.timestamp}>{formatDateTime(c.timestamp, false)}</time>
                  <p>{c.text}</p>
                </div>
              </div>
            );
          })}
          <div className="fo-comment-form">
            <input
              type="text"
              aria-label="Comment"
              placeholder="Write a comment for the Sustainability Officer"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button type="button" className="fo-btn" onClick={handleSend} disabled={!commentText.trim()}>
              Post
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
