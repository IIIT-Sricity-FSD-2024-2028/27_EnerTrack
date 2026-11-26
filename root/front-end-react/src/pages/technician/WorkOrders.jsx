/**
 * WorkOrders.jsx — Maintenance Work Orders (Operations Coordinator).
 *
 * Ported from front-end/js/technician/workOrdersPage.js.
 *
 * Same shape as the other technician pages: this page fetches and owns the
 * data and is the only file that talks to the backend. The pieces in
 * ./workorders only draw and report clicks back up. Several of them
 * (board, task flow, summary, cost estimate, archive) are reused by the
 * Technician Jr work-orders page.
 *
 * Fixes over the old page:
 *   - backend data only; the old page merged it with a localStorage mock
 *   - `details` is always sent as {...wo.details, <change>}, because the
 *     backend replaces the whole details object on PATCH — the old page
 *     rebuilt it by hand and silently dropped any field it forgot
 *   - a rejected order is recognised from the data (New, nobody assigned)
 *     rather than from a flag that only existed in one browser
 *
 * Data comes from the Redux store, refreshed every 30 seconds by useLiveData.
 * Saves update the store in place, so nothing is reloaded after them.
 */
import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useLiveData } from "../../store/useLiveData";
import { fetchUsers, selectAllUsers } from "../../store/slices/usersSlice";
import {
  closeWorkOrder,
  createWorkOrderFromRequest,
  fetchWorkOrders,
  selectAllWorkOrders,
  updateWorkOrder as updateWorkOrderThunk,
} from "../../store/slices/workOrdersSlice";
import {
  fetchServiceRequests,
  selectAllServiceRequests,
} from "../../store/slices/serviceRequestsSlice";
import { fetchFaults } from "../../store/slices/faultsSlice";

import Modal from "./components/Modal";
import { useToast } from "../../ui/useToast";
import ServiceRequestPanel from "./workorders/ServiceRequestPanel";
import NewWorkOrderForm from "./workorders/NewWorkOrderForm";
import WorkOrderBoard from "./workorders/WorkOrderBoard";
import CostEstimateCard from "./workorders/CostEstimateCard";
import TaskFlow from "./workorders/TaskFlow";
import SummaryCard from "./workorders/SummaryCard";
import OperationalCheck from "./workorders/OperationalCheck";
import ArchiveTable from "./workorders/ArchiveTable";
import { capitalize, formatId } from "./techUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/shared/tech_work_orders.css";
import "./technician.css";

// Faults are only needed so closing a repair order can resolve its fault.
const LOADS = [fetchUsers, fetchWorkOrders, fetchServiceRequests, fetchFaults];

// Used as busyId while the New Work Order form is being sent, since that
// order has no id yet.
const CREATING = "creating";

