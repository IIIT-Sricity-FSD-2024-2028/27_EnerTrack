/**
 * WastageArchive — the "Wastage Resolutions" tab of Sustainability Archives.
 *
 * A wastage report lands here once it is closed: sent to the occupant
 * (Delivered), dismissed with a reason, or archived by the officer. Each row
 * says what was reported, where, by whom and how it ended; "Show details"
 * opens the full record. For a delivered report that is the same outcome the
 * occupant received (<ReportResult>): Finance's figures and the target against
 * the sensor readings. For a dismissed one it is the reason given. Photos and
 * the comment thread follow in both cases.
 *
 * The parent loads and normalises the reports (see Archives.jsx) and passes
 * the archived ones in, already filtered by the search box.
 */
import { useState } from "react";
import ReportResult from "../../campus/ReportResult";
import { formatDateTime, wastageSummary } from "../../finance/financeUtils";
import Modal from "../components/Modal";
import { PhotoGallery } from "../audit/WastageAuditCard";
import { ROLE_BADGES, TYPE_COLORS } from "../audit/auditShared";
import archiveCss from "./wastageArchive.css?inline";

/** Chip text and tone for each way a report can end. */
function outcome(report) {
  if (report.status === "Dismissed") return { label: "Dismissed", tone: "dismissed" };
  if (report.status === "Delivered") return { label: "Sent to occupant", tone: "delivered" };
  return { label: "Archived", tone: "archived" };
}

/** When the report was closed, whichever way it ended. */
function closedAt(report) {
  const d = report.details || {};
  return d.deliveredAt || d.dismissedAt || d.soArchivedAt || d.archivedAt || null;
}

/** "17 Oct 2026" */
const day = (iso) => (iso ? formatDateTime(iso, false) : "—");

export default function WastageArchive({ reports, totalCount, canDelete, onDelete }) {
  const [openId, setOpenId] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    setBusy(true);
    await onDelete(confirming);
    setBusy(false);
    setConfirming(null);
  }

  return (
    <section className="sa-panel" aria-label="Wastage resolutions">
      <style>{archiveCss}</style>

      {reports.length === 0 ? (
        <p className="sa-empty">
          {totalCount === 0
            ? "No closed wastage reports yet. Reports appear here once they are sent to the occupant or dismissed."
            : "No closed wastage reports match your search."}
        </p>
      ) : (
        <ul className="sa-list">
          {reports.map((r) => {
            const { summary, location } = wastageSummary(r);
            const chip = outcome(r);
            const open = openId === r.id;
            const closed = closedAt(r);
            return (
              <li className="sa-item" key={r.id}>
                <div className="sa-row">
                  <span className="sa-dot" style={{ background: TYPE_COLORS[r.type] || "#6b7280" }} aria-hidden="true" />
                  <div className="sa-main">
                    <div className="sa-title">
                      <strong>{r.type} wastage</strong>
                      {location && <span className="sa-location">{location}</span>}
                      <span className={`sa-chip ${chip.tone}`}>{chip.label}</span>
                    </div>
                    <p className="sa-summary">{summary || "No description given."}</p>
                    <div className="sa-meta">
                      <span>WR-{r.shortId}</span>
                      <span>Reported by {r.reporterName}</span>
                      <span>Reported {day(r.timestamp)}</span>
                      {closed && <span>Closed {day(closed)}</span>}
                      <span>{r.priority} priority</span>
                    </div>
                  </div>
                  <div className="sa-actions">
                    <button
                      type="button"
                      className="sa-btn"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : r.id)}
                    >
                      {open ? "Hide details" : "Show details"}
                    </button>
                    {canDelete && (
                      <button type="button" className="sa-btn danger" onClick={() => setConfirming(r)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {open && <ArchiveDetails report={r} />}
              </li>
            );
          })}
        </ul>
      )}

      {confirming && (
        <Modal
          title="Delete wastage report"
          confirmLabel="Delete report"
          danger
          busy={busy}
          onConfirm={confirmDelete}
          onClose={() => setConfirming(null)}
        >
          <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
            Delete <strong>WR-{confirming.shortId}</strong> ({confirming.type} wastage) for good? Its photos, figures and comments
            go with it, and the occupant will no longer see it.
          </p>
        </Modal>
      )}
    </section>
  );
}

/** The full record, opened from a row. */
function ArchiveDetails({ report }) {
  const d = report.details || {};
  const photos = d.photo_urls || [];
  const comments = report.comments || [];
  const sd = report.systemData || {};

  return (
    <div className="sa-details">
      {report.status === "Dismissed" ? (
        <div className="sa-block">
          <h4 className="sa-heading">Why it was dismissed</h4>
          <p className="sa-reason">{d.dismissReason || "No reason was recorded."}</p>
          {d.dismissComment && <p className="sa-text">{d.dismissComment}</p>}
          {sd.readingValue != null && (
            <p className="sa-text muted">
              Sensor {sd.sensorId ? `${sd.sensorId} ` : ""}read {sd.readingValue} {sd.readingUnit || ""}
              {sd.baselineValue != null && ` against a baseline of ${sd.baselineValue} ${sd.readingUnit || ""}`}.
            </p>
          )}
        </div>
      ) : (
        <ReportResult report={report} />
      )}

      {photos.length > 0 && (
        <div className="sa-block">
          <h4 className="sa-heading">Photos</h4>
          <PhotoGallery urls={photos} />
        </div>
      )}

      <div className="sa-block">
        <h4 className="sa-heading">Comments</h4>
        {comments.length === 0 ? (
          <p className="sa-text muted">No comments on this report.</p>
        ) : (
          <ul className="sa-comments">
            {comments.map((c, i) => {
              const badge = ROLE_BADGES[c.role] || { label: "OC", color: "#6b7280" };
              return (
                <li className="sa-comment" key={i}>
                  <span className="sa-avatar" style={{ background: badge.color }} aria-hidden="true">
                    {badge.label}
                  </span>
                  <div>
                    <div className="sa-comment-head">
                      <strong>{c.author}</strong>
                      {c.timestamp && <time dateTime={c.timestamp}>{formatDateTime(c.timestamp, false)}</time>}
                    </div>
                    <p className="sa-comment-text">{c.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
