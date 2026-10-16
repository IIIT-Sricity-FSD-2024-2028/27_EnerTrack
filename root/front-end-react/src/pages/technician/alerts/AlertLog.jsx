/**
 * AlertLog — the "Alert Log" table, most severe first. Read-only: the
 * record of alerts already decided.
 *
 *   Resolved          — a false alarm, or its fault was fixed
 *   In diagnostics    — handed to Fault Detection & Diagnostics as a fault
 *                       (`openFaultFor(alertId)`); fixing the fault resolves it
 *
 * Monitored alerts are not here: they stay in the queue until decided. The
 * old log had a Resolve button that closed an alert with no reason given.
 *
 * Ported from renderHistoryLog() in js/technician/alertsPage.js.
 */
import { actionTaken, alertTime, capitalize } from "../techUtils";

// Higher number = shown higher up in the log.
const SEVERITY_RANK = { critical: 3, high: 3, moderate: 2, medium: 2, low: 1 };

function rankOf(alert) {
  return SEVERITY_RANK[alert.severity] || 0;
}

export default function AlertLog({ alerts, openFaultFor }) {
  // .sort() changes the array it is called on, and `alerts` belongs to the
  // page's state, so sort a copy instead of the original.
  const sorted = [...alerts];
  sorted.sort((a, b) => rankOf(b) - rankOf(a));

  return (
    <div className="card full-width">
      <h2>Alert Log</h2>
      <small>
        Alerts already decided: resolved, or handed to Fault Detection &amp;
        Diagnostics.
      </small>
      <table className="alerts-table">
        <thead>
          <tr>
            <th>Alert ID</th>
            <th>Description</th>
            <th>Severity</th>
            <th>Time</th>
            <th>Action Taken</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan="6">
                <div className="empty-state">
                  No acknowledged or resolved alerts yet.
                </div>
              </td>
            </tr>
          )}

          {sorted.map((alert) => {
            const id = alert.alert_id;
            const severity = alert.severity || "low";

            const fault = openFaultFor(id);

            let statusCell = <span className="badge resolved">Resolved</span>;
            if (alert.status !== "resolved" && fault) {
              statusCell = (
                <span className="badge inprogress">
                  In diagnostics ({fault.fault_id})
                </span>
              );
            }

            return (
              <tr key={id}>
                <td>{id}</td>
                <td>{alert.title || "—"}</td>
                <td>
                  <span className={"badge " + severity}>
                    {capitalize(severity)}
                  </span>
                </td>
                <td>{alertTime(alert)}</td>
                <td>{actionTaken(alert)}</td>
                <td>{statusCell}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