export default function TechnicianWorkOrders() {
  const { user } = useAuth();
  const showToast = useToast();
  const dispatch = useDispatch();

  const users = useSelector(selectAllUsers);
  const workOrders = useSelector(selectAllWorkOrders);
  const serviceRequests = useSelector(selectAllServiceRequests);
  const { loading, error, reload } = useLiveData(LOADS);

  // The work order the user clicked on the board (null = none clicked yet).
  // A link from the Overview (?wo=<id>) opens that job first.
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get("wo"));

  // The work order whose request is running (or CREATING).
  const [busyId, setBusyId] = useState(null);

  // The work order waiting for "Are you sure?" before closing (null = no popup).
  const [confirmCloseId, setConfirmCloseId] = useState(null);

  // The service request the New Work Order form is filled from (null = none).
  const [triageSrId, setTriageSrId] = useState(null);

  // A handle on the form's box on the page, so we can scroll to it.
  const formRef = useRef(null);

  // ── Actions ──────────────────────────────────────────

  /** "Create Work Order →" on a service request. */
  function startFromRequest(id) {
    setTriageSrId(id);
    // Bring the form into view. formRef.current is the real <div> element.
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function createWorkOrder(values) {
    const body = {
      title: capitalize(values.type) + " maintenance: " + values.asset,
      status: "new",
      priority: values.priority,
      assigned_to_id: values.techId,
      source_request_id: triageSrId,
      details: {
        description: values.asset,
        type: values.type,
        estimateRequired: values.estimateRequired,
      },
    };

    setBusyId(CREATING);
    let ok = false;
    try {
      // The request it came from (if any) moves to in progress.
      await dispatch(
        createWorkOrderFromRequest({ body, requestId: triageSrId }),
      ).unwrap();
      setTriageSrId(null);
      showToast("Work order created.", "success");
      ok = true;
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
    return ok;
  }

  /**
   * PATCH a work order and report the result. Returns true if it worked,
   * so the card that asked can clear its form.
   */
  async function updateWorkOrder(id, body, message) {
    setBusyId(id);
    let ok = false;
    try {
      await dispatch(updateWorkOrderThunk({ id, changes: body })).unwrap();
      showToast(message, "success");
      ok = true;
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
    return ok;
  }

  function submitEstimate(wo, materials) {
    const estimate = {
      materials: materials,
      total: materials,
      type: "repair",
    };
    // {...wo.details, estimate} = everything already in details, plus the
    // estimate. The backend replaces details as a whole, so leaving out the
    // existing fields would delete them.
    return updateWorkOrder(
      wo.work_order_id,
      { status: "approval", details: { ...wo.details, estimate: estimate } },
      "Cost estimate submitted. Waiting for approval.",
    );
  }

  /** For an order assigned to the signed-in user: begin the work. */
  function startWork(wo) {
    return updateWorkOrder(
      wo.work_order_id,
      { status: "inprogress" },
      `Work order ${formatId(wo.work_order_id, "WO")} is now in progress.`,
    );
  }

  function submitForReview(wo, notes) {
    return updateWorkOrder(
      wo.work_order_id,
      {
        status: "review",
        details: { ...wo.details, resolution_notes: notes },
      },
      `Work order ${formatId(wo.work_order_id, "WO")} moved to Review.`,
    );
  }

  function reassign(wo, techId) {
    return updateWorkOrder(
      wo.work_order_id,
      { assigned_to_id: techId, status: "new" },
      "Work order re-assigned.",
    );
  }

  async function closeOrder(id) {
    setBusyId(id);
    try {
      // Also closes its service request and resolves its fault + alert.
      await dispatch(closeWorkOrder(id)).unwrap();
      showToast(
        `Work order ${formatId(id, "WO")} closed and archived.`,
        "success",
      );
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
  }

  function confirmClose() {
    const id = confirmCloseId;
    setConfirmCloseId(null); // close the popup
    closeOrder(id);
  }

  // ── Split the data for each part of the page ─────────
  // A request the system already turned into a job (or still has an open one)
  // is not offered here: Create Work Order would make a second job.
  const hasOpenOrder = (sr) =>
    workOrders.some(
      (wo) => wo.source_request_id === sr.service_request_id && wo.status !== "closed",
    );
  const openRequests = serviceRequests.filter(
    (sr) =>
      (sr.status === "open" || sr.status === "pending") && !hasOpenOrder(sr),
  );
  const openOrders = workOrders.filter((wo) => wo.status !== "closed");
  const closedOrders = workOrders.filter((wo) => wo.status === "closed");

  let triageRequest = serviceRequests.find(
    (sr) => sr.service_request_id === triageSrId,
  );
  if (!triageRequest) {
    triageRequest = null;
  }

  // Which work order the detail panel shows.
  let selected = openOrders.find((wo) => wo.work_order_id === selectedId);
  if (!selected) {
    selected = openOrders[0]; // undefined when the board is empty
  }

  // ── The detail panel ─────────────────────────────────
  let detail;
  if (!selected) {
    detail = (
      <div className="card">
        <h2>Select a work order from the board</h2>
        <div className="empty-state">No open work orders.</div>
      </div>
    );
  } else {
    const id = selected.work_order_id;
    const busy = busyId === id;
    // An order assigned to someone else is theirs to run until Review; the
    // admin only watches. See OperationalCheck for the same rule.
    const mine = selected.assigned_to_id === user?.user_id;

    detail = (
      <div className="card">
        <h2>Selected Work Order — {formatId(id, "WO")}</h2>
        <div className="grid2 mt-16">
          {/* key={id} on the cards with forms: a different order gets
              fresh, empty forms. */}
          <CostEstimateCard
            key={"cost-" + id}
            wo={selected}
            busy={busy}
            canEdit={mine}
            onSubmit={(materials) => submitEstimate(selected, materials)}
          />
          <TaskFlow status={selected.status} />
          <SummaryCard wo={selected} users={users} />
          <OperationalCheck
            key={"check-" + id}
            wo={selected}
            users={users}
            currentUserId={user?.user_id}
            busy={busy}
            onStartWork={() => startWork(selected)}
            onSubmitReview={(notes) => submitForReview(selected, notes)}
            onCloseClick={() => setConfirmCloseId(id)}
            onReassign={(techId) => reassign(selected, techId)}
          />
        </div>
      </div>
    );
  }

  // ── Pick what goes under the header ──────────────────
  let content;
  if (loading) {
    content = <div className="empty-state">Loading…</div>;
  } else if (error) {
    content = (
      <div className="empty-state">
        <p>{error}</p>
        <button type="button" className="btn btn-dark" onClick={reload}>
          Retry
        </button>
      </div>
    );
  } else {
    let selectedOrderId = null;
    if (selected) {
      selectedOrderId = selected.work_order_id;
    }

    let formKey = "blank";
    if (triageRequest) {
      formKey = triageRequest.service_request_id;
    }

    content = (
      <div>
        <ServiceRequestPanel
          requests={openRequests}
          onTriage={startFromRequest}
        />

        <div ref={formRef}>
          <NewWorkOrderForm
            key={formKey}
            users={users}
            request={triageRequest}
            busy={busyId === CREATING}
            onCreate={createWorkOrder}
          />
        </div>

        <div className="card">
          <h2>Open Work Orders Board</h2>
          <small>
            Click any card to inspect and manage in the detail panel below.
          </small>
          <WorkOrderBoard
            workOrders={openOrders}
            users={users}
            selectedId={selectedOrderId}
            onSelect={setSelectedId}
          />
        </div>

        {detail}

        <ArchiveTable workOrders={closedOrders} users={users} />
      </div>
    );
  }

  return (
    <div className="tech-page">
      <div className="wo-header-row">
        <div className="page-header no-margin">
          <h1>Maintenance Work Orders</h1>
          <p>
            Create, assign, update, and close maintenance requests. Status
            changes are saved instantly.
          </p>
        </div>
      </div>

      {content}

      {confirmCloseId !== null && (
        <Modal
          title="Close Work Order"
          confirmLabel="Close Work Order"
          danger
          onConfirm={confirmClose}
          onCancel={() => setConfirmCloseId(null)}
        >
          <p>
            Are you sure you want to close{" "}
            <strong>{formatId(confirmCloseId, "WO")}</strong> and move it to the
            archive?
          </p>
        </Modal>
      )}

    </div>
  );
}
