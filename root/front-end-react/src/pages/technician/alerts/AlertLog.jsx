/**
 * AlertLog — the "Alert Log" table: alerts that have been acknowledged or
 * resolved, most severe first. Acknowledged ones get a small Resolve button.
 *
 * Ported from renderHistoryLog() in js/technician/alertsPage.js.
 */
import { actionTaken, alertTime, capitalize } from "../techUtils";

// Higher number = shown higher up in the log.
const SEVERITY_RANK = { critical: 3, high: 3, moderate: 2, medium: 2, low: 1 };

function rankOf(alert) {
  return SEVERITY_RANK[alert.severity] || 0;
}

export default function AlertLog({ alerts, busyId, onResolve }) {
  // .sort() changes the array it is called on, and `alerts` belongs to the
  // page's state, so sort a copy instead of the original.
  const sorted = [...alerts];
  sorted.sort((a, b) => rankOf(b) - rankOf(a));

  return (
    <div className="card full-width">
      <h2>Alert Log</h2>
      <small>
        Recently acknowledged alerts and their final resolution status.
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

            let statusCell;
            if (alert.status === "resolved") {
              statusCell = <span className="badge resolved">Resolved</span>;
            } else {
              statusCell = (
                <button
                  type="button"
                  className="btn btn-dark btn-sm"
                  disabled={busyId === id}
                  onClick={() => onResolve(id)}
                >
                  Resolve
                </button>
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
