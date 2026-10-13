/**
 * ServiceRequestPanel — "User-Reported Service Requests": issues reported
 * by campus users that do not have a work order yet. "Create Work Order"
 * hands the request to the page, which pre-fills the New Work Order form.
 *
 * Draws nothing at all when there are no requests, like the old page.
 *
 * Ported from renderServiceRequests() in js/technician/workOrdersPage.js.
 * The old version read fields that do not exist (requested_by_id,
 * created_at) and stamped every request with today's date; this one shows
 * only what the backend actually stores.
 */
import { FlagIcon } from "../components/icons";

/** Shorten long text to `max` characters, adding "…". */
function shorten(text, max) {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max) + "…";
}

export default function ServiceRequestPanel({ requests, onTriage }) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="sr-panel-header">
        <h2>
          <FlagIcon />
          User-Reported Service Requests
        </h2>
        <span className="badge badge-warning">{requests.length} Pending</span>
      </div>

      {requests.map((sr) => {
        const id = sr.service_request_id;
        const summary = sr.description || sr.issue_type || sr.category || "—";

        let reporter = "Campus User";
        if (sr.reporter_id) {
          reporter = "ID: " + sr.reporter_id.slice(0, 8) + "…";
        }

        return (
          <div key={id} className="alert-item card mb-12 sr-item">
            <div className="sr-item-text">
              <h4>{shorten(summary, 80)}</h4>
              <div className="sr-item-meta">
                Reported by {reporter} • Category: {sr.category || "—"} •
                Priority: <strong>{sr.priority || "medium"}</strong>
              </div>
            </div>
            <div>
              <button
                type="button"
                className="btn btn-dark btn-xs"
                onClick={() => onTriage(id)}
              >
                Create Work Order →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
