/**
 * WorkOrders.jsx — My Work Orders (Technician, junior).
 *
 * Ported from front-end/js/technician_jr/workOrdersPage.js.
 *
 * Same shape as the Operations Coordinator's work-order page, and built
 * from its pieces (board, cards, cost estimate, task flow, summary,
 * archive). The differences: only orders assigned to the signed-in
 * technician are shown, and the action panel is the junior's own
 * (Accept / Reject / Submit for Review).
 *
 * Fixes over the old page:
 *   - an order that needs a cost estimate cannot be accepted until the
 *     estimate is approved (the old page let Accept skip Finance)
 *   - resolution notes are saved on Submit for Review (they were dropped)
 *   - "estimate required" means the same as on the admin page, because both
 *     use the same CostEstimateCard
 *
 * Data comes from the Redux store, refreshed every 30 seconds by useLiveData.
 */
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { PATHS } from "../../routes";
import { useAuth } from "../../auth/useAuth";
import { useLiveData } from "../../store/useLiveData";
import { fetchUsers, selectAllUsers } from "../../store/slices/usersSlice";
import {
  fetchWorkOrders,
  selectAllWorkOrders,
  updateWorkOrder as updateWorkOrderThunk,
} from "../../store/slices/workOrdersSlice";
import { jobAction } from "../../store/slices/dispatchSlice";

import { useToast } from "../../ui/useToast";
import WorkOrderBoard from "../technician/workorders/WorkOrderBoard";
import CostEstimateCard from "../technician/workorders/CostEstimateCard";
import TaskFlow from "../technician/workorders/TaskFlow";
import SummaryCard from "../technician/workorders/SummaryCard";
import ArchiveTable from "../technician/workorders/ArchiveTable";
import { formatId } from "../technician/techUtils";
import JrActionPanel from "./JrActionPanel";

import "../../styles/shared/tech_shared.css";
import "../../styles/shared/tech_work_orders.css";
import "../technician/technician.css";
import "./technician-jr.css";

const LOADS = [fetchUsers, fetchWorkOrders];

