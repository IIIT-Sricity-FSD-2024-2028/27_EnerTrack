/**
 * WastageAuditCard — one report in the Sustainability Officer's Wastage
 * Audit Queue (ported from renderWastageAuditQueue() in
 * js/sustainability_officer/overviewPage.js).
 *
 * A row, not a card: what the occupant saw on the left, the sensor reading on
 * the right, Finance's figures and the target once they exist, then the
 * buttons for whatever step the report is on. The buttons only call
 * onAction(name); the parent (WastageAuditQueue) does the saving.
 * Styles live in ../overview.css (so-* classes).
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import PhotoViewer from "../../../ui/PhotoViewer";
import { formatCurrency, formatDateTime, wastageSummary } from "../../finance/financeUtils";

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

// Chip text + tone. "action" = waiting on the officer, "finance" = with
// Finance, "ready" = can be closed out.
const STATUS_CHIPS = {
  Reported: { label: "New report", tone: "action" },
  Validated: { label: "Validated", tone: "action" },
  "Forwarded to Finance": { label: "With Finance", tone: "finance" },
  "Cost Impact Added": { label: "Finance reviewing", tone: "finance" },
  "Returned to SO": { label: "Cost data returned", tone: "action" },
  "Target Set": { label: "Target set", tone: "ready" },
  Finalized: { label: "Finalized", tone: "ready" },
};

const ROLE_BADGES = {
  "Sustainability Officer": { label: "SO", color: "#059669" },
  "Finance Analyst": { label: "FA", color: "#6366f1" },
  // POST /:id/comments records the RBAC role name
  "Financial Analyst": { label: "FA", color: "#6366f1" },
};

// Statuses at which Finance's cost figures / the officer's target are shown
const COST_VISIBLE = ["Returned to SO", "Target Set", "Finalized"];
const TARGET_VISIBLE = ["Target Set", "Finalized"];

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

/** The buttons for each step of the audit workflow. */
function ActionButtons({ status, busy, onAction }) {
  const props = (action) => ({ type: "button", disabled: busy, onClick: () => onAction(action) });

  if (status === "Reported")
    return (
      <>
        <button {...props("validate")} className="so-btn primary">Validate</button>
        <button {...props("dismiss")} className="so-btn danger">Dismiss</button>
      </>
    );
  if (status === "Validated") return <button {...props("forward")} className="so-btn primary">Forward to Finance</button>;
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
        <button {...props("finalize")} className="so-btn primary">Finalize report</button>
        <button {...props("target")} className="so-btn">Edit target</button>
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
function PhotoGallery({ urls }) {
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

/**
 * The written notes attached to the decision: Finance's note on the cost
 * impact and the officer's comment on the target. Kept in their own section
 * (same look as a comment) rather than tacked onto the figures and target.
 */
function ReportNotes({ report }) {
  const ci = report.costImpact;
  const mt = report.metricTarget;
  const notes = [];
  if (ci?.notes && COST_VISIBLE.includes(report.status))
    notes.push({ role: "Finance Analyst", author: ci.addedBy || "Finance Analyst", label: "on the cost impact", text: ci.notes, at: ci.addedAt });
  if (mt?.justification && TARGET_VISIBLE.includes(report.status))
    notes.push({ role: "Sustainability Officer", author: mt.setBy || "Sustainability Officer", label: "on the target", text: mt.justification, at: mt.setAt });
  if (notes.length === 0) return null;

  return (
    <div className="so-notes" aria-label="Notes">
      {notes.map((n) => {
        const badge = ROLE_BADGES[n.role];
        return (
          <div className="so-comment" key={n.role}>
            <div className="so-comment-avatar" style={{ background: badge.color }} aria-hidden="true">
              {badge.label}
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ color: "#111827" }}>{n.author}</strong> <span className="so-note-label">{n.label}</span>
              {n.at && <time dateTime={n.at}>{formatDateTime(n.at, false)}</time>}
              <p>{n.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WastageAuditCard({ report, busy, onAction, onAddComment }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const sd = report.systemData || {};
  const spec = report.specificData || {};
  const { summary, location } = wastageSummary(report);
  const chip = STATUS_CHIPS[report.status] || { label: report.status, tone: "finance" };
  const comments = report.comments || [];
  const ci = report.costImpact;
  const mt = report.metricTarget;
  const anomaly = sd.anomalyDetected || sd.status === "abnormal";
  const deviation = deviationText(sd);

  function handleSend() {
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText("");
  }

  return (
    <article className="so-report" aria-label={`${report.type} wastage report ${report.shortId}`}>
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
        <span className={`so-status ${chip.tone}`}>{chip.label}</span>
      </div>

      <div className="so-report-body">
        <div className="so-report-main">
          <p className="so-observation">{summary || "No description provided."}</p>
          <div className="so-meta">
            <span>Reported by {report.reporterName}</span>
            <span className={report.priority === "High" ? "high" : undefined}>{report.priority} priority</span>
            <span>{formatDateTime(report.timestamp)}</span>
            <span title={report.id}>WR-{report.shortId}</span>
          </div>

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

          <ReportNotes report={report} />

          {report.revisionRequest && report.status === "Forwarded to Finance" && (
            <p className="so-note">
              You sent this back: <strong>{report.revisionRequest.reason}</strong>
            </p>
          )}

          <PhotoGallery urls={report.details?.photo_urls || []} />

        </div>

        <div className="so-actions">
          <ActionButtons status={report.status} busy={busy} onAction={onAction} />
          <button type="button" className="so-link" aria-expanded={showComments} onClick={() => setShowComments(!showComments)}>
            {showComments ? "Hide comments" : comments.length ? `Comments (${comments.length})` : "Add comment"}
          </button>
        </div>

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
          {spec.reportedValue && (
            <div style={{ marginTop: 4 }}>
              Reporter estimate {spec.reportedValue} {spec.reportedUnit || ""}
            </div>
          )}
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
