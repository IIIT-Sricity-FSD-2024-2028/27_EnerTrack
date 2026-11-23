/**
 * dispatchSlice.js: auto-dispatch (/dispatch/*). Owner: Person 1.
 *
 * Three values the backend computes, each its own small slice:
 *   dispatchQueue  GET /dispatch/queue        coordinator: tickets the system
 *                                             could not place + team status
 *   myJobs         GET /dispatch/mine         technician: jobs sent to me
 *   availability   GET /dispatch/availability technician: "Available today"
 *
 * Every action below changes several records on the server at once
 * (ranking, the ticket's status, the SLA clock). So instead of guessing the
 * result, each one reloads the lists it affects when it succeeds. Pages
 * only dispatch and show a toast.
 *
 * Coordinator: sendFault, assignTicket, setJobDeadline, decideExtension,
 *              sweepTimeouts
 * Technician:  setAvailability, jobAction({ id, action, body }) with action
 *              acknowledge | decline | start | finish | made-safe | resume |
 *              needs-parts | extension
 */
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createResourceSlice } from "../createResourceSlice";
import { fetchFaults } from "./faultsSlice";
import { fetchServiceRequests } from "./serviceRequestsSlice";
import { fetchWorkOrders } from "./workOrdersSlice";

/* ── the three computed values ────────────────────────────────── */

const dispatchQueue = createResourceSlice({
  name: "dispatchQueue",
  path: "/dispatch/queue",
  initialData: { queued: [], team_status: [] },
});

const myJobs = createResourceSlice({
  name: "myJobs",
  path: "/dispatch/mine",
  initialData: [],
});

const availability = createResourceSlice({
  name: "availability",
  path: "/dispatch/availability",
});

export const { fetch: fetchDispatchQueue } = dispatchQueue.thunks;
export const { fetch: fetchMyJobs } = myJobs.thunks;
export const { fetch: fetchAvailability } = availability.thunks;

export const { selectData: selectDispatchQueue } = dispatchQueue.selectors;
export const { selectData: selectMyJobs } = myJobs.selectors;
export const { selectData: selectAvailability } = availability.selectors;

export const dispatchQueueReducer = dispatchQueue.reducer;
export const myJobsReducer = myJobs.reducer;
export const availabilityReducer = availability.reducer;

/* ── actions ─────────────────────────────────────────────────── */

/** Reload lists after an action. A failed reload does not fail the action. */
function reload(dispatch, thunks) {
  return Promise.all(thunks.map((t) => dispatch(t({ force: true }))));
}

const COORDINATOR_LISTS = [
  fetchDispatchQueue,
  fetchWorkOrders,
  fetchServiceRequests,
];
const TECHNICIAN_LISTS = [fetchMyJobs, fetchWorkOrders, fetchAvailability];

/** A coordinator action: send it, then reload the coordinator's lists. */
function coordinatorAction(type, request, extraLists = []) {
  return apiThunk(type, async (arg, { dispatch }) => {
    const result = await request(arg);
    await reload(dispatch, [...COORDINATOR_LISTS, ...extraLists]);
    return result;
  });
}

/** Turns a fault into a job: { faultId, kind, priority, assigneeId?, notes? }. */
export const sendFault = coordinatorAction(
  "dispatch/sendFault",
  ({ faultId, kind, priority, assigneeId, notes }) =>
    api.post(`/dispatch/faults/${faultId}/send`, {
      kind,
      priority,
      ...(assigneeId ? { assignee_id: assigneeId } : {}),
      ...(notes ? { notes } : {}),
    }),
  [fetchFaults],
);

export const assignTicket = coordinatorAction(
  "dispatch/assignTicket",
  ({ ticketId, userId }) =>
    api.post(`/dispatch/tickets/${ticketId}/assign`, { user_id: userId }),
);

export const setJobDeadline = coordinatorAction(
  "dispatch/setDeadline",
  ({ workOrderId, deadlineAt }) =>
    api.put(`/dispatch/work-orders/${workOrderId}/deadline`, {
      deadline_at: deadlineAt,
    }),
);

export const decideExtension = coordinatorAction(
  "dispatch/decideExtension",
  ({ workOrderId, approve }) =>
    api.post(`/dispatch/work-orders/${workOrderId}/extension/decide`, {
      approve,
    }),
);

export const sweepTimeouts = coordinatorAction("dispatch/sweep", () =>
  api.post("/dispatch/sweep", {}),
);

/** Technician: switch "Available today". Turning it on may place jobs. */
export const setAvailability = apiThunk(
  "dispatch/setAvailability",
  async (available, { dispatch }) => {
    const result = await api.put("/dispatch/availability", { available });
    await reload(dispatch, TECHNICIAN_LISTS);
    return result;
  },
);

/** Technician: one step on a job sent to them. */
export const jobAction = apiThunk(
  "dispatch/jobAction",
  async ({ id, action, body = {} }, { dispatch }) => {
    const result = await api.post(
      `/dispatch/work-orders/${id}/${action}`,
      body,
    );
    await reload(dispatch, TECHNICIAN_LISTS);
    return result;
  },
);
