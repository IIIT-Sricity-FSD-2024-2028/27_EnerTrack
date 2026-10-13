/**
 * closeWorkOrder — finish a work order and everything that hangs off it.
 *
 * Used by both close buttons, so they always do the same thing:
 *   - "Close & Archive Work Order" on the Work Orders page
 *   - "Verify & Close Work Order" on the Overview page
 *
 * Closing a work order means the job is done, so:
 *   1. the work order is closed
 *   2. the service request it came from (if any) is closed — the campus
 *      user who reported it sees it as Completed
 *   3. the fault it was created for (if any) is resolved, and so is that
 *      fault's alert — otherwise a repaired fault would stay "active"
 *      forever and keep being counted on the Overview
 *
 * `faults` and `serviceRequests` are the page's lists. Seeded work orders
 * point at fault and request ids that do not exist (the old page never
 * noticed, because it ignored errors) — so only a record that is actually
 * in the list is touched. Otherwise the 404 would stop the close halfway.
 *
 * Any failed request throws, and the page shows it as an error toast.
 */
import api from "../../../api/client";

export async function closeWorkOrder(wo, faults, serviceRequests) {
  await api.patch(`/work-orders/${wo.work_order_id}`, { status: "closed" });

  if (wo.source_request_id) {
    const request = serviceRequests.find(
      (sr) => sr.service_request_id === wo.source_request_id,
    );
    if (request && request.status !== "closed") {
      await api.patch(`/service-requests/${request.service_request_id}`, {
        status: "closed",
      });
    }
  }

  if (wo.linked_fault_id) {
    const fault = faults.find((f) => f.fault_id === wo.linked_fault_id);
    if (fault && fault.status !== "resolved") {
      await api.patch(`/faults/${fault.fault_id}`, { status: "resolved" });
      if (fault.alert_id) {
        await api.patch(`/alerts/${fault.alert_id}`, { status: "resolved" });
      }
    }
  }
}
