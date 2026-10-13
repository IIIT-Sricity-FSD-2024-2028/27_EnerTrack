/**
 * SummaryCard — "Work Order Summary": status, type, priority and technician
 * of the selected work order.
 *
 * Shared by the Technician Administrator and Technician Jr work-order pages.
 *
 * Ported from selectWorkOrder() in js/technician/workOrdersPage.js.
 */
import { capitalize, userName } from "../techUtils";

export default function SummaryCard({ wo, users }) {
  const details = wo.details || {};

  // Nobody assigned means a junior technician rejected it (or it was never
  // assigned), so flag it in red instead of a quiet "Unassigned".
  let technician;
  if (wo.assigned_to_id) {
    technician = userName(users, wo.assigned_to_id);
  } else {
    technician = (
      <span className="cost-status--required summary-unassigned">
        Unassigned (Rejected)
      </span>
    );
  }

  return (
    <div className="card mb-16">
      <h2 className="section-title-small mb-12">Work Order Summary</h2>
      <div className="summary-grid">
        <span className="summary-label">Status</span>
        <span>{wo.status}</span>
        <span className="summary-label">Type</span>
        {/* Orders from the seed data have no type. */}
        <span>{capitalize(details.type) || "Not set"}</span>
        <span className="summary-label">Priority</span>
        <span>{capitalize(wo.priority)}</span>
        <span className="summary-label">Technician</span>
        <span>{technician}</span>
        {/* Notes carried over when the order was flagged on the
            Diagnostics page. */}
        {details.diagnostic_notes && (
          <>
            <span className="summary-label">Diagnosis</span>
            <span>{details.diagnostic_notes}</span>
          </>
        )}
      </div>
    </div>
  );
}