export default function TechnicianJrWorkOrders() {
  const { user } = useAuth();
  const showToast = useToast();
  const dispatch = useDispatch();

  const users = useSelector(selectAllUsers);
  const workOrders = useSelector(selectAllWorkOrders);
  const { loading, error, reload } = useLiveData(LOADS);

  // The work order clicked on the board (null = none clicked yet). It is
  // kept in the URL as ?wo=<id>, so "Up next" on the Overview can link
  // straight to one order and a refresh keeps the same one open.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("wo");

  function selectOrder(id) {
    // replace: clicking between cards should not fill the Back history.
    setSearchParams({ wo: id }, { replace: true });
  }

  // Arriving from a link with ?wo= means the user wants that order's
  // details, which sit below the board — so scroll to them once loaded.
  const detailRef = useRef(null);
  const linkedOnArrival = useRef(selectedId !== null);

  // The work order whose request is running, so its buttons are disabled.
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!loading && linkedOnArrival.current && detailRef.current) {
      linkedOnArrival.current = false; // only on arrival, not every refresh
      detailRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading]);

  /**
   * PATCH a work order and report the result. Returns true if it worked,
   * so the card that asked can clear its form.
   */
  async function updateWorkOrder(id, body, message, toastType) {
    setBusyId(id);
    let ok = false;
    try {
      await dispatch(updateWorkOrderThunk({ id, changes: body })).unwrap();
      showToast(message, toastType);
      ok = true;
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
    return ok;
  }

  /**
   * A job the system sent goes through the dispatch routes, the same ones
   * the Overview inbox uses, so this page and the inbox never disagree.
   */
  // `message` may be a function of the server's reply, for when the outcome
  // depends on it (a quick waste fix closes instead of going to review).
  async function dispatchAction(id, action, body, message) {
    setBusyId(id);
    let ok = false;
    try {
      // Reloads the work orders and my jobs by itself.
      const result = await dispatch(jobAction({ id, action, body })).unwrap();
      showToast(typeof message === "function" ? message(result) : message, "success");
      ok = true;
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
    return ok;
  }

  // ── The actions ──────────────────────────────────────

  function acceptOrder(wo) {
    if (wo.dispatch) {
      return dispatchAction(wo.work_order_id, "start", {}, "Work started.");
    }
    return updateWorkOrder(
      wo.work_order_id,
      { status: "inprogress" },
      "Task accepted. You can start the work.",
      "success",
    );
  }

  // Nobody assigned + back to New = the admin sees "Requires Re-assignment".
  function rejectOrder(wo) {
    return updateWorkOrder(
      wo.work_order_id,
      { status: "new", assigned_to_id: null },
      "Work order returned to the queue.",
      "info",
    );
  }

  // {...wo.details, estimate} keeps every field already in details — the
  // backend replaces details as a whole on every update.
  function submitEstimate(wo, materials) {
    const estimate = {
      materials: materials,
      total: materials,
      type: "repair",
    };
    return updateWorkOrder(
      wo.work_order_id,
      { status: "approval", details: { ...wo.details, estimate: estimate } },
      "Cost estimate sent. Waiting for the Financial Analyst.",
      "success",
    );
  }

  function submitForReview(wo, notes) {
    if (wo.dispatch) {
      return dispatchAction(
        wo.work_order_id,
        "finish",
        { notes },
        (result) =>
          result?.status === "closed"
            ? `Work order ${formatId(wo.work_order_id, "WO")} is done and closed.`
            : `Work order ${formatId(wo.work_order_id, "WO")} submitted for review.`,
      );
    }
    return updateWorkOrder(
      wo.work_order_id,
      {
        status: "review",
        details: { ...wo.details, resolution_notes: notes },
      },
      `Work order ${formatId(wo.work_order_id, "WO")} submitted for review.`,
      "success",
    );
  }

  // ── Only my work orders ──────────────────────────────
  const mine = workOrders.filter((wo) => wo.assigned_to_id === user?.user_id);
  // A job the system just sent is answered on the Overview (Acknowledge or
  // Decline). It appears here once it has been acknowledged.
  const waitingForAnswer = mine.filter(
    (wo) => wo.dispatch?.ack_status === "pending" && wo.status !== "closed",
  );
  const openOrders = mine.filter(
    (wo) => wo.status !== "closed" && wo.dispatch?.ack_status !== "pending",
  );
  const closedOrders = mine.filter((wo) => wo.status === "closed");

  // Which work order the detail panel shows: the clicked one if it is still
  // mine and open, otherwise the first one (e.g. after rejecting).
  let selected = openOrders.find((wo) => wo.work_order_id === selectedId);
  if (!selected) {
    selected = openOrders[0]; // undefined when my board is empty
  }

  // ── The detail panel ─────────────────────────────────
  let detail;
  if (!selected) {
    detail = (
      <div className="card">
        <h2>Select a work order from the board</h2>
        <div className="empty-state">
          No work orders are assigned to you right now.
        </div>
      </div>
    );
  } else {
    const id = selected.work_order_id;
    const busy = busyId === id;

    detail = (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <h2 style={{ margin: 0 }}>Selected Work Order — {formatId(id, "WO")}</h2>
          {["inprogress", "review"].includes(selected.status) && (
            <Link
              to={`${PATHS.technicianJr.expenses}?wo=${selected.work_order_id}`}
              className="btn btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              Upload Expense Bill
            </Link>
          )}
        </div>
        <div className="grid2 mt-16">
          {/* key={id} on the cards with forms: a different order gets
              fresh, empty forms. */}
          <CostEstimateCard
            key={"cost-" + id}
            wo={selected}
            busy={busy}
            onSubmit={(materials) => submitEstimate(selected, materials)}
          />
          <TaskFlow status={selected.status} />
          <SummaryCard wo={selected} users={users} />
          <JrActionPanel
            key={"action-" + id}
            wo={selected}
            busy={busy}
            onAccept={() => acceptOrder(selected)}
            onReject={() => rejectOrder(selected)}
            onSubmitReview={(notes) => submitForReview(selected, notes)}
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

    content = (
      <div>
        {waitingForAnswer.length > 0 && (
          <div className="callout callout--warning stage-note mb-10">
            {waitingForAnswer.length === 1
              ? "1 new job is waiting for your answer."
              : `${waitingForAnswer.length} new jobs are waiting for your answer.`}{" "}
            <Link to={PATHS.technicianJr.overview}>
              Acknowledge or decline on the Overview
            </Link>
            .
          </div>
        )}
        <div className="card">
          <h2>Open Work Orders Board</h2>
          <small>
            Click any card to inspect and manage in the detail panel below.
          </small>
          <WorkOrderBoard
            workOrders={openOrders}
            users={users}
            selectedId={selectedOrderId}
            onSelect={selectOrder}
          />
        </div>

        <div ref={detailRef}>{detail}</div>

        <ArchiveTable workOrders={closedOrders} users={users} />
      </div>
    );
  }

  return (
    <div className="tech-page">
      <div className="wo-header-row">
        <div className="page-header no-margin">
          <h1>My Work Orders</h1>
          <p>View and manage maintenance requests assigned to you.</p>
        </div>
      </div>

      {content}

    </div>
  );
}
