/**
 * WastageAuditCard — one wastage case in the Sustainability Officer's queue.
 *
 * A case is a pattern of waste the officer opened from a signal (or from
 * Monitoring). The row shows what the case is about and the reports behind
 * it, the remedy, Finance's figures (only for a remedy that needs spending)
 * and the target, then the buttons for the step the case is on. The buttons
 * only call onAction(name); the parent (WastageAuditQueue) does the saving.
 * Styles live in ../overview.css (so-* classes).
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import PhotoViewer from "../../../ui/PhotoViewer";
import { ROLE_BADGES, TYPE_COLORS } from "./auditShared";
import { formatCurrency, formatDateTime, wastageSummary } from "../../finance/financeUtils";


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

// Chip text + tone. "action" = waiting on the officer, "finance" = with
// Finance, "ready" = can be closed out.
const STATUS_CHIPS = {
  Open: { label: "Plan the remedy", tone: "action" },
  "Forwarded to Finance": { label: "With Finance", tone: "finance" },
  "Cost Impact Added": { label: "Finance reviewing", tone: "finance" },
  "Returned to SO": { label: "Cost data returned", tone: "action" },
  "Target Set": { label: "Target set", tone: "ready" },
  "Verify Target": { label: "Check target", tone: "action" },
  "Target Met": { label: "Target met", tone: "ready" },
  "Target Missed": { label: "Target missed", tone: "action" },
};

// Cases still waiting for a remedy get an age badge.
const AGE_TRACKED = ["Open"];

function ageBadge(report) {
  if (!AGE_TRACKED.includes(report.status) || !report.timestamp) return null;
  const days = Math.floor((Date.now() - new Date(report.timestamp).getTime()) / 86_400_000);
  if (days < 1) return null;
  const tone = days >= 14 ? "old" : days >= 7 ? "aging" : "fresh";
  return { days, tone };
}


// Statuses at which Finance's cost figures / the officer's target are shown
const COST_VISIBLE = ["Returned to SO", "Target Set", "Verify Target", "Target Met", "Target Missed"];
const TARGET_VISIBLE = ["Target Set", "Verify Target", "Target Met", "Target Missed"];

/** "+128% above baseline" — from the stored deviation, or worked out. */
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

/** The buttons for each step of the case. */
function ActionButtons({ status, remedy, busy, onAction }) {
  const props = (action) => ({ type: "button", disabled: busy, onClick: () => onAction(action) });

  if (status === "Open") {
    // The remedy decides the next step: no cost → a target; spending → Finance.
    if (!remedy)
      return (
        <>
          <button {...props("remedy")} className="so-btn primary">Plan the remedy</button>
          <button {...props("dismiss")} className="so-btn danger">Dismiss</button>
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
        <button {...props("dismiss")} className="so-btn danger">Dismiss</button>
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

/** "north  campus cafeteria " and "North Campus Cafeteria" are the same place. */
const placeKey = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

export default function WastageAuditCard({ report, busy, foodLogs = [], onAction, onAddComment }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const sd = report.systemData || {};
  const { summary, location } = wastageSummary(report);
  const remedyPlanned = report.status === "Open" && report.details?.remedy;
  const chip = remedyPlanned
    ? { label: report.details.remedy.type === "spend" ? "Ready for Finance" : "Ready for a target", tone: "action" }
    : STATUS_CHIPS[report.status] || { label: report.status, tone: "finance" };
  const comments = report.comments || [];
  const ci = report.costImpact;
  const mt = report.metricTarget;
  const anomaly = sd.anomalyDetected || sd.status === "abnormal";
  const deviation = deviationText(sd);
  const remedy = report.details?.remedy || null;
  const linked = report.sourceRequestIds?.length || 0;
  // Food is measured by General Maintenance's weigh-ins, not a sensor.
  const isFood = report.type === "Food";
  const hasSensor = !isFood && sd.readingValue !== undefined && sd.readingValue !== null;
  const food = isFood ? foodLogs.find((l) => placeKey(l.location) === placeKey(report.details?.location)) : null;

  function handleSend() {
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText("");
  }

  const age = ageBadge(report);

  return (
    <article className="so-report" aria-label={`${report.type} wastage case ${report.shortId}`}>
      <div className="so-report-top">
        <div className="so-report-title">
          <span className="so-type-icon" style={{ color: TYPE_COLORS[report.type] || "#6b7280" }} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {TYPE_ICONS[report.type]}
            </svg>
          </span>
          <strong>{report.type} wastage</strong>
          {location && <span title={location}>{location}</span>}
        </div>
        <span className="so-report-chips">
          {age && (
            <span className={`so-age so-age--${age.tone}`} title="Days since the case was opened">
              {age.days} day{age.days === 1 ? "" : "s"} old
            </span>
          )}
          <span className={`so-status ${chip.tone}`}>{chip.label}</span>
        </span>
      </div>

      <div className="so-report-body">
        <div className="so-report-main">
          <p className="so-observation">{summary || "No description provided."}</p>
          <div className="so-meta">
            <span>Opened by {report.reporterName}</span>
            <span>
              {linked
                ? `From ${linked} waste report${linked === 1 ? "" : "s"}`
                : report.details?.origin === "food_log"
                  ? "From food weigh-ins"
                  : report.details?.origin === "meter"
                    ? "From a meter"
                    : "From monitoring"}
            </span>
            <span>{formatDateTime(report.timestamp)}</span>
            <span title={report.id}>WR-{report.shortId}</span>
          </div>
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
          <button type="button" className="so-link" aria-expanded={showComments} onClick={() => setShowComments(!showComments)}>
            {showComments ? "Hide comments" : comments.length ? `Comments (${comments.length})` : "Add comment"}
          </button>
        </div>

        {isFood && (
          <div className="so-sensor">
            <div>Weigh-ins (General Maintenance)</div>
            {food ? (
              <>
                <div className="so-sensor-value">
                  {food.kg_per_day_30d ?? "—"} <small>kg/day</small>
                </div>
                <div>Last 30 days</div>
                <div style={{ marginTop: 4 }}>
                  <span className={food.rising ? "anomaly" : "normal"}>
                    {food.kg_per_day_7d ?? "—"} kg/day this week{food.rising ? ", rising" : ""}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 4 }}>Nothing logged for this place yet.</div>
            )}
          </div>
        )}

        {hasSensor && (
        <div className="so-sensor">
          <div>Sensor {sd.sensorId || "not linked"}</div>
          <div className="so-sensor-value">
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
