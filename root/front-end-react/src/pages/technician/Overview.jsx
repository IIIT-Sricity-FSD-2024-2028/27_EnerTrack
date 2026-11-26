/**
 * Overview.jsx — Operations Coordinator landing page.
 *
 * Every reported issue shows up here as it is raised, with how far it has
 * come and the few things only the coordinator does: pick a person, change
 * the priority, answer a technician's request. The job itself (cost estimate,
 * status board, verify and close) stays on the Work Orders page; each issue
 * links there instead of repeating it.
 *
 * The lists come from the Redux store (refreshed every 30 seconds by
 * useLiveData) and are handed down. The row list is worked out from them
 * (buildRows), so it always matches what was loaded.
 */
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../auth/useAuth";
import { useLiveData } from "../../store/useLiveData";
import { fetchAlerts, selectAllAlerts } from "../../store/slices/alertsSlice";
import { fetchFaults, selectAllFaults } from "../../store/slices/faultsSlice";
import {
  fetchWorkOrders,
  selectAllWorkOrders,
} from "../../store/slices/workOrdersSlice";
import {
  fetchServiceCatalogue,
  fetchServiceRequests,
  selectAllServiceRequests,
  selectServiceCatalogue,
  setServiceRequestPriority,
} from "../../store/slices/serviceRequestsSlice";
import { fetchUsers, selectAllUsers } from "../../store/slices/usersSlice";
import {
  fetchBuildings,
  selectAllBuildings,
} from "../../store/slices/buildingsSlice";
import {
  assignTicket,
  backOnDuty,
  decideExtension,
  decideRework,
  fetchDispatchQueue,
  selectDispatchQueue,
  setJobDeadline,
  sweepTimeouts,
} from "../../store/slices/dispatchSlice";

import StatCard from "./components/StatCard";
import { useToast } from "../../ui/useToast";
import { BellIcon, CheckIcon, ClipboardIcon, WarningIcon } from "./components/icons";
import NeedsYou from "./overview/NeedsYou";
import IssueBoard from "./overview/IssueBoard";
import TeamPanel from "./overview/TeamPanel";
import ReworkRequests from "./overview/ReworkRequests";
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

const LOADS = [
  fetchAlerts,
  fetchFaults,
  fetchWorkOrders,
  fetchServiceRequests,
  fetchUsers,
  fetchBuildings,
  fetchDispatchQueue,
  fetchServiceCatalogue,
];

export default function TechnicianOverview() {
  const { user } = useAuth();
  const showToast = useToast();
  const dispatch = useDispatch();

  const alerts = useSelector(selectAllAlerts);
  const faults = useSelector(selectAllFaults);
  const workOrders = useSelector(selectAllWorkOrders);
  const tickets = useSelector(selectAllServiceRequests);
  const users = useSelector(selectAllUsers);
  const buildings = useSelector(selectAllBuildings);
  const queue = useSelector(selectDispatchQueue);
  const catalogue = useSelector(selectServiceCatalogue);

  // Every 30 seconds, so new reports and technician answers show up
  // without a refresh.
  const { loading, ready, error, reload, updatedAt } = useLiveData(LOADS);

  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  // Read once when the page opens; the marker stays put while the page is open.
  const [lastSeen] = useState(readLastSeen);

  // Leaving the page: remember when, for the "New" marker next time.
  useEffect(() => writeLastSeen, []);

  // Each dispatch thunk reloads the lists it changed, so no reload here.
  async function act(thunk, done) {
    setBusy(true);
    try {
      await dispatch(thunk).unwrap();
      showToast(done, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusy(false);
  }

  const assign = (ticketId, userId) =>
    act(
      assignTicket({ ticketId, userId }),
      `Assigned to ${userName(users, userId)}.`,
    );

  // null = go back to the system's own level. The ticket updates in place;
  // the queue is reloaded because its order may change.
  const setPriority = async (ticketId, level) => {
    await act(
      setServiceRequestPriority({ id: ticketId, level }),
      level ? "Priority changed." : "Back to the system's priority.",
    );
    dispatch(fetchDispatchQueue({ force: true }));
  };

  const setDeadline = (workOrderId, iso) =>
    act(
      setJobDeadline({ workOrderId, deadlineAt: iso }),
      "Finish date changed.",
    );

  const sweepNow = () => act(sweepTimeouts(), "Timeouts checked.");

  const decide = (workOrderId, approve) =>
    act(
      decideExtension({ workOrderId, approve }),
      approve ? "Request approved." : "Request refused.",
    );

  const reworkDecision = (req, { decision, assigneeId, finishBy, note }) =>
    act(
      decideRework({ ticketId: req.ticket_id, decision, assigneeId, finishBy, note }),
      decision === "decline" ? "Rework declined. The officer has been told." : "Rework sent. The officer has been told.",
    );

  const putBackOnDuty = (person) =>
    act(backOnDuty({ userId: person.user_id }), `${person.name} is back on duty and can be sent jobs today.`);

  const rows = useMemo(
    () =>
      ready
        ? buildRows({
            tickets,
            workOrders,
            queued: queue.queued || [],
            buildings,
            catalogue,
            users,
          })
        : [],
    [ready, tickets, workOrders, queue, buildings, catalogue, users],
  );

  let content;
  if (loading) {
    content = <div className="empty-state">Loading…</div>;
  } else if (!ready) {
    content = (
      <div className="empty-state">
        <p>{error}</p>
        <button type="button" className="btn btn-dark" onClick={reload}>
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
      verify: workOrders.filter((w) => w.status === "review").length,
      rework: (queue.rework_requests || []).length,
    };

    // Numbers for the slim stats row.
    const openAlerts = alerts.filter((a) => a.status !== "resolved");
    const acknowledged = openAlerts.filter((a) => a.status === "acknowledged");
    const openFaults = faultsAwaitingDiagnosis(faults, workOrders);
    const unresolvedFaults = faults.filter((f) => f.status !== "resolved");
    const pending = workOrders.filter((w) => w.status !== "closed");
    const urgent = pending.filter((w) => w.priority === "high" || w.priority === "immediate");
    const closed = workOrders.filter((w) => w.status === "closed");

    content = (
      <div>
        {error && <p className="sub issue-error">Could not refresh: {error}</p>}

        <NeedsYou counts={counts} filter={filter} onFilter={setFilter} />

        <ReworkRequests
          requests={queue.rework_requests || []}
          people={queue.team_status || []}
          busy={busy}
          onDecide={reworkDecision}
        />

        <IssueBoard
          rows={rows}
          people={queue.team_status || []}
          users={users}
          filter={filter}
          onFilter={setFilter}
          lastSeen={lastSeen}
          busy={busy}
          onAssign={assign}
          onPriority={setPriority}
          onDecide={decide}
          onDeadline={setDeadline}
        />

        <TeamPanel queue={queue} busy={busy} onSweep={sweepNow} onBackOnDuty={putBackOnDuty} />

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
            note={workOrders.length + (workOrders.length === 1 ? " total work order" : " total work orders")}
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

    </div>
  );
}
