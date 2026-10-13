/**
 * AlertQueue — the "Priority Alert Queue" table: every open alert.
 * Clicking a row tells the page which alert to show in the detail panel.
 *
 * Ported from renderQueue() in js/technician/alertsPage.js.
 */
import { alertTime, capitalize } from "../techUtils";

export default function AlertQueue({ alerts, selectedId, onSelect }) {
  return (
    <div className="card">
      <h2>Priority Alert Queue</h2>
      <small>
        Incoming anomalies requiring immediate review. Click a row to inspect.
      </small>
      <table className="alerts-table">
        <thead>
          <tr>
            <th>Alert ID</th>
            <th>Severity</th>
            <th>Timestamp</th>
            <th>Status</th>
          </tr>
        </thead>
        {/* The id is what tech_alerts.css uses to colour the selected row
            (#alertQueueBody tr.selected). */}
        <tbody id="alertQueueBody">
          {alerts.length === 0 && (
            <tr>
              <td colSpan="4">
                <div className="empty-state">
                  No open alerts — the queue is clear.
                </div>
              </td>
            </tr>
          )}

          {alerts.map((alert) => {
            const severity = alert.severity || "low";
            let rowClass = "";
            if (alert.alert_id === selectedId) {
              rowClass = "selected";
            }

            return (
              <tr
                key={alert.alert_id}
                className={rowClass}
                onClick={() => onSelect(alert.alert_id)}
              >
                <td>{alert.alert_id}</td>
                <td>
                  <span className={"badge " + severity}>
                    {capitalize(severity)}
                  </span>
                </td>
                <td>{alertTime(alert)}</td>
                <td>
                  <span className="badge open">Open</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
