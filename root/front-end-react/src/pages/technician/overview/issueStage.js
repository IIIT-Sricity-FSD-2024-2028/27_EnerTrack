/**
 * issueStage.js — turns a reported issue (a service request) and the work
 * order made from it into one row for the coordinator's Overview.
 *
 * Pure functions only: no fetching, no React. The Overview passes in the
 * lists it loaded and gets back plain rows to draw.
 *
 * The Overview is about ISSUES (what was reported, who has it, how far it
 * is). Cost estimates, the status board and closing a job stay on the Work
 * Orders page; each row just links there.
 */

/** The six steps of the progress rail, in order. */
export const STEPS = ["Reported", "Assigned", "Accepted", "Working", "Review", "Fixed"];

const LEVEL_RANK = { immediate: 0, high: 1, medium: 2, low: 3 };
const CLOSED = ["closed", "resolved", "completed"];

export const QUEUE_REASON = {
  other_report: "An “Other” report. Choose the team.",
  no_one_available: "No one on the team is free.",
  all_declined: "Everyone declined or is unavailable.",
  manual: "Waiting for a person.",
};

export const levelLabel = (level) =>
  level === "immediate" ? "Critical" : level ? level[0].toUpperCase() + level.slice(1) : "Low";

const isClosed = (status) => CLOSED.includes(String(status || "").toLowerCase());

/** The work order made from a ticket: an open one if there is one, else the latest. */
export function workOrderOf(ticket, workOrders) {
  const mine = workOrders.filter((w) => w.source_request_id === ticket.service_request_id);
  return mine.find((w) => w.status !== "closed") || mine[mine.length - 1] || null;
}

/** "Block A, floor 3, corridor, near lift": the same wording students see. */
export function placeOf(ticket, buildings, catalogue) {
  const building = buildings.find((b) => b.building_id === ticket.building_id)?.name;
  const floor = ticket.floor;
  const area = catalogue?.areas?.find((a) => a.id === ticket.area)?.label;
  const part =
    catalogue?.parts?.[ticket.area]?.find((p) => p.id === ticket.part)?.label || ticket.part;
  const floorText =
    floor === "whole_building"
      ? null
      : floor === "outside"
        ? "outside"
        : /^\d+$/.test(floor || "")
          ? `floor ${floor}`
          : floor
            ? catalogue?.floors?.find((f) => f.id === floor)?.label || floor
            : null;
  const areaText = floor === "whole_building" || floor === "outside" ? null : area?.toLowerCase();
  return [building, floorText, areaText, part].filter(Boolean).join(", ");
}

/**
 * Where the issue stands. `step` is an index into STEPS; `needsYou` is true
 * when only the coordinator can move it on.
 */
export function stageOf(ticket, wo, now = Date.now()) {
  if (isClosed(ticket.status) || wo?.status === "closed") {
    return { step: 5, label: "Fixed", needsYou: false, key: "fixed" };
  }
  if (!wo || ticket.dispatch_state === "queued" || !wo.assigned_to_id) {
    return {
      step: 0,
      label: "Waiting for a person",
      detail: QUEUE_REASON[ticket.queued_reason] || QUEUE_REASON.manual,
      needsYou: true,
      key: "queued",
    };
  }
  if (wo.status === "review") {
    return { step: 4, label: "Ready to verify", needsYou: true, key: "verify" };
  }
  if (wo.status === "inprogress") {
    return { step: 3, label: "Working", needsYou: false, key: "working" };
  }
  if (wo.status === "approval") {
    return { step: 2, label: "Waiting for cost approval", needsYou: false, key: "approval" };
  }
  const d = wo.dispatch;
  if (d?.ack_status === "acknowledged") {
    return { step: 2, label: "Accepted", needsYou: false, key: "accepted" };
  }
  const left = d?.ack_due_at ? Math.max(0, Math.round((new Date(d.ack_due_at) - now) / 60000)) : null;
  return {
    step: 1,
    label: "Assigned",
    detail: left === null ? "" : `${left} min left to accept`,
    needsYou: false,
    key: "assigned",
  };
}

