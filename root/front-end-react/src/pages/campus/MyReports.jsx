/**
 * MyReports — the "My Reports" list at the bottom of /campus/dashboard.
 *
 * Shows the student's own reports and the ones they +1'd. Status only:
 * Reported, Technician assigned, Work started, Waiting for check or Fixed. Never
 * priority, dates the work is due, or who is working on it.
 *
 * A report they filed themselves opens read-only in the form above ("View
 * report"). A fixed issue offers "It is fixed" and "Still broken" for a week;
 * "Still broken" asks what is still wrong (required) and takes an optional
 * photo, and the job goes back to the technician who fixed it.
 *
 * Each ticket comes from GET /service-requests/mine:
 *   { id, status, summary, location, reported_on, mine, can_respond, form, reopen_reason }
 */
import { useState } from "react";
import { formatReportedOn, statusClass, statusLabel } from "./serviceRequestHelpers";

const PHOTO_MAX = 5 * 1024 * 1024;

/** "Still broken": what is still wrong, and a photo if they have one. */
function StillBrokenForm({ ticket, onSend, onCancel }) {
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState(null);
  const [problem, setProblem] = useState("");
  const [sending, setSending] = useState(false);
  const reasonId = `sb-reason-${ticket.id}`;
  const photoId = `sb-photo-${ticket.id}`;

  function pickPhoto(file) {
    setProblem("");
    if (!file) return setPhoto(null);
    if (!["image/jpeg", "image/png"].includes(file.type)) return setProblem("The photo must be a JPEG or PNG.");
    if (file.size > PHOTO_MAX) return setProblem("The photo must be under 5 MB.");
    setPhoto(file);
  }

  async function submit(e) {
    e.preventDefault();
    if (reason.trim().length < 3) return setProblem("Tell us what is still wrong (a few words).");
    setSending(true);
    const ok = await onSend(ticket.id, reason.trim(), photo);
    setSending(false);
    if (ok) onCancel();
  }

  return (
    <form className="still-broken" onSubmit={submit} noValidate>
      <label htmlFor={reasonId}>What is still wrong?</label>
      <textarea
        id={reasonId}
        rows="2"
        maxLength={500}
        placeholder="e.g. it still drips when the tap is turned off"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        autoFocus
      />
      <label htmlFor={photoId} className="still-broken-photo">
        Add a photo (optional)
        <input id={photoId} type="file" accept="image/jpeg,image/png" onChange={(e) => pickPhoto(e.target.files?.[0])} />
      </label>
      {photo && <small>{photo.name}</small>}
      {problem && <small className="still-broken-error">{problem}</small>}
      <div className="still-broken-actions">
        <button type="submit" className="btn-submit" disabled={sending}>
          {sending ? "Sending…" : "Send back"}
        </button>
        <button type="button" className="plus-one-btn" onClick={onCancel} disabled={sending}>
          Cancel
        </button>
      </div>
      <small>It goes back to the technician who fixed it.</small>
    </form>
  );
}

export default function MyReports({ tickets, viewingId, onView, onConfirm, onStillBroken }) {
  const [broken, setBroken] = useState(null); // ticket id with the "Still broken" form open

  return (
    <div className="ticket-section">
      <h2>
        My Reports
        <span className="ticket-count">{tickets.length}</span>
      </h2>

      {tickets.length === 0 ? (
        <div className="empty-state">
          <p>You haven't submitted any reports yet.</p>
        </div>
      ) : (
        tickets.map((ticket) => (
          <div
            className={
              "ticket-card" +
              (ticket.can_respond ? " has-actions" : "") +
              (viewingId === ticket.id ? " is-selected" : "")
            }
            key={ticket.id}
          >
            <div className="ticket-main">
              {ticket.form ? (
                <button
                  type="button"
                  className="ticket-open"
                  onClick={() => onView(ticket)}
                  aria-pressed={viewingId === ticket.id}
                >
                  {ticket.summary}
                </button>
              ) : (
                <p className="ticket-title">{ticket.summary}</p>
              )}
              <span className="ticket-meta">
                {ticket.reported_on && `Reported on ${formatReportedOn(ticket.reported_on)}`}
                {ticket.form ? (viewingId === ticket.id ? " · Showing above" : " · View report") : " · You pressed +1"}
              </span>
              {ticket.reopen_reason && <span className="ticket-meta">Still broken: {ticket.reopen_reason}</span>}
            </div>
            <div className={`ticket-status ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</div>
            {ticket.can_respond &&
              (broken === ticket.id ? (
                <StillBrokenForm ticket={ticket} onSend={onStillBroken} onCancel={() => setBroken(null)} />
              ) : (
                <div className="ticket-actions">
                  <button type="button" className="plus-one-btn" onClick={() => onConfirm(ticket.id)}>
                    It is fixed
                  </button>
                  <button type="button" className="plus-one-btn" onClick={() => setBroken(ticket.id)}>
                    Still broken
                  </button>
                </div>
              ))}
          </div>
        ))
      )}
    </div>
  );
}
