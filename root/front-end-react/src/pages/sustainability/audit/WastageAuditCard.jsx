/**
 * WastageAuditCard — one wastage case on the Sustainability Officer's
 * Wastage page.
 *
 * A case is a pattern of waste the officer opened from a signal (or from
 * Monitoring). A row, read top to bottom:
 *   title      "Food wastage · North Campus Cafeteria"
 *   what       the case title
 *   details    who opened it, when, where it came from, reference (quiet grey)
 *   flags      only what is unusual: a status other than "plan the remedy",
 *              a case waiting 7+ days
 *   evidence   one line: the weigh-ins for food, the meter reading otherwise
 *   then the remedy, Finance's figures (only for a remedy that needs
 *   spending) and the target once they exist, and the photos.
 * The buttons for the case's current step sit on the right. They only call
 * onAction(name); the parent (WastageAuditQueue) does the saving.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import PhotoViewer from "../../../ui/PhotoViewer";
import { ROLE_BADGES } from "./auditShared";
import { formatCurrency, formatDateTime, wastageSummary } from "../../finance/financeUtils";

// Status wording and dot colour. "action" = waiting on the officer,
// "finance" = with Finance, "ready" = can be closed out. A new case waiting
// for its remedy is the normal case in "Needs your action", so it gets no flag.
const STATUS = {
  Open: null,
  "Forwarded to Finance": { label: "With Finance", tone: "finance" },
  "Cost Impact Added": { label: "Finance reviewing", tone: "finance" },
  "Returned to SO": { label: "Cost data returned", tone: "action" },
  "Target Set": { label: "Target set", tone: "ready" },
  "Verify Target": { label: "Check target", tone: "action" },
  "Target Met": { label: "Target met", tone: "ready" },
  "Target Missed": { label: "Target missed", tone: "action" },
};

// Cases still waiting for a remedy are flagged when old.
const AGE_TRACKED = ["Open"];

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const ago = (days) => (days == null ? null : days < 1 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`);

// Statuses at which Finance's cost figures / the officer's target are shown
const COST_VISIBLE = ["Returned to SO", "Target Set", "Verify Target", "Target Met", "Target Missed"];
const TARGET_VISIBLE = ["Target Set", "Verify Target", "Target Met", "Target Missed"];

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

// A remedy that needs physical work can be sent on as a job while the case is active.
const RAISABLE = ["Open", "Returned to SO", "Target Set", "Verify Target", "Target Missed"];

/** "north  campus cafeteria " and "North Campus Cafeteria" are the same place. */
const placeKey = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/** The buttons for each step of the case: one filled, the rest plain. */
function ActionButtons({ status, remedy, busy, onAction }) {
  const props = (action) => ({ type: "button", disabled: busy, onClick: () => onAction(action) });

  if (status === "Open") {
    // The remedy decides the next step: no cost → a target; spending → Finance.
    if (!remedy)
      return (
        <>
          <button {...props("remedy")} className="so-btn primary">Plan the remedy</button>
          <button {...props("dismiss")} className="so-btn">Dismiss</button>
        </>
      );
    return (
      <>
        {remedy.type === "spend" ? (
          <button {...props("forward")} className="so-btn primary">Send to Finance</button>
        ) : (
          <button {...props("target")} className="so-btn primary">Set target</button>
        )}
        <button {...props("remedy")} className="so-btn">Change remedy</button>
        <button {...props("dismiss")} className="so-btn">Dismiss</button>
      </>
    );
  }
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
  if (status === "Target Met") return <button {...props("close")} className="so-btn primary">Close the case</button>;
  if (status === "Target Missed")
    return (
      <>
        <button {...props("target")} className="so-btn primary">Set a new target</button>
        <button {...props("close")} className="so-btn">Close the case</button>
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

/** Where the case came from, in a few words. */
function originText(report) {
  const linked = report.sourceRequestIds?.length || 0;
  if (linked) return `From ${linked} waste report${linked === 1 ? "" : "s"}`;
  const origin = report.details?.origin;
  if (origin === "food_log") return "From food weigh-ins";
  if (origin === "meter") return "From a meter";
  return "From monitoring";
}

/** The one-line evidence: weigh-ins for food, the meter reading otherwise. */
function Evidence({ report, food }) {
  if (report.type === "Food") {
    if (!food) return <p className="so-evidence">Weigh-ins: nothing logged for this place yet.</p>;
    return (
      <p className="so-evidence">
        Weigh-ins (General Maintenance): <strong>{food.kg_per_day_30d ?? "—"} kg/day</strong> over 30 days
        {" · "}
        <span className={food.rising ? "anomaly" : "normal"}>
          {food.kg_per_day_7d ?? "—"} kg/day this week{food.rising ? ", rising" : ""}
        </span>
      </p>
    );
  }
  const sd = report.systemData || {};
  if (sd.readingValue === undefined || sd.readingValue === null) return null;
  const anomaly = sd.anomalyDetected || sd.status === "abnormal";
  const deviation = deviationText(sd);
  return (
    <p className="so-evidence">
      Sensor {sd.sensorId || "not linked"}:{" "}
      <strong>
        {sd.readingValue} {sd.readingUnit || ""}
      </strong>{" "}
      vs {sd.baselineValue ?? "—"} {sd.readingUnit || ""} baseline
      {" · "}
      <span className={anomaly ? "anomaly" : "normal"}>
        {anomaly ? (deviation ? `Anomaly, ${deviation}` : "Anomaly") : "Within normal range"}
      </span>
    </p>
  );
}

export default function WastageAuditCard({ report, busy, foodLogs = [], onAction, onAddComment }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const { summary, location } = wastageSummary(report);
  const remedy = report.details?.remedy || null;
  // Once a remedy is planned the case is ready to move on; say which way.
  const status =
    report.status === "Open" && remedy
      ? { label: remedy.type === "spend" ? "Ready for Finance" : "Ready for a target", tone: "action" }
      : report.status in STATUS
        ? STATUS[report.status]
        : { label: report.status, tone: "finance" };
  const comments = report.comments || [];
  const ci = report.costImpact;
  const mt = report.metricTarget;
  const food = report.type === "Food" ? foodLogs.find((l) => placeKey(l.location) === placeKey(report.details?.location)) : null;

  const days = daysSince(report.timestamp);
  const waiting = AGE_TRACKED.includes(report.status) && days >= 7 ? (days >= 14 ? "old" : "aging") : null;

  function handleSend() {
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText("");
  }

  const hasFlags = status || waiting;

  return (
    <article className="so-report" aria-label={`${report.type} wastage case ${report.shortId}`}>
      <div className="so-report-row">
        <div className="so-report-main">
          <p className="so-report-title">
            <strong>{report.type} wastage</strong>
            {location && <span className="so-place"> · {location}</span>}
          </p>
          <p className="so-observation">{summary || "No description provided."}</p>
          <p className="so-meta">
            <span>Opened by {report.reporterName}</span>
            <span>{originText(report)}</span>
            <span>{formatDateTime(report.timestamp)}</span>
            {days != null && !waiting && <span>{ago(days)}</span>}
            <span title={report.id}>WR-{report.shortId}</span>
          </p>

          {hasFlags && (
            <p className="so-flags">
              {status && <span className={`so-dot so-dot--${status.tone}`}>{status.label}</span>}
              {waiting && (
                <span className={`so-dot so-dot--${waiting}`} title="Days since the case was opened">
                  Waiting {days} days
                </span>
              )}
            </p>
          )}

          <Evidence report={report} food={food} />

          {report.details?.signalReasons?.length > 0 && <p className="so-note">Signal: {report.details.signalReasons.join("; ")}</p>}

          {remedy && (
            <p className="so-remedy">
              <span className={`so-remedy-type ${remedy.type}`}>{remedy.type === "spend" ? "Needs spending" : "No cost"}</span>
              <strong>{remedy.description}</strong>
              {remedy.type === "spend" && remedy.estimate ? <span>est. {formatCurrency(remedy.estimate)}</span> : null}
            </p>
          )}

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
          <ActionButtons status={report.status} remedy={remedy} busy={busy} onAction={onAction} />
          {/* A job only makes sense once the fix is known. */}
          {remedy &&
            RAISABLE.includes(report.status) &&
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
              placeholder="Write a note on this case (Finance can read it)"
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
