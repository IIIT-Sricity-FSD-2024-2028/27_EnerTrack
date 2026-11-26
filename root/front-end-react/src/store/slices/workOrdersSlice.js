/**
 * workOrdersSlice.js: /work-orders (id: work_order_id). Owner: Person 1.
 *
 * CRUD from createCrudSlice (see its header). Remember that the backend
 * replaces `details` as a whole on PATCH: always send
 * `{ details: { ...wo.details, <change> } }`.
 *
 * Extra:
 *   createWorkOrderFromRequest({ body, requestId })
 *     creates the order; if it came from a service request, that request
 *     moves to in_progress.
 *   closeWorkOrder(workOrderId)
 *     closes the order and everything hanging off it: its service request is
 *     closed, its fault resolved, and that fault's alert resolved. Only
 *     records that are actually loaded are touched (seed data points at ids
 *     that do not exist, and a 404 would stop the close halfway). Each step
 *     updates its own slice in place.
 *
 * Dispatch actions (acknowledge, start, assign, ...) live in dispatchSlice
 * and reload this list themselves, because the server changes several
 * records at once.
 */
import { createSelector } from "@reduxjs/toolkit";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";
import { updateAlert } from "./alertsSlice";
import { updateFault } from "./faultsSlice";
import { updateServiceRequest } from "./serviceRequestsSlice";

const workOrders = createCrudSlice({
  name: "workOrders",
  path: "/work-orders",
  idKey: "work_order_id",
});

export const {
  fetchAll: fetchWorkOrders,
  fetchOne: fetchWorkOrder,
  create: createWorkOrder,
  update: updateWorkOrder,
  remove: removeWorkOrder,
} = workOrders.thunks;

export const {
  selectAll: selectAllWorkOrders,
  selectById: selectWorkOrderById,
  selectStatus: selectWorkOrdersStatus,
  selectError: selectWorkOrdersError,
} = workOrders.selectors;

/** Estimates waiting for Finance to approve (status "approval"). */
export const selectWorkOrdersAwaitingApproval = createSelector([selectAllWorkOrders], (rows) =>
  rows.filter((w) => w.status === "approval"),
);

export const createWorkOrderFromRequest = apiThunk(
  "workOrders/createFromRequest",
  async ({ body, requestId }, { dispatch }) => {
    const created = await dispatch(createWorkOrder(body)).unwrap();
    if (requestId) {
      await dispatch(
        updateServiceRequest({
          id: requestId,
          changes: { status: "in_progress" },
        }),
      ).unwrap();
    }
    return created;
  },
);

export const closeWorkOrder = apiThunk(
  "workOrders/close",
  async (workOrderId, { dispatch, getState }) => {
    const state = getState();
    const wo = state.workOrders.entities[workOrderId];
    if (!wo) throw new Error(`Work order ${workOrderId} is not loaded.`);

    await dispatch(
      updateWorkOrder({ id: workOrderId, changes: { status: "closed" } }),
    ).unwrap();

    const request = wo.source_request_id
      ? state.serviceRequests.entities[wo.source_request_id]
      : null;
    if (request && request.status !== "closed") {
      await dispatch(
        updateServiceRequest({
          id: request.service_request_id,
          changes: { status: "closed" },
        }),
      ).unwrap();
    }

    const fault = wo.linked_fault_id
      ? state.faults.entities[wo.linked_fault_id]
      : null;
    if (fault && fault.status !== "resolved") {
      await dispatch(
        updateFault({ id: fault.fault_id, changes: { status: "resolved" } }),
      ).unwrap();
      if (fault.alert_id) {
        await dispatch(
          updateAlert({
            id: fault.alert_id,
            changes: { status: "resolved" },
          }),
        ).unwrap();
      }
    }
    return workOrderId;
  },
);

export default workOrders.reducer;
