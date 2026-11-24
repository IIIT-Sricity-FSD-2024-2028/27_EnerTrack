/**
 * WastageAuditCard — one report in the Sustainability Officer's wastage list
 * on the Overview (ported from renderWastageAuditQueue() in
 * js/sustainability_officer/overviewPage.js).
 *
 * A row, read top to bottom:
 *   title      "Energy wastage · Science Block B, Floor 3"
 *   what       what the occupant reported
 *   details    who, when, priority, reference (quiet grey)
 *   flags      only what is unusual: a status other than "new", a report
 *              waiting 7+ days, High priority
 *   evidence   the sensor reading against its baseline, in one line
 *   then Finance's figures and the target once they exist, and the photos.
 * The buttons for the report's current step sit on the right. They only call
 * onAction(name); the parent (WastageAuditQueue) does the saving.
 * Styles live in ../overview.css (so-* classes).
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import PhotoViewer from "../../../ui/PhotoViewer";
import { ROLE_BADGES } from "./auditShared";
import { formatCurrency, formatDateTime, wastageSummary } from "../../finance/financeUtils";

// Status wording and dot colour. "action" = waiting on the officer,
// "finance" = with Finance, "ready" = can be closed out. A brand-new report
// is the normal case in "Needs your action", so it gets no flag.
const STATUS = {
  Reported: null,
  Validated: { label: "Validated", tone: "action" },
  "Forwarded to Finance": { label: "With Finance", tone: "finance" },
  "Cost Impact Added": { label: "Finance reviewing", tone: "finance" },
  "Returned to SO": { label: "Cost data returned", tone: "action" },
  "Target Set": { label: "Target set", tone: "ready" },
  "Verify Target": { label: "Check target", tone: "action" },
  "Target Met": { label: "Target met", tone: "ready" },
  "Target Missed": { label: "Target missed", tone: "action" },
  Finalized: { label: "Finalized", tone: "ready" },
};

// Reports still waiting on the officer's first look are flagged when old.
const AGE_TRACKED = ["Reported", "Validated"];

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const ago = (days) => (days == null ? null : days < 1 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`);

// Statuses at which Finance's cost figures / the officer's target are shown
const COST_VISIBLE = ["Returned to SO", "Target Set", "Verify Target", "Target Met", "Target Missed", "Finalized"];
const TARGET_VISIBLE = ["Target Set", "Verify Target", "Target Met", "Target Missed", "Finalized"];

/** "+128% over baseline" — from the stored deviation, or worked out. */
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

// Once a report is validated the officer can send the problem on as a job.
const RAISABLE = ["Validated", "Returned to SO", "Target Set", "Finalized"];

/** The buttons for each step of the audit workflow: one filled, the rest plain. */
function ActionButtons({ status, busy, onAction }) {
  const props = (action) => ({ type: "button", disabled: busy, onClick: () => onAction(action) });

  if (status === "Reported")
    return (
      <>
        <button {...props("validate")} className="so-btn primary">Validate</button>
        <button {...props("dismiss")} className="so-btn">Dismiss</button>
      </>
    );
  if (status === "Validated")
    return (
      <>
        <button {...props("forward")} className="so-btn primary">Forward to Finance</button>
        <button {...props("target")} className="so-btn">Set target</button>
      </>
    );
  if (status === "Returned to SO")
    return (
      <>
        <button {...props("target")} className="so-btn primary">Set target</button>
        <button {...props("sendBack")} className="so-btn">Send back to Finance</button>
      </>
    );
  if (status === "Target Set")
    return (
      <>
        <button {...props("checkNow")} className="so-btn">Check target now</button>
        <button {...props("target")} className="so-btn">Edit target</button>
      </>
    );
  if (status === "Verify Target") return <button {...props("verify")} className="so-btn primary">Check the result</button>;
  if (status === "Target Met") return <button {...props("deliver")} className="so-btn primary">Send outcome to occupant</button>;
  if (status === "Target Missed")
    return (
      <>
        <button {...props("deliver")} className="so-btn primary">Send outcome to occupant</button>
        <button {...props("target")} className="so-btn">Set a new target</button>
      </>
    );
  if (status === "Finalized")
    return (
      <>
        <button {...props("deliver")} className="so-btn primary">Send report to occupant</button>
        <button {...props("preview")} className="so-btn">Preview report</button>
      </>
    );
  if (status === "Forwarded to Finance") return <span className="so-waiting">Waiting for Finance to add cost impact.</span>;
  if (status === "Cost Impact Added") return <span className="so-waiting">Finance is reviewing the figures.</span>;
  return null;
}

/**
 * Photo evidence. The photo route is RBAC-gated on the Authorization token, which
 * a plain <img src> can't send, so each photo is fetched through
 * api.getBlobUrl() and its object URL is revoked when the row goes away.
 * Clicking a thumbnail opens it full size (see ui/PhotoViewer).
 */
