/**
 * WorkOrders.jsx — My Work Orders (Technician, junior).
 *
 * Ported from front-end/js/technician_jr/workOrdersPage.js.
 *
 * Same shape as the Technician Administrator's work-order page, and built
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
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";

import ToastStack from "../technician/components/ToastStack";
import { useToast } from "../technician/components/useToast";
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

/**
 * Gets every list the page needs. Only fetches — it does not touch React
 * state, so it lives outside the component.
 */
async function fetchWorkOrders() {
  const users = await api.get("/users");
  const workOrders = await api.get("/work-orders");
  return {
    users: users || [],
    workOrders: workOrders || [],
  };
}

export default function TechnicianJrWorkOrders() {
  const { user } = useAuth();
  const { toasts, showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The work order clicked on the board (null = none clicked yet).
  const [selectedId, setSelectedId] = useState(null);

  // The work order whose request is running, so its buttons are disabled.
  const [busyId, setBusyId] = useState(null);

  // Same pattern as the Technician Administrator pages: setState only
  // inside the .then / .catch callbacks (the lint rules require it).
  function loadData() {
    return fetchWorkOrders()
      .then((result) => {
        setError("");
        setUsers(result.users);
        setWorkOrders(result.workOrders);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  // Load when the page opens, then refresh every 30 seconds.
  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  /**
   * PATCH a work order and report the result. Returns true if it worked,
   * so the card that asked can clear its form.
   */
  async function updateWorkOrder(id, body, message, toastType) {
    setBusyId(id);
    let ok = false;
    try {
      await api.patch(`/work-orders/${id}`, body);
      showToast(message, toastType);
      await loadData();
      ok = true;
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
    return ok;
  }

  // ── The four actions ─────────────────────────────────

  function acceptOrder(wo) {
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
  function submitEstimate(wo, materials, labor) {
    const estimate = {
      materials: materials,
      labor: labor,
      total: materials + labor,
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
  const openOrders = mine.filter((wo) => wo.status !== "closed");
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
        <h2>Selected Work Order — {formatId(id, "WO")}</h2>
        <div className="grid2 mt-16">
          {/* key={id} on the cards with forms: a different order gets
              fresh, empty forms. */}
          <CostEstimateCard
            key={"cost-" + id}
            wo={selected}
            busy={busy}
            onSubmit={(materials, labor) =>
              submitEstimate(selected, materials, labor)
            }
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
        <button type="button" className="btn btn-dark" onClick={loadData}>
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
          <h1>My Work Orders</h1>
          <p>View and manage maintenance requests assigned to you.</p>
        </div>
      </div>

      {content}

      <ToastStack toasts={toasts} />
    </div>
  );
}