/** Deadline facts for a row, from the stored job clock. */
export function clockOf(wo, now = Date.now()) {
  const sla = wo?.dispatch?.sla;
  if (!sla) return null;
  const deadline = new Date(sla.deadline_at).getTime();
  const paused = !!sla.paused_since;
  const hoursLeft = Math.round(((deadline - now) / 36e5) * 10) / 10;
  return {
    deadline: sla.deadline_at,
    hoursLeft,
    paused,
    late: !!sla.late || (!paused && hoursLeft < 0),
    unsafe: !!sla.safe_by && !sla.made_safe_at && wo.priority === "immediate",
    request: sla.request && sla.request.status === "pending" ? sla.request : null,
    safeBy: sla.safe_by,
  };
}

/** "1 d 3 h left", "5 h left", "2 h overdue". */
export function leftText(hours) {
  const abs = Math.abs(hours);
  const text = abs >= 24 ? `${Math.floor(abs / 24)} d ${Math.round(abs % 24)} h` : `${Math.round(abs)} h`;
  return hours < 0 ? `${text} overdue` : `${text} left`;
}

/**
 * One row per reported issue. Only structured reports (those with an
 * item_id) are listed; older free-text requests stay in the Work Orders
 * service-request panel.
 */
export function buildRows({ tickets, workOrders, queued, buildings, catalogue, users, now = Date.now() }) {
  const waiting = new Map(queued.map((q) => [q.ticket_id, q.waiting_priority]));
  const queueInfo = new Map(queued.map((q) => [q.ticket_id, q]));
  return tickets
    .filter((t) => t.item_id)
    .map((t) => {
      const wo = workOrderOf(t, workOrders);
      const stage = stageOf(t, wo, now);
      const clock = stage.key === "fixed" ? null : clockOf(wo, now);
      const level = waiting.get(t.service_request_id) || t.priority || "low";
      return {
        id: t.service_request_id,
        ticket: t,
        wo,
        stage,
        clock,
        level,
        title: t.issue_type || "Issue",
        place: placeOf(t, buildings, catalogue),
        technician: wo?.assigned_to_id
          ? users.find((u) => u.user_id === wo.assigned_to_id)?.name || "Assigned"
          : null,
        reports: (t.reporter_ids || []).length || 1,
        plusOnes: (t.plus_one_ids || []).length,
        reopened: !!t.reopened_from,
        suggested: queueInfo.get(t.service_request_id)?.suggested || null,
        waitingMin: queueInfo.get(t.service_request_id)?.waiting_min ?? null,
        needsYou: stage.needsYou || !!clock?.request || !!clock?.unsafe,
        fixedThisWeek:
          stage.key === "fixed" &&
          now - new Date(t.closed_at || t.created_at).getTime() < 7 * 24 * 3600 * 1000,
      };
    });
}

/** Needs-you first, then level, then nearest deadline, then oldest. */
export function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.needsYou !== b.needsYou) return a.needsYou ? -1 : 1;
    const l = (LEVEL_RANK[a.level] ?? 3) - (LEVEL_RANK[b.level] ?? 3);
    if (l) return l;
    const da = a.clock ? new Date(a.clock.deadline).getTime() : Infinity;
    const db = b.clock ? new Date(b.clock.deadline).getTime() : Infinity;
    if (da !== db) return da - db;
    return String(a.ticket.created_at).localeCompare(String(b.ticket.created_at));
  });
}

export const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "needs", label: "Needs you", test: (r) => r.needsYou },
  { id: "progress", label: "In progress", test: (r) => ["assigned", "accepted", "approval", "working"].includes(r.stage.key) },
  { id: "late", label: "Late", test: (r) => !!r.clock?.late },
  { id: "critical", label: "Critical", test: (r) => r.level === "immediate" },
  // Opened from the "Needs you" tiles; no chip of their own.
  { id: "queued", hidden: true, test: (r) => r.stage.key === "queued" },
  { id: "requests", hidden: true, test: (r) => !!r.clock?.request },
  { id: "unsafe", hidden: true, test: (r) => !!r.clock?.unsafe },
];