export function PhotoGallery({ urls }) {
  const [srcs, setSrcs] = useState({});
  const key = urls.join("|");

  useEffect(() => {
    let alive = true;
    const created = [];
    urls.forEach((url) => {
      api
        .getBlobUrl(url)
        .then((blobUrl) => {
          created.push(blobUrl);
          if (alive) setSrcs((s) => ({ ...s, [url]: blobUrl }));
          else URL.revokeObjectURL(blobUrl);
        })
        .catch((err) => console.warn("[SO Wastage] Could not load photo:", url, err.message));
    });
    return () => {
      alive = false;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <PhotoViewer photos={urls.map((url, i) => ({ src: srcs[url], alt: `Evidence photo ${i + 1}` }))} />;
}

function CostFigures({ ci }) {
  const roi =
    ci.roi != null ? ci.roi : ci.remediationCost > 0 ? ((ci.projectedSavings - ci.remediationCost) / ci.remediationCost) * 100 : null;
  const payback = ci.paybackPeriod != null ? ci.paybackPeriod : ci.projectedSavings > 0 ? ci.remediationCost / ci.projectedSavings : null;

  return (
    <div className="so-figures" aria-label="Finance cost impact">
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
        ROI<strong>{roi != null ? roi.toFixed(1) + "%" : "—"}</strong>
      </div>
      <div>
        Payback<strong>{payback != null ? payback.toFixed(1) + " yrs" : "—"}</strong>
      </div>
    </div>
  );
}

export default function WastageAuditCard({ report, busy, onAction, onAddComment }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const sd = report.systemData || {};
  const spec = report.specificData || {};
  const { summary, location } = wastageSummary(report);
  const status = report.status in STATUS ? STATUS[report.status] : { label: report.status, tone: "finance" };
  const comments = report.comments || [];
  const ci = report.costImpact;
  const mt = report.metricTarget;
  const anomaly = sd.anomalyDetected || sd.status === "abnormal";
  const deviation = deviationText(sd);
  const high = report.priority === "High";

  const days = daysSince(report.timestamp);
  const waiting = AGE_TRACKED.includes(report.status) && days >= 7 ? (days >= 14 ? "old" : "aging") : null;

  function handleSend() {
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText("");
  }

  const hasFlags = status || waiting || high;

  return (
    <article className="so-report" aria-label={`${report.type} wastage report ${report.shortId}`}>
      <div className="so-report-row">
        <div className="so-report-main">
          <p className="so-report-title">
            <strong>{report.type} wastage</strong>
            {location && <span className="so-place"> · {location}</span>}
          </p>
          <p className="so-observation">{summary || "No description provided."}</p>
          <p className="so-meta">
            <span>Reported by {report.reporterName}</span>
            <span>{formatDateTime(report.timestamp)}</span>
            {days != null && !waiting && <span>{ago(days)}</span>}
            {!high && <span>{report.priority} priority</span>}
            <span title={report.id}>WR-{report.shortId}</span>
          </p>

          {hasFlags && (
            <p className="so-flags">
              {status && <span className={`so-dot so-dot--${status.tone}`}>{status.label}</span>}
              {waiting && (
                <span className={`so-dot so-dot--${waiting}`} title="Days since the report was filed">
                  Waiting {days} days
                </span>
              )}
              {high && <span className="so-dot so-dot--high">High priority</span>}
            </p>
          )}

          <p className="so-evidence">
            Sensor {sd.sensorId || "not linked"}:{" "}
            <strong>
              {sd.readingValue ?? "—"} {sd.readingUnit || ""}
            </strong>{" "}
            vs {sd.baselineValue ?? "—"} {sd.readingUnit || ""} baseline
            {" · "}
            <span className={anomaly ? "anomaly" : "normal"}>
              {anomaly ? (deviation ? `Anomaly, ${deviation}` : "Anomaly") : "Within normal range"}
            </span>
            {spec.reportedValue && (
              <>
                {" · "}Reporter estimate {spec.reportedValue} {spec.reportedUnit || ""}
              </>
            )}
          </p>

          {ci && COST_VISIBLE.includes(report.status) && <CostFigures ci={ci} />}

          {mt && TARGET_VISIBLE.includes(report.status) && (
            <p className="so-target">
              <span>Target</span>
              <strong>
                {mt.value} {mt.unit}
              </strong>
              <span>
                by {new Date(mt.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </p>
          )}

          {report.revisionRequest && report.status === "Forwarded to Finance" && (
            <p className="so-note">
              You sent this back: <strong>{report.revisionRequest.reason}</strong>
            </p>
          )}

          <PhotoGallery urls={report.details?.photo_urls || []} />
        </div>

        <div className="so-actions">
          <ActionButtons status={report.status} busy={busy} onAction={onAction} />
          {RAISABLE.includes(report.status) &&
            (report.details?.workOrderRaisedAt ? (
              <span className="so-waiting">Work order raised.</span>
            ) : (
              <button type="button" className="so-btn" disabled={busy} onClick={() => onAction("raiseWorkOrder")}>
                Create work order
              </button>
            ))}
          <button type="button" className="so-btn" aria-expanded={showComments} onClick={() => setShowComments(!showComments)}>
            {showComments ? "Hide comments" : comments.length ? `Comments (${comments.length})` : "Comment"}
          </button>
        </div>
      </div>

      {showComments && (
        <div className="so-comments">
          {comments.map((c, i) => {
            const badge = ROLE_BADGES[c.role] || { label: "OC", color: "#6b7280" };
            return (
              <div className="so-comment" key={i}>
                <div className="so-comment-avatar" style={{ background: badge.color }} aria-hidden="true">
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
          <div className="so-comment-form">
            <input
              type="text"
              aria-label="Comment"
              placeholder="Write a comment for Finance and the reporter"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button type="button" className="so-btn" onClick={handleSend} disabled={busy || !commentText.trim()}>
              Post
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
