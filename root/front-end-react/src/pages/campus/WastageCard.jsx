/**
 * WastageCard — one report in "My Wastage Logs" on /campus/wastage.
 *
 * Shows the report, plus extra sections depending on its status:
 *   - finished (Finalized / Target Set / Delivered): impact, target and
 *     sensor boxes, a Decision Summary, before/after bars, Archive button
 *   - Dismissed: a Dismissal Notice
 * and for every report: photo thumbnails and a comment thread.
 *
 * Props:
 *   report        the report to show
 *   isSelected    true if this is the report open in the form (green border)
 *   onSelect      called with the report when the card is clicked
 *   onArchive     called with the report when Archive is clicked
 *   onAddComment  called with (report, text) when a comment is sent;
 *                 resolves to true when it was saved
 *
 * The card does not save anything itself: the parent (Wastage.jsx) does.
 * Styles: campus.css + wastage.css. Replaces the card part of
 * renderTickets() in js/enduser/wastage.js.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import {
  formatCurrency,
  formatDate,
  getStatusInfo,
  getSummaryAndLocation,
} from "./wastageHelpers";

const FINISHED = ["Finalized", "Target Set", "Delivered"];

// A report can be archived once it is over: finished, or dismissed by the
// officer. A dismissed report has no results, so it is not "finished".
const ARCHIVABLE = [...FINISHED, "Dismissed"];

// Used when a report has no photo list. Defined once, here: a new [] made
// on every render would look "changed" to the useEffect below and make it
// run again and again.
const NO_PHOTOS = [];

// Title of the sensor box for each category
const SENSOR_TITLES = {
  Food: "Wastage Assessment",
  Water: "Flow Monitoring",
  Emissions: "Emissions Monitoring",
  Energy: "Energy Meter Reading",
};

// Return on investment (%) and payback (years) from Finance's figures,
// or null when they cannot be worked out
function getReturn(impact) {
  const roi =
    impact.roi != null
      ? impact.roi
      : impact.remediationCost > 0
        ? ((impact.projectedSavings - impact.remediationCost) /
            impact.remediationCost) *
          100
        : null;
  const payback =
    impact.paybackPeriod != null
      ? impact.paybackPeriod
      : impact.projectedSavings > 0
        ? impact.remediationCost / impact.projectedSavings
        : null;
  return roi !== null && payback !== null ? { roi, payback } : null;
}

export default function WastageCard({
  report,
  isSelected,
  onSelect,
  onArchive,
  onAddComment,
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  // Thumbnail addresses; null means that photo failed to load
  const [photoSrcs, setPhotoSrcs] = useState([]);

  const photoUrls = report.photoUrls || NO_PHOTOS;

  // Photos are protected by the login headers, which a plain <img src>
  // cannot send. So fetch each one through the API client, which sends the
  // headers and hands back a local address the <img> can show.
  useEffect(() => {
    let cancelled = false; // the card may disappear before the photos arrive
    Promise.all(
      photoUrls.map((url) => api.getBlobUrl(url).catch(() => null)),
    ).then((srcs) => {
      if (!cancelled) setPhotoSrcs(srcs);
    });
    return () => {
      cancelled = true;
    };
  }, [photoUrls]);

  const status = getStatusInfo(report.status);
  const { summary, location } = getSummaryAndLocation(report);
  const priority = report.priority || "Low";
  const type = report.type.toLowerCase();
  const isFinished = FINISHED.includes(report.status);
  const canArchive = ARCHIVABLE.includes(report.status);
  const impact = report.costImpact; // money figures from Finance, or null
  const target = report.metricTarget; // new target from the officer, or null
  const sensor = report.systemData || {}; // simulated sensor reading
  const comments = report.comments || [];
  const ret = impact ? getReturn(impact) : null;

  async function handleSend() {
    const text = commentText.trim();
    if (!text) return;
    const saved = await onAddComment(report, text);
    if (saved) setCommentText(""); // keep the text if saving failed
  }

  return (
    <div
      className={
        isSelected
          ? "ticket-card selectable is-selected"
          : "ticket-card selectable"
      }
      onClick={() => onSelect(report)}
    >
      {/* ── Details on the left, status on the right ── */}
      <div className="card-row">
        <div className="card-main">
          <div className="card-title-row">
            <strong className="card-id">#{report.id}</strong>
            <span className="type-tag">{report.type} Wastage</span>
          </div>
          <p className="card-summary">{summary}</p>
          <div className="ticket-location">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {location}
          </div>
          <div className="card-meta-row">
            <span className={`ticket-priority p-${priority}`}>
              {priority} Priority
            </span>
            {report.timestamp && (
              <span className="ticket-meta">
                {formatDate(report.timestamp)}
              </span>
            )}
          </div>
        </div>

        <div className="card-side">
          <span className={`ticket-status ${status.cssClass}`}>
            {status.label}
          </span>
          <div className="ticket-status-hint">{status.hint}</div>
        </div>
      </div>

      {/* ── Finished reports: boxes, summary, before/after bars ── */}
      {isFinished && (impact || target || sensor.sensorId) && (
        <div className="ticket-expanded-section">
          {impact && (
            <div className="exp-box">
              <h5>Financial Impact Assessment</h5>
              <div className="exp-row wrap">
                <div>
                  <div className="exp-sub">Est. Loss</div>
                  <div className="exp-val" style={{ color: "#dc2626" }}>
                    {formatCurrency(impact.estimatedLoss)}
                  </div>
                </div>
                <div>
                  <div className="exp-sub">Remediation</div>
                  <div className="exp-val">
                    {formatCurrency(impact.remediationCost)}
                  </div>
                </div>
                <div>
                  <div className="exp-sub">Savings</div>
                  <div className="exp-val" style={{ color: "#059669" }}>
                    {formatCurrency(impact.projectedSavings)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {target && (
            <div className="exp-box">
              <h5>Sustainability Target</h5>
              <div className="exp-val" style={{ color: "#1e40af" }}>
                {target.value}{" "}
                <small style={{ fontSize: "11px", fontWeight: 400 }}>
                  {target.unit}
                </small>
              </div>
              <div className="exp-sub">
                Deadline: {formatDate(target.deadline)}
              </div>
            </div>
          )}

          {sensor.sensorId && (
            <div className="exp-box">
              <h5>
                {SENSOR_TITLES[report.type] || SENSOR_TITLES.Energy} (
                {sensor.sensorId})
              </h5>
              <div className="exp-row">
                <div>
                  <div className="exp-sub">Current</div>
                  <div className="exp-val">
                    {sensor.readingValue || "—"}{" "}
                    <small style={{ fontSize: "11px" }}>
                      {sensor.readingUnit || ""}
                    </small>
                  </div>
                </div>
                <div>
                  <div className="exp-sub">Baseline</div>
                  <div className="exp-val" style={{ color: "#6b7280" }}>
                    {sensor.baselineValue || "—"}{" "}
                    <small style={{ fontSize: "11px" }}>
                      {sensor.readingUnit || ""}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isFinished && (
        <div className="decision-summary">
          <h5>Decision Summary</h5>
          <div className="decision-text">
            <p>
              This {type} wastage report was reviewed and validated by the
              Sustainability Officer, confirming it as a substantiated concern
              requiring remediation.
            </p>
            {impact && (
              <p>
                Following financial due diligence, the Finance Analyst
                determined that the estimated economic impact of this issue
                amounts to{" "}
                <strong style={{ color: "#dc2626" }}>
                  {formatCurrency(impact.estimatedLoss)}
                </strong>{" "}
                in projected losses if left unresolved. The recommended
                remediation cost stands at{" "}
                <strong>{formatCurrency(impact.remediationCost)}</strong>, with
                an anticipated annual saving of{" "}
                <strong style={{ color: "#059669" }}>
                  {formatCurrency(impact.projectedSavings)}
                </strong>{" "}
                upon implementation.
              </p>
            )}
            {ret && (
              <p>
                The projected return on investment is{" "}
                <strong style={{ color: "#059669" }}>
                  {ret.roi.toFixed(1)}%
                </strong>{" "}
                with an estimated payback period of{" "}
                <strong style={{ color: "#1e40af" }}>
                  {ret.payback.toFixed(1)} years
                </strong>
                .
              </p>
            )}
            {target && (
              <p>
                In response, the Sustainability Officer has established a
                revised {type} reduction target of{" "}
                <strong style={{ color: "#1e40af" }}>
                  {target.value} {target.unit}
                </strong>
                , effective until <strong>{formatDate(target.deadline)}</strong>
                .
              </p>
            )}
            {report.status === "Delivered" && (
              <p>
                This report has been formally closed. All findings, financial
                assessments, and corrective actions have been documented and
                delivered for your records.
              </p>
            )}
          </div>
        </div>
      )}

      {isFinished && sensor.baselineValue && sensor.readingValue && (
        <ComparisonBars sensor={sensor} target={target} />
      )}

      {/* ── Dismissed reports ── */}
      {report.status === "Dismissed" && (
        <div className="dismissal-notice">
          <h5>Dismissal Notice</h5>
          <div className="dismissal-text">
            <p>
              <strong>Reason:</strong> {report.dismissReason || "Not specified"}
            </p>
            <p>{report.dismissComment || ""}</p>
            <p className="dismissed-on">
              Dismissed on{" "}
              {report.dismissedAt ? formatDate(report.dismissedAt) : "—"}
            </p>
          </div>
        </div>
      )}

      {/* ── Archive button (finished or dismissed reports only) ── */}
      {canArchive && (
        <button
          type="button"
          className="archive-btn"
          onClick={(event) => {
            event.stopPropagation(); // don't also select the card
            onArchive(report);
          }}
        >
          Archive Report
        </button>
      )}

      {/* ── Photo thumbnails ── */}
      {photoUrls.length > 0 && (
        <div
          className="photo-gallery"
          onClick={(event) => event.stopPropagation()}
        >
          {photoUrls.map((url, index) => (
            <img
              key={url}
              src={photoSrcs[index] || undefined}
              alt={
                photoSrcs[index] === null
                  ? "Photo unavailable"
                  : `Evidence photo ${index + 1}`
              }
            />
          ))}
        </div>
      )}

      {/* ── Comments ── */}
      <div className="comments" onClick={(event) => event.stopPropagation()}>
        <div
          className="comments-header"
          onClick={() => setShowComments(!showComments)}
        >
          <span className="comments-title">Comments ({comments.length})</span>
          <span className="comments-toggle">
            {showComments ? "Hide" : "Show"}
          </span>
        </div>

        {showComments && (
          <div>
            {comments.length === 0 ? (
              <p className="comments-empty">No comments yet.</p>
            ) : (
              comments.map((comment) => (
                <Comment
                  key={comment.timestamp + "-" + comment.author}
                  comment={comment}
                />
              ))
            )}
            <div className="comment-form">
              <input
                type="text"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <button type="button" onClick={handleSend}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Before / after bars: baseline vs current, plus target if set ── */

function ComparisonBars({ sensor, target }) {
  const targetValue = target ? parseFloat(target.value) || 0 : 0;
  // The longest bar fills 1/1.1 of the track, leaving a little room
  const max =
    Math.max(sensor.readingValue, sensor.baselineValue, targetValue) * 1.1;
  const unit = sensor.readingUnit || "";
  const percent = (value) => ((value / max) * 100).toFixed(1) + "%";

  return (
    <div className="compare-box">
      <h5>Before / After Comparison</h5>
      <div className="compare-rows">
        <Bar
          label="Baseline"
          width={percent(sensor.baselineValue)}
          text={`${sensor.baselineValue} ${unit}`}
          track="#e5e7eb"
          fill="#9ca3af"
          textColor="#6b7280"
        />
        <Bar
          label="Current"
          width={percent(sensor.readingValue)}
          text={`${sensor.readingValue} ${unit}`}
          track="#fecaca"
          fill="#dc2626"
          textColor="#dc2626"
        />
        {target && (
          <Bar
            label="Target"
            width={percent(targetValue)}
            text={`${target.value} ${unit}`}
            track="#bbf7d0"
            fill="#059669"
            textColor="#059669"
          />
        )}
      </div>
    </div>
  );
}

// One row of the comparison: label, coloured bar, value. Only the colours
// and the bar's width change from row to row, so only they are inline.
function Bar({ label, width, text, track, fill, textColor }) {
  return (
    <div className="compare-row">
      <span className="compare-label">{label}</span>
      <div className="compare-track" style={{ background: track }}>
        <div
          className="compare-fill"
          style={{ width: width, background: fill }}
        ></div>
      </div>
      <span className="compare-value" style={{ color: textColor }}>
        {text}
      </span>
    </div>
  );
}

/* ── One comment: coloured badge (SO / FA / You), name, date, text ── */

function Comment({ comment }) {
  let badge = "You";
  let color = "#6b7280";
  if (comment.role === "Sustainability Officer") {
    badge = "SO";
    color = "#059669";
  } else if (comment.role === "Finance Analyst") {
    badge = "FA";
    color = "#6366f1";
  }

  return (
    <div className="comment">
      <div className="comment-badge" style={{ background: color }}>
        {badge}
      </div>
      <div className="comment-body">
        <div className="comment-head">
          <span className="comment-author">{comment.author}</span>
          <span className="comment-date">
            {new Date(comment.timestamp).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="comment-text">{comment.text}</p>
      </div>
    </div>
  );
}
