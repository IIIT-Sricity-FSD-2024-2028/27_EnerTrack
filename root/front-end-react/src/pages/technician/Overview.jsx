/**
 * Overview.jsx — Operations Coordinator landing page.
 *
 * Every reported issue shows up here as it is raised, with how far it has
 * come and the few things only the coordinator does: pick a person, change
 * the priority, answer a technician's request. The job itself (cost estimate,
 * status board, verify and close) stays on the Work Orders page; each issue
 * links there instead of repeating it.
 *
 * This component owns all the data: it loads the lists, keeps them in state
 * and hands them down. The row list is worked out on every render from those
 * lists (buildRows), so it always matches what was loaded.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";

import StatCard from "./components/StatCard";
import ToastStack from "./components/ToastStack";
import { useToast } from "./components/useToast";
import { BellIcon, CheckIcon, ClipboardIcon, WarningIcon } from "./components/icons";
import NeedsYou from "./overview/NeedsYou";
import IssueBoard from "./overview/IssueBoard";
import TeamPanel from "./overview/TeamPanel";
import { buildRows } from "./overview/issueStage";
import { faultsAwaitingDiagnosis, firstName, userName } from "./techUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/shared/tech_work_orders.css";
import "../../styles/technician/tech_overview.css";
import "./technician.css";

const SEEN_KEY = "enertrack.coordinator.lastSeen";

/** When the coordinator last had this page open, for the "New" marker. Null if unknown. */
function readLastSeen() {
  try {
    const v = Number(window.localStorage.getItem(SEEN_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeLastSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // Private window or blocked storage: the page works without it.
  }
}

/** Only fetches; it does not touch React state. */
async function fetchOverview() {
  const [alerts, faults, workOrders, tickets, users, buildings, queue, catalogue] = await Promise.all([
    api.get("/alerts"),
    api.get("/faults"),
    api.get("/work-orders"),
    api.get("/service-requests"),
    api.get("/users"),
    api.get("/buildings"),
    api.get("/dispatch/queue"),
    api.get("/service-requests/catalogue"),
  ]);
  return {
    alerts: alerts || [],
    faults: faults || [],
    workOrders: workOrders || [],
    tickets: tickets || [],
    users: users || [],
    buildings: buildings || [],
    queue: queue || { queued: [], team_status: [] },
    catalogue: catalogue || null,
  };
}

export default function TechnicianOverview() {
  const { user } = useAuth();
  const { toasts, showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  // Read once when the page opens; the marker stays put while the page is open.
  const [lastSeen] = useState(readLastSeen);

  // setState sits inside the .then/.catch callbacks on purpose: lint
  // (react-hooks/set-state-in-effect) allows that, but not a direct call
  // from the effect.
  const loadData = useCallback(
    () =>
      fetchOverview()
        .then((result) => {
          setError("");
          setData(result);
          setUpdatedAt(new Date());
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        }),
    [],
  );

  // Load when the page opens, then every 30 seconds so new reports and
  // technician answers show up without a refresh.
  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => {
      clearInterval(timer);
      writeLastSeen();
    };
  }, [loadData]);

  async function act(fn, done) {
    setBusy(true);
    try {
      await fn();
      showToast(done, "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusy(false);
  }

  const assign = (ticketId, userId) =>
    act(
      () => api.post(`/dispatch/tickets/${ticketId}/assign`, { user_id: userId }),
      `Assigned to ${userName(data.users, userId)}.`,
    );

  // null = go back to the system's own level.
  const setPriority = (ticketId, level) =>
    act(
      () => api.put(`/service-requests/${ticketId}/priority`, { level }),
      level ? "Priority changed." : "Back to the system's priority.",
    );

  const setDeadline = (workOrderId, iso) =>
    act(() => api.put(`/dispatch/work-orders/${workOrderId}/deadline`, { deadline_at: iso }), "Finish date changed.");

  const sweepNow = () => act(() => api.post("/dispatch/sweep", {}), "Timeouts checked.");

  const decide = (workOrderId, approve) =>
    act(
      () => api.post(`/dispatch/work-orders/${workOrderId}/extension/decide`, { approve }),
      approve ? "Request approved." : "Request refused.",
    );

  const rows = useMemo(
    () =>
      data
        ? buildRows({
            tickets: data.tickets,
            workOrders: data.workOrders,
            queued: data.queue.queued || [],
            buildings: data.buildings,
            catalogue: data.catalogue,
            users: data.users,
          })
        : [],
    [data],
  );

  let content;
  if (loading) {
    content = <div className="empty-state">Loading…</div>;
  } else if (error && !data) {
    content = (
      <div className="empty-state">
        <p>{error}</p>
        <button type="button" className="btn btn-dark" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  } else {
    const open = rows.filter((r) => r.stage.key !== "fixed");
    const counts = {
      queued: open.filter((r) => r.stage.key === "queued").length,
      requests: open.filter((r) => r.clock?.request).length,
      unsafe: open.filter((r) => r.clock?.unsafe).length,
      late: open.filter((r) => r.clock?.late).length,
      verify: data.workOrders.filter((w) => w.status === "review").length,
    };

    // Numbers for the slim stats row.
    const openAlerts = data.alerts.filter((a) => a.status !== "resolved");
    const acknowledged = openAlerts.filter((a) => a.status === "acknowledged");
    const openFaults = faultsAwaitingDiagnosis(data.faults, data.workOrders);
    const unresolvedFaults = data.faults.filter((f) => f.status !== "resolved");
    const pending = data.workOrders.filter((w) => w.status !== "closed");
    const urgent = pending.filter((w) => w.priority === "high" || w.priority === "immediate");
    const closed = data.workOrders.filter((w) => w.status === "closed");

    content = (
      <div>
        {error && <p className="sub issue-error">Could not refresh: {error}</p>}

        <NeedsYou counts={counts} filter={filter} onFilter={setFilter} />

        <IssueBoard
          rows={rows}
          people={data.queue.team_status || []}
          users={data.users}
          filter={filter}
          onFilter={setFilter}
          lastSeen={lastSeen}
          busy={busy}
          onAssign={assign}
          onPriority={setPriority}
          onDecide={decide}
          onDeadline={setDeadline}
        />

        <TeamPanel queue={data.queue} busy={busy} onSweep={sweepNow} />

        <h2 className="section-title stats-title">Around the campus</h2>
        <div className="stats-grid">
          <StatCard
            icon={<BellIcon />}
            tone="yellow"
            label="Active Alerts"
            value={openAlerts.length}
            note={acknowledged.length + " acknowledged, " + (openAlerts.length - acknowledged.length) + " unread"}
          />
          <StatCard
            icon={<WarningIcon />}
            tone="red"
            label="Open Faults"
            value={openFaults.length}
            note={unresolvedFaults.length - openFaults.length + " handed to work orders"}
          />
          <StatCard
            icon={<ClipboardIcon />}
            tone="green"
            label="Pending Work Orders"
            value={pending.length}
            note={urgent.length + " high priority"}
          />
          <StatCard
            icon={<CheckIcon />}
            tone="green"
            label="Closed Work Orders"
            value={closed.length}
            note={data.workOrders.length + (data.workOrders.length === 1 ? " total work order" : " total work orders")}
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
            Every reported issue lands here. See who has it and how far it has
            come, and step in where the system could not decide.
          </p>
        </div>
        {updatedAt && (
          <span className="header-badge">
            <span className="dot pulse" aria-hidden="true" />
            Updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {content}

      <ToastStack toasts={toasts} />
    </div>
  );
}
