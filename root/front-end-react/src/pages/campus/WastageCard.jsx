/**
 * WastageCard — one report in "My Wastage Logs" on /campus/wastage.
 *
 * Top: what was reported, its photos and its status. Below that, depending
 * on the status:
 *   - finished (Finalized / Target Set / Delivered): <ReportResult>, the
 *     same outcome the Sustainability Officer previews before sending it
 *   - Dismissed: the dismissal notice
 * Footer: the comment thread toggle, and Archive once the report is over.
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
 * Styles: campus.css + wastage.css (+ ReportResult.css). Replaces the card
 * part of renderTickets() in js/enduser/wastage.js.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import PhotoViewer from "../../ui/PhotoViewer";
import { reportRef } from "../finance/financeUtils";
import ReportResult from "./ReportResult";
import { formatDate, getStatusInfo, getSummaryAndLocation } from "./wastageHelpers";

const FINISHED = ["Finalized", "Target Set", "Delivered"];

// A report can be archived once it is over: finished, or dismissed by the
// officer. A dismissed report has no results, so it is not "finished".
const ARCHIVABLE = [...FINISHED, "Dismissed"];

// Used when a report has no photo list. Defined once, here: a new [] made
// on every render would look "changed" to the useEffect below and make it
// run again and again.
const NO_PHOTOS = [];

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
  const isFinished = FINISHED.includes(report.status);
  const canArchive = ARCHIVABLE.includes(report.status);
  const comments = report.comments || [];

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
      {/* ── What was reported (left) and its status (right) ── */}
      <div className="card-row">
        <div className="card-main">
          <div className="card-title-row">
            <strong className="card-id">{report.type} wastage</strong>
            {location && <span className="card-location">{location}</span>}
          </div>
          <p className="card-summary">{summary}</p>
          <div className="card-meta-row">
            <span className={priority === "High" ? "card-meta high" : "card-meta"}>
              {priority} priority
            </span>
            {report.timestamp && (
              <span className="card-meta">{formatDate(report.timestamp)}</span>
            )}
            <span className="card-meta" title={report.id}>
              WR-{reportRef(report.id)}
            </span>
          </div>

          {/* Photos sit with the report they belong to (click to enlarge) */}
          {photoUrls.length > 0 && (
            <div onClick={(event) => event.stopPropagation()}>
              <PhotoViewer
                size={72}
                photos={photoUrls.map((url, index) => ({
                  src: photoSrcs[index] || undefined,
                  alt: photoSrcs[index] === null ? "Photo unavailable" : `Evidence photo ${index + 1}`,
                }))}
              />
            </div>
          )}
        </div>

        <div className="card-side">
          <span className={`ticket-status ${status.cssClass}`}>
            {status.label}
          </span>
          <div className="ticket-status-hint">{status.hint}</div>
        </div>
      </div>

      {/* ── Finished reports: the outcome ── */}
      {isFinished && <ReportResult report={report} />}

      {/* ── Dismissed reports ── */}
      {report.status === "Dismissed" && (
        <div className="dismissal-notice">
          <h5>Why this report was dismissed</h5>
          <div className="dismissal-text">
            <p>
              <strong>{report.dismissReason || "No reason given"}.</strong>{" "}
              {report.dismissComment || ""}
            </p>
            <p className="dismissed-on">
              Dismissed on{" "}
              {report.dismissedAt ? formatDate(report.dismissedAt) : "—"}
            </p>
          </div>
        </div>
      )}

      {/* ── Footer: comments toggle, and Archive once the report is over ── */}
      <div className="card-footer" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="card-link"
          aria-expanded={showComments}
          onClick={() => setShowComments(!showComments)}
        >
          {showComments
            ? "Hide comments"
            : comments.length
              ? `Comments (${comments.length})`
              : "Add comment"}
        </button>
        {canArchive && (
          <button
            type="button"
            className="archive-btn"
            onClick={() => onArchive(report)}
          >
            Archive report
          </button>
        )}
      </div>

      {showComments && (
        <div className="comments" onClick={(event) => event.stopPropagation()}>
          {comments.length === 0 && (
            <p className="comments-empty">No comments yet.</p>
          )}
          {comments.map((comment) => (
            <Comment
              key={comment.timestamp + "-" + comment.author}
              comment={comment}
            />
          ))}
          <div className="comment-form">
            <input
              type="text"
              aria-label="Comment"
              placeholder="Write a comment for the Sustainability Officer"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSend()}
            />
            <button type="button" onClick={handleSend} disabled={!commentText.trim()}>
              Post
            </button>
          </div>
        </div>
      )}
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
  } else if (comment.role === "Finance Analyst" || comment.role === "Financial Analyst") {
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
          {comment.timestamp && (
            <span className="comment-date">
              {new Date(comment.timestamp).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <p className="comment-text">{comment.text}</p>
      </div>
    </div>
  );
}
