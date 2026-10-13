/**
 * VerifyFeed — the "Final Verification" list on the Technician overview.
 *
 * Shows finished service requests and work orders that a supervisor still
 * has to check. It owns no data: the page passes in the two lists, which
 * item is busy, and what to call when a Verify button is clicked.
 *
 * Ported from renderVerifyFeed() in js/technician/overviewPage.js.
 */
import { capitalize, formatId } from "../techUtils";

export default function VerifyFeed({
  serviceRequests,
  workOrders,
  busyId,
  onVerifyServiceRequest,
  onVerifyWorkOrder,
}) {
  if (serviceRequests.length === 0 && workOrders.length === 0) {
    return (
      <div className="empty-state">
        No completed jobs awaiting verification.
      </div>
    );
  }

  return (
    <div>
      {serviceRequests.map((sr) => {
        const id = sr.service_request_id;
        const isBusy = busyId === id;

        return (
          <div key={id} className="verify-item">
            <h4>
              {formatId(id, "SR")} — {sr.location || "Unknown"} (
              {sr.category || "General"})
            </h4>
            <p>
              Completed by <strong>{sr.assignedTo || "Technician"}</strong>.
              Awaiting quality check.
            </p>
            <button
              type="button"
              className="btn btn-dark"
              disabled={isBusy}
              onClick={() => onVerifyServiceRequest(id)}
            >
              {isBusy ? "Verifying…" : "Verify & Authorize Payment"}
            </button>
          </div>
        );
      })}

      {workOrders.map((wo) => {
        const id = wo.work_order_id;
        const isBusy = busyId === id;
        // Same label as the Work Orders page: seeded orders have no type.
        const type = capitalize(wo.details?.type) || "Not set";

        return (
          <div key={id} className="verify-item">
            <h4>
              {formatId(id, "WO")} — {wo.title} ({type})
            </h4>
            <p>
              Completed by <strong>{wo.technician || "Technician"}</strong>.
              Awaiting quality check.
            </p>
            <button
              type="button"
              className="btn btn-dark"
              disabled={isBusy}
              onClick={() => onVerifyWorkOrder(id)}
            >
              {isBusy ? "Verifying…" : "Verify & Close Work Order"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
