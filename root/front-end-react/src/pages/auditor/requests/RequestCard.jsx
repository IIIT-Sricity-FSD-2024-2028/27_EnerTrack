/**
 * RequestCard — one audit request waiting for a decision.
 *
 * It only shows the request and reports which button was pressed. The page
 * decides what Approve and Deny actually do.
 *
 *   <RequestCard request={r} onApprove={...} onDeny={...} />
 */
import { formatDate, formatNumber } from "../auditorUtils";

export default function RequestCard({ request, onApprove, onDeny }) {
  return (
    <div className="card">
      <div className="header-row">
        <div>
          <h2>{request.name}</h2>
          <p className="sub">
            {request.type}
            {request.location ? " · " + request.location : ""} · requested{" "}
            {formatDate(request.requested_at)}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-light"
            onClick={() => onDeny(request)}
          >
            Deny
          </button>
          <button
            type="button"
            className="btn btn-dark"
            onClick={() => onApprove(request)}
          >
            Approve
          </button>
        </div>
      </div>

      <dl className="request-details">
        <div>
          <dt>Will become administrator</dt>
          <dd>{request.admin_name}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{request.admin_email}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{request.admin_phone || "—"}</dd>
        </div>
        <div>
          <dt>Organisation email domain</dt>
          <dd>{request.email_domain || "—"}</dd>
        </div>
        <div>
          <dt>Floor area</dt>
          <dd>
            {request.floor_area_sqm
              ? formatNumber(request.floor_area_sqm) + " m²"
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
