/**
 * MyReports — the "My Reports" list at the bottom of /campus/dashboard.
 *
 * Shows the student's own reports and the ones they +1'd. Status only:
 * Reported, Technician assigned, Work started, Waiting for check or Fixed. Never
 * priority, dates the work is due, or who is working on it. A fixed issue
 * shows "It is fixed" and "Still broken" for a week.
 *
 * Each ticket comes from GET /service-requests/mine:
 *   { id, status, summary, location, reported_on, mine }
 */
import { formatReportedOn, statusClass, statusLabel } from "./serviceRequestHelpers";

export default function MyReports({ tickets, onRespond }) {
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
            className={"ticket-card" + (ticket.can_respond ? " has-actions" : "")}
            key={ticket.id}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: "14px",
                  color: "#111827",
                  margin: "0 0 6px 0",
                  lineHeight: 1.5,
                  fontWeight: 600,
                }}
              >
                {ticket.summary}
              </p>
              {ticket.reported_on && (
                <span className="ticket-meta">
                  Reported on {formatReportedOn(ticket.reported_on)}
                </span>
              )}
            </div>
            <div className={`ticket-status ${statusClass(ticket.status)}`}>
              {statusLabel(ticket.status)}
            </div>
            {ticket.can_respond && (
              <div style={{ display: "flex", gap: 8, flexBasis: "100%" }}>
                <button type="button" className="plus-one-btn" onClick={() => onRespond(ticket.id, true)}>
                  It is fixed
                </button>
                <button type="button" className="plus-one-btn" onClick={() => onRespond(ticket.id, false)}>
                  Still broken
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
