/**
 * VerifyFeed — the "Final Verification" list on the Technician overview.
 *
 * Shows work orders in Review: the technician finished and a supervisor
 * still has to check. It owns no data: the page passes in the list, the
 * users (for the technician's name), which item is busy, and what to call
 * when a Verify button is clicked.
 *
 * The old page also listed service requests in "Work Complete (Awaiting
 * Validation)", but nothing sets that status: a request is finished through
 * the work order made from it.
 *
 * Ported from renderVerifyFeed() in js/technician/overviewPage.js.
 */
import { capitalize, formatId, userName } from "../techUtils";

export default function VerifyFeed({
  workOrders,
  users,
  busyId,
  onVerifyWorkOrder,
}) {
  if (workOrders.length === 0) {
    return (
      <div className="empty-state">
        No completed jobs awaiting verification.
      </div>
    );
  }

  return (
    <div>
      {workOrders.map((wo) => {
        const id = wo.work_order_id;
        const isBusy = busyId === id;
        // Same label as the Work Orders page when an order has no type.
        const type = capitalize(wo.details?.type) || "Not set";

        return (
          <div key={id} className="verify-item">
            <h4>
              {formatId(id, "WO")} — {wo.title} ({type})
            </h4>
            <p>
              Completed by <strong>{userName(users, wo.assigned_to_id)}</strong>
              . Awaiting quality check.
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
