/**
 * Overview.jsx — Technician (junior) landing page.
 *
 * Ported from front-end/js/technician_jr/overviewPage.js.
 *
 * Shows only the work orders assigned to the signed-in technician: four
 * counts and an "Up next" list of their most urgent unfinished orders.
 * Every row links to My Work Orders, where the actual work is done.
 *
 * Reuses the Technician Administrator's StatCard, icons, helpers and
 * technician.css, so both roles look the same.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { PATHS } from "../../routes";

import StatCard from "../technician/components/StatCard";
import {
  BellIcon,
  CheckIcon,
  ClipboardIcon,
  PersonIcon,
} from "../technician/components/icons";
import { capitalize, firstName, formatId } from "../technician/techUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/shared/tech_work_orders.css";
import "../../styles/technician/tech_overview.css";
import "../../styles/technician_jr/tech_jr_overview.css";
import "../technician/technician.css";

// Most urgent first, for the "Up next" list.
const PRIORITY_RANK = { immediate: 0, high: 1, medium: 2, low: 3 };

/**
 * Gets every work order. Only fetches — it does not touch React state, so
 * it lives outside the component.
 */
async function fetchWorkOrders() {
  const workOrders = await api.get("/work-orders");
  return workOrders || [];
}

export default function TechnicianJrOverview() {
  const { user } = useAuth();

  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Same pattern as the Technician Administrator pages: setState only
  // inside the .then / .catch callbacks (the lint rules require it).
  function loadData() {
    return fetchWorkOrders()
      .then((list) => {
        setError("");
        setWorkOrders(list);
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

  // ── Only my work orders ──────────────────────────────
  const mine = workOrders.filter((wo) => wo.assigned_to_id === user?.user_id);

  const open = mine.filter((wo) => wo.status === "new");
  const highPriority = open.filter(
    (wo) => wo.priority === "high" || wo.priority === "immediate",
  );
  // Waiting for Finance to approve the cost counts as in progress: the
  // technician has done their part.
  const inProgress = mine.filter(
    (wo) => wo.status === "inprogress" || wo.status === "approval",
  );
  const awaitingApproval = mine.filter((wo) => wo.status === "approval");
  const inReview = mine.filter((wo) => wo.status === "review");
  const closed = mine.filter((wo) => wo.status === "closed");

  // ── Up next: unfinished, most urgent first, top six ──
  // .filter() makes a new list, so sorting it does not touch state.
  const upNext = mine.filter((wo) => wo.status !== "closed");
  upNext.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const topSix = upNext.slice(0, 6);

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
        <div className="stats-grid">
          <StatCard
            icon={<BellIcon />}
            tone="yellow"
            label="My Open Work Orders"
            value={open.length}
            note={highPriority.length + " high priority"}
          />
          <StatCard
            icon={<ClipboardIcon />}
            tone="green"
            label="In Progress"
            value={inProgress.length}
            note={awaitingApproval.length + " awaiting cost approval"}
          />
          <StatCard
            icon={<PersonIcon />}
            tone="yellow"
            label="Awaiting Review"
            value={inReview.length}
            note="Waiting on Technician Administrator"
          />
          <StatCard
            icon={<CheckIcon />}
            tone="green"
            label="Closed Work Orders"
            value={closed.length}
            note={mine.length + " total assigned"}
          />
        </div>

        <div className="card">
          <div className="feed-header">
            <div>
              <h2>Up next</h2>
              <small>Your highest-priority open work orders.</small>
            </div>
          </div>

          {topSix.length === 0 && (
            <div className="empty-state">Nothing on your board right now.</div>
          )}

          {topSix.map((wo) => (
            <Link
              key={wo.work_order_id}
              to={PATHS.technicianJr.workOrders}
              className="up-next-item"
            >
              <span className="up-next-id">
                {formatId(wo.work_order_id, "WO")}
              </span>
              <span className="up-next-title">{wo.title}</span>
              <span className={"priority-tag priority-" + wo.priority}>
                {capitalize(wo.priority)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="tech-page">
      <div className="page-header">
        <h1>Welcome back, {firstName(user?.name)}</h1>
        <p>Here&apos;s what&apos;s on your board today.</p>
      </div>

      {content}
    </div>
  );
}
