/**
 * Overview.jsx — Technician Administrator landing page.
 *
 * Ported from front-end/js/technician/overviewPage.js.
 *
 * This component owns all the data: it fetches the lists, keeps them
 * in state, and hands them down as props. StatCard and VerifyFeed only
 * render what they are given, so after a verify there is exactly one thing
 * to refresh — loadData().
 *
 * The stat numbers are worked out on every render instead of being kept in
 * state, so they always match the lists they are counted from.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";

import StatCard from "./components/StatCard";
import ToastStack from "./components/ToastStack";
import { useToast } from "./components/useToast";
import {
  BellIcon,
  CheckIcon,
  ClipboardIcon,
  WarningIcon,
} from "./components/icons";
import VerifyFeed from "./overview/VerifyFeed";
import { closeWorkOrder } from "./workorders/closeWorkOrder";
import { faultsAwaitingDiagnosis, firstName } from "./techUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/technician/tech_overview.css";
import "./technician.css";

/**
 * Gets the lists the page needs. Only fetches — it does not touch React
 * state, so it lives outside the component.
 */
async function fetchOverview() {
  const alerts = await api.get("/alerts");
  const faults = await api.get("/faults");
  const workOrders = await api.get("/work-orders");
  // Closing a work order also closes the request it came from.
  const serviceRequests = await api.get("/service-requests");
  // Only for the technician's name on each item awaiting verification.
  const users = await api.get("/users");

  return {
    alerts: alerts || [],
    faults: faults || [],
    workOrders: workOrders || [],
    serviceRequests: serviceRequests || [],
    users: users || [],
  };
}

export default function TechnicianOverview() {
  const { user } = useAuth();
  const { toasts, showToast } = useToast();

  // The four lists from the backend. Each starts as an empty list so
  // .filter() below never runs on undefined.
  const [alerts, setAlerts] = useState([]);
  const [faults, setFaults] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The id of the item being verified, so its button is disabled until the
  // request finishes and a double click cannot send two PATCHes.
  const [busyId, setBusyId] = useState(null);

  // Fetch, then save into state. The setState calls sit inside the .then /
  // .catch callbacks on purpose: lint (react-hooks/set-state-in-effect)
  // rejects a function called from useEffect that sets state directly, but
  // allows it in a callback that runs later, once the data has arrived.
  function loadData() {
    return fetchOverview()
      .then((result) => {
        setError("");
        setAlerts(result.alerts);
        setFaults(result.faults);
        setWorkOrders(result.workOrders);
        setServiceRequests(result.serviceRequests);
        setUsers(result.users);
        setLoading(false);
      })
      .catch((err) => {
        // client.js already turns a dead backend into a plain
        // "Can't reach the backend" message
        setError(err.message);
        setLoading(false);
      });
  }

  // Load when the page opens, then refresh every 30 seconds so changes made
  // by other users show up. The cleanup stops the timer when we leave.
  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  async function verifyWorkOrder(id) {
    const wo = workOrders.find((w) => w.work_order_id === id);
    if (!wo) {
      return;
    }
    setBusyId(id);
    try {
      // Same function as "Close & Archive" on the Work Orders page, so both
      // also close the service request and resolve the fault + alert.
      await closeWorkOrder(wo, faults, serviceRequests);
      showToast("Work order verified and closed.", "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
  }

  // ── Numbers for the stat cards ───────────────────────
  const openAlerts = alerts.filter((a) => a.status !== "resolved");
  const acknowledgedAlerts = openAlerts.filter(
    (a) => a.status === "acknowledged",
  );
  const unreadAlertCount = openAlerts.length - acknowledgedAlerts.length;

  // "Open" = still needs diagnosing. Same function as the Diagnostics page,
  // so the two always agree. Unresolved faults that were already flagged
  // are counted separately as "handed to work orders".
  const openFaults = faultsAwaitingDiagnosis(faults, workOrders);
  const unresolvedFaults = faults.filter((f) => f.status !== "resolved");
  const handedOffCount = unresolvedFaults.length - openFaults.length;

  const pendingWOs = workOrders.filter((w) => w.status !== "closed");
  const highPriorityWOs = pendingWOs.filter(
    (w) => w.priority === "high" || w.priority === "immediate",
  );
  const closedWOs = workOrders.filter((w) => w.status === "closed");

  let totalWOsNote = workOrders.length + " total work orders";
  if (workOrders.length === 1) {
    totalWOsNote = "1 total work order";
  }

  // ── Items waiting for the supervisor to check ────────
  // A service request is never verified on its own: the work order made
  // from it is, and closing that order closes the request too.
  const wosToVerify = workOrders.filter((wo) => wo.status === "review");

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
    content = (
      <div>
        <div className="card verify-card">
          <div className="feed-header">
            <div>
              <h2>Final Verification</h2>
              <small>
                Confirm completed jobs before authorizing financial processing.
              </small>
            </div>
          </div>
          <VerifyFeed
            workOrders={wosToVerify}
            users={users}
            busyId={busyId}
            onVerifyWorkOrder={verifyWorkOrder}
          />
        </div>

        <div className="stats-grid">
          <StatCard
            icon={<BellIcon />}
            tone="yellow"
            label="Active Alerts"
            value={openAlerts.length}
            note={
              acknowledgedAlerts.length +
              " acknowledged, " +
              unreadAlertCount +
              " unread"
            }
          />
          <StatCard
            icon={<WarningIcon />}
            tone="red"
            label="Open Faults"
            value={openFaults.length}
            note={handedOffCount + " handed to work orders"}
          />
          <StatCard
            icon={<ClipboardIcon />}
            tone="green"
            label="Pending Work Orders"
            value={pendingWOs.length}
            note={highPriorityWOs.length + " high priority"}
          />
          <StatCard
            icon={<CheckIcon />}
            tone="green"
            label="Closed Work Orders"
            value={closedWOs.length}
            note={totalWOsNote}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tech-page">
      <div className="header-row">
        <div className="page-header">
          <h1>Welcome back, {firstName(user?.name)}</h1>
          <p>
            Monitor active field conditions, review the latest anomalies and
            faults, and jump directly into technician workflows that need
            action.
          </p>
        </div>
      </div>

      {content}

      <ToastStack toasts={toasts} />
    </div>
  );
}
