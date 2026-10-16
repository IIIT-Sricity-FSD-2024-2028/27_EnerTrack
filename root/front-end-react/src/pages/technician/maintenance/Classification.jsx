/**
 * Classification — "4. Fault Classification": what kind of fault this is,
 * how severe, and the two buttons that hand it off as a work order.
 *
 * The buttons do not create anything themselves. They tell the page which
 * kind of repair was chosen, and the page opens the work-order form.
 *
 * `readOnly` (the fault is assigned to someone else) hides the two options:
 * routing the repair is the assignee's call.
 *
 * Ported from the "Fault Classification" card in technician_maintenance.html.
 */
import { capitalize, severityClass } from "../techUtils";

export default function Classification({
  fault,
  busy,
  onFlag,
  readOnly = false,
}) {
  return (
    <div className="card detail-card">
      <h3 className="section-title">4. Fault Classification</h3>
      <div className="result-box">
        <div className="result-header">
          <b>Classification Result</b>
          <span className="badge critical">Requires Action</span>
        </div>
        <div className="note-small classification-note">
          Classify the fault based on findings and route the repair correctly.
        </div>

        <div className="fault-grid">
          <div className="fault-card">
            <b>Fault Type</b>
            <span className="badge low">{fault.fault_type || "—"}</span>
          </div>
          <div className="fault-card">
            <b>Severity</b>
            <span className={"badge " + severityClass(fault.severity)}>
              {capitalize(fault.severity) || "—"}
            </span>
          </div>
        </div>

        {/* Both options share one class so they sit level, with their
            buttons lined up along the bottom. */}
        {!readOnly && (
          <div className="repair-selector">
            <div className="card repair-option">
              <b>Scheduled</b>
              <div className="note-small">
                Flag for scheduled maintenance during the next approved service
                window.
              </div>
              <button
                type="button"
                className="btn btn-light btn-full"
                disabled={busy}
                onClick={() => onFlag("scheduled")}
              >
                Flag Scheduled Maintenance
              </button>
            </div>
            <div className="card repair-option">
              <b>Immediate</b>
              <div className="note-small">
                Flag for immediate repair and hand off to urgent field
                operations.
              </div>
              <button
                type="button"
                className="btn btn-dark btn-full"
                disabled={busy}
                onClick={() => onFlag("immediate")}
              >
                Flag Immediate Repair
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
