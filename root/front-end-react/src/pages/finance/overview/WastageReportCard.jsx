/**
 * WastageReportCard — one sustainability report waiting for cost review.
 *
 * Shows the user's observation, the sensor reading, the cost impact (once
 * added), any revision request from the Sustainability Officer and the
 * comment thread. The buttons only call the callbacks passed in as props;
 * the parent (WastageReviewQueue) does the saving.
 */
import { useState } from "react";
import { formatCurrency, formatDateTime, sensorTitle, wastageSummary } from "../financeUtils";

const TYPE_COLORS = { Energy: "#f59e0b", Water: "#3b82f6", Emissions: "#8b5cf6", Food: "#ef4444" };

const TYPE_ICONS = {
  Energy: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  Water: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  Emissions: (
    <>
      <path d="M8 18l4-8 4 8" />
      <path d="M3 20h18" />
      <path d="M12 2v4" />
    </>
  ),
  Food: (
    <>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </>
  ),
};

const PRIORITY_STYLES = {
  High: { background: "#fef2f2", color: "#991b1b" },
  Medium: { background: "#fffbeb", color: "#92400e" },
  Low: { background: "#f0fdf4", color: "#166534" },
};

const ROLE_BADGES = {
  "Sustainability Officer": { label: "SO", color: "#059669" },
  "Finance Analyst": { label: "FA", color: "#6366f1" },
};

/** The seed data stores confidence as a word ("High"), the simulator as 0.92. */
function confidenceText(value) {
  if (value == null || value === "") return "—";
  return typeof value === "number" ? (value * 100).toFixed(0) + "%" : value;
}

