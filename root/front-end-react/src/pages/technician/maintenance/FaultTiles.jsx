/**
 * FaultTiles — the "Open Acknowledged Alerts" card at the top of the
 * diagnostics page: one tile per fault still waiting for diagnosis.
 * Clicking a tile tells the page which fault to load into the workspace.
 *
 * Ported from renderAlertSelector() in js/technician/maintenancePage.js.
 */
import { capitalize, severityClass, userName } from "../techUtils";

export default function FaultTiles({ faults, users, selectedId, onSelect }) {
  let countLabel = faults.length + " faults";
  if (faults.length === 1) {
    countLabel = "1 fault";
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Open Acknowledged Alerts</h2>
          <small>Selecting an alert loads the diagnostics workspace below.</small>
        </div>
        <span className="badge inprogress">{countLabel}</span>
      </div>

      {faults.length === 0 && (
        <div className="empty-state">
          No faults waiting for diagnosis.
        </div>
      )}

      <div className="alert-selector-grid">
        {faults.map((fault) => {
          const id = fault.fault_id;
          let tileClass = "alert-tile";
          if (id === selectedId) {
            tileClass = "alert-tile active";
          }

          return (
            <div key={id} className={tileClass} onClick={() => onSelect(id)}>
              <span className={"badge " + severityClass(fault.severity)}>
                {capitalize(fault.severity)}
              </span>
              <div className="alert-tile-id">
                {fault.alert_id || "—"} / {id}
              </div>
              <div className="alert-tile-desc">
                {fault.fault_type || "—"} — {fault.asset_name || "—"}
              </div>
              <div className="alert-tile-meta">
                Assigned to {userName(users, fault.assigned_to_id)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
