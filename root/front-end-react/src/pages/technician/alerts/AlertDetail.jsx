/**
 * AlertDetail — the right-hand panel on the Alerts page: details of the
 * selected alert and the buttons to act on it.
 *
 * `alert` is undefined when there are no open alerts left; the panel then
 * says so and disables its buttons.
 *
 * Ported from selectAlert() in js/technician/alertsPage.js.
 */
import { PinIcon } from "../components/icons";
import { capitalize } from "../techUtils";

// What gets recorded in the alert's thread as the "Action Taken".
const ACTION_EMERGENCY = "Emergency Response Initiated";
const ACTION_INSPECTION = "Inspection Scheduled";

export default function AlertDetail({
  alert,
  busy,
  onAcknowledge,
  onResolveClick,
}) {
  // Nothing to show — every alert has been handled.
  if (!alert) {
    return (
      <div className="card detail-card">
        <div className="detail-header">
          <div className="detail-header-left">
            <h2>No open alerts</h2>
          </div>
        </div>
        <div className="detail-description-box">
          All alerts have been resolved or acknowledged.
        </div>
      </div>
    );
  }

  const severity = alert.severity || "low";

  return (
    <div className="card detail-card">
      <div>
        <div className="detail-header">
          <div className="detail-header-left">
            <h2>Alert {alert.alert_id} Details</h2>
            <span className={"badge " + severity}>{capitalize(severity)}</span>
          </div>
        </div>

        <div className="detail-meta">
          <span className="zone-badge">
            <PinIcon />
            <span>{alert.meter_id || "Unknown Zone"}</span>
          </span>
        </div>

        <div className="detail-description-box">{alert.title || "—"}</div>

        <div className="section-label">Alert Resolution</div>
        <div className="action-boxes">
          <div className="action-box emergency-box">
            <div>
              <h4>Emergency Protocol</h4>
              <p>Escalate alert and deploy field response immediately.</p>
            </div>
            <button
              type="button"
              className="btn btn-red btn-full"
              disabled={busy}
              onClick={() => onAcknowledge(alert.alert_id, ACTION_EMERGENCY)}
            >
              Initiate Response
            </button>
          </div>
          <div className="action-box routine-box">
            <div>
              <h4>Routine Inspection</h4>
              <p>Acknowledge and plan follow-up inspection later.</p>
            </div>
            <button
              type="button"
              className="btn btn-light btn-full"
              disabled={busy}
              onClick={() => onAcknowledge(alert.alert_id, ACTION_INSPECTION)}
            >
              Schedule Inspection
            </button>
          </div>
        </div>
      </div>

      <div className="footer-action">
        <small>Once action is taken, resolve this alert.</small>
        <button
          type="button"
          className="btn btn-dark"
          disabled={busy}
          onClick={onResolveClick}
        >
          Resolve Alert
        </button>
      </div>
    </div>
  );
}