export default function WastageReportCard({ report, onEditCostImpact, onReturn, onAddComment }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const color = TYPE_COLORS[report.type] || "#6b7280";
  const sd = report.systemData || {};
  const { summary, location } = wastageSummary(report);
  const pending = report.status === "Forwarded to Finance";
  const ci = report.costImpact;
  const comments = report.comments || [];

  // ROI and payback are worked out from the saved figures for display.
  const roi = ci && ci.remediationCost > 0
    ? ((ci.projectedSavings - ci.remediationCost) / ci.remediationCost) * 100
    : null;
  const payback = ci && ci.projectedSavings > 0 ? ci.remediationCost / ci.projectedSavings : null;

  function handleSend() {
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText("");
  }

  return (
    <div className="fa-wr" style={{ borderLeftColor: color }}>
      {/* Header */}
      <div className="fa-wr-head">
        <div className="fa-wr-head-left">
          <span style={{ color }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {TYPE_ICONS[report.type]}
            </svg>
          </span>
          <strong>#{String(report.id).split("-")[0]}</strong>
          <span className="fa-wr-type" style={{ background: color }}>{report.type} Wastage</span>
          <span className="fa-wr-by">by {report.reporterName || "End User"}</span>
        </div>
        <span
          className="fa-wr-status"
          style={pending
            ? { background: "#dbeafe", color: "#1e40af" }
            : { background: "#d1fae5", color: "#065f46" }}
        >
          {pending ? "Pending Review" : "Cost Impact Added"}
        </span>
      </div>

      {/* User observation + sensor data */}
      <div className="fa-wr-grid">
        <div className="fa-wr-panel">
          <h4>User Observation</h4>
          <p>{summary || "—"}</p>
          <div className="fa-wr-location">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {location || "—"}
          </div>
          <div style={{ marginTop: 6 }}>
            <span className="fa-wr-priority" style={PRIORITY_STYLES[report.priority] || PRIORITY_STYLES.Low}>
              {report.priority || "Normal"} Priority
            </span>
          </div>
          <div className="fa-wr-muted" style={{ marginTop: 8 }}>
            Validated by SO: {report.validatedAt ? formatDateTime(report.validatedAt) : "—"}
          </div>
        </div>

        <div className="fa-wr-panel sensor">
          <h4>{sensorTitle(report.type)} ({sd.sensorId || "—"})</h4>
          <div className="fa-wr-2col">
            <div>
              <div className="fa-wr-label">Current</div>
              <div className="fa-wr-reading">
                {sd.readingValue || "—"} <small>{sd.readingUnit || ""}</small>
              </div>
            </div>
            <div>
              <div className="fa-wr-label">Baseline</div>
              <div className="fa-wr-reading" style={{ color: "#6b7280" }}>
                {sd.baselineValue || "—"} <small>{sd.readingUnit || ""}</small>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            {sd.anomalyDetected ? (
              <span className="fa-wr-tag" style={{ background: "#fef2f2", color: "#991b1b" }}>⚠ Anomaly Detected</span>
            ) : (
              <span className="fa-wr-tag" style={{ background: "#f0fdf4", color: "#166534" }}>Normal Range</span>
            )}
            <span className="fa-wr-label">Confidence: {confidenceText(sd.confidence)}</span>
          </div>
          <div className="fa-wr-muted" style={{ marginTop: 4 }}>
            {sd.deviation ? `${sd.deviation}% above baseline` : ""}
          </div>
        </div>
      </div>

      {/* Cost impact (after the analyst adds it) */}
      {ci && (
        <div className="fa-wr-box impact">
          <h4>Cost Impact (Added)</h4>
          <div className="fa-wr-impact-grid">
            <div>
              <div className="fa-wr-label">Est. Financial Loss</div>
              <div className="fa-wr-impact-value" style={{ color: "#dc2626" }}>{formatCurrency(ci.estimatedLoss)}</div>
            </div>
            <div>
              <div className="fa-wr-label">Remediation Cost</div>
              <div className="fa-wr-impact-value" style={{ color: "#111827" }}>{formatCurrency(ci.remediationCost)}</div>
            </div>
            <div>
              <div className="fa-wr-label">Projected Savings</div>
              <div className="fa-wr-impact-value" style={{ color: "#059669" }}>{formatCurrency(ci.projectedSavings)}</div>
            </div>
          </div>
          <div className="fa-wr-impact-grid two">
            <div>
              <div className="fa-wr-label">ROI</div>
              <div className="fa-wr-impact-value" style={{ color: roi !== null && roi >= 0 ? "#059669" : "#dc2626" }}>
                {roi !== null ? roi.toFixed(1) + "%" : "—"}
              </div>
            </div>
            <div>
              <div className="fa-wr-label">Payback Period</div>
              <div className="fa-wr-impact-value" style={{ color: "#1e40af" }}>
                {payback !== null ? payback.toFixed(1) + " yrs" : "—"}
              </div>
            </div>
          </div>
          {ci.notes && <div className="fa-wr-note">{ci.notes}</div>}
        </div>
      )}

      {/* Revision request sent back by the Sustainability Officer */}
      {report.revisionRequest && pending && (
        <div className="fa-wr-box revision">
          <h4>⚠ Revision Requested by SO</h4>
          <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px 0", lineHeight: 1.5 }}>
            {report.revisionRequest.reason}
          </p>
          {report.revisionRequest.notes && (
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0, fontStyle: "italic" }}>
              Note: &quot;{report.revisionRequest.notes}&quot;
            </p>
          )}
          <div className="fa-wr-muted" style={{ marginTop: 6 }}>
            Requested at {formatDateTime(report.revisionRequest.requestedAt, false)}
          </div>
        </div>
      )}

      {/* Comment thread (collapsed until "Show" is clicked) */}
      <div className="fa-wr-comments">
        <div className="fa-wr-comments-toggle" onClick={() => setShowComments(!showComments)}>
          <span>Comments ({comments.length})</span>
          <span>{showComments ? "Hide" : "Show"}</span>
        </div>
        {showComments && (
          <div>
            {comments.length === 0 && (
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "8px 0" }}>No comments yet.</p>
            )}
            {comments.map((c, i) => {
              const badge = ROLE_BADGES[c.role] || { label: "CV", color: "#6b7280" };
              return (
                <div className="fa-comment" key={i}>
                  <div className="fa-comment-avatar" style={{ background: badge.color }}>{badge.label}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="fa-comment-author">{c.author}</span>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{formatDateTime(c.timestamp, false)}</span>
                    <p>{c.text}</p>
                  </div>
                </div>
              );
            })}
            <div className="fa-comment-form">
              <input
                type="text"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button type="button" onClick={handleSend}>Send</button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="fa-btn-row" style={{ marginTop: 14 }}>
        {pending ? (
          <button className="fa-btn-dark" onClick={onEditCostImpact}>Add Cost Impact</button>
        ) : (
          <>
            <button className="fa-btn-light fa-btn-edit" onClick={onEditCostImpact}>✏ Edit Cost Impact</button>
            <button className="fa-btn-green" style={{ background: "#059669" }} onClick={onReturn}>
              ← Return to Sustainability Officer
            </button>
          </>
        )}
        <span className="fa-wr-date">{report.timestamp ? formatDateTime(report.timestamp) : ""}</span>
      </div>
    </div>
  );
}
