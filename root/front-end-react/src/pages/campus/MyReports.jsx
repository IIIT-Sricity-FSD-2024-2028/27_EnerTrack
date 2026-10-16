/**
 * MyReports — the "My Reports" list at the bottom of /campus/dashboard.
 *
 * It only displays. The parent (Dashboard.jsx) loads the reports and passes
 * them in through the `tickets` prop. Each ticket looks like:
 *   { id, description, location, priority, status, timestamp, issueType }
 * `timestamp` may be missing (the backend sends no date for a request); the
 * date is then simply not shown.
 *
 * Replaces renderTickets() in the old js/enduser/enduser.js.
 */

// "2026-05-01T..." -> "1 May 2026"
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

import { getStatusInfo } from "./serviceRequestHelpers";

export default function MyReports({ tickets, selectedId, onSelect }) {
  return (
    <div className="ticket-section">
      <h2>
        My Reports
        <span className="ticket-count">{tickets.length}</span>
      </h2>

      {tickets.length === 0 ? (
        <div className="empty-state">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
            <line x1="4" y1="22" x2="4" y2="15"></line>
          </svg>
          <p>You haven't submitted any reports yet.</p>
        </div>
      ) : (
        tickets.map((ticket) => {
          const statusInfo = getStatusInfo(ticket.status);
          const priority = ticket.priority || "Medium";

          return (
            <div
              className={
                ticket.id === selectedId
                  ? "ticket-card selectable is-selected"
                  : "ticket-card selectable"
              }
              key={ticket.id}
              onClick={() => onSelect(ticket)}
            >
              {/* Left side: id, description, location, priority, date */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "4px",
                    marginBottom: "4px",
                  }}
                >
                  <strong style={{ fontSize: "14px", color: "var(--dark)" }}>
                    #{ticket.id}
                  </strong>
                  {ticket.issueType && (
                    <span
                      style={{
                        background: "#f3f4f6",
                        color: "#374151",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        marginLeft: "8px",
                      }}
                    >
                      {ticket.issueType}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: "13px",
                    color: "#374151",
                    margin: "0 0 6px 0",
                    lineHeight: 1.5,
                  }}
                >
                  {ticket.description}
                </p>

                {ticket.location && (
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
                    {ticket.location}
                  </div>
                )}

                <div
                  style={{
                    marginTop: "6px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  <span className={`ticket-priority p-${priority}`}>
                    {priority} Priority
                  </span>
                  {ticket.timestamp && (
                    <span className="ticket-meta">
                      {formatDate(ticket.timestamp)}
                    </span>
                  )}
                </div>
              </div>

              {/* Right side: status pill */}
              <div className={`ticket-status ${statusInfo.cssClass}`}>
                {statusInfo.label}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
