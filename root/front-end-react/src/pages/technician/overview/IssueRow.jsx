/**
 * IssueRow — one reported issue on the coordinator's Overview.
 *
 * Collapsed it answers "what, where, who has it, how far, by when". Opened,
 * it offers the three things only the coordinator does: pick a person,
 * change the priority, answer a technician's request. Everything about the
 * job itself (cost, status, closing) is on the Work Orders page, linked from
 * here.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { PATHS } from "../../../routes";
import ProgressRail from "./ProgressRail";
import { leftText, levelLabel } from "./issueStage";

const LEVELS = ["low", "medium", "high", "immediate"];
const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const EVENT_TEXT = {
  assigned: "Sent to",
  acknowledged: "Accepted by",
  declined: "Declined by",
  missed: "No answer from",
  queued: "Waiting for a person",
  reassigned: "Moved on from",
  manual: "Placed by the coordinator with",
  started: "Work started by",
  finished: "Work finished by",
  released: "Handed back by",
  closed: "Closed, fixed by",
  closed_with_ticket: "Closed together with the issue, held by",
};

const REASON_TEXT = {
  sick: "unwell",
  on_another_job: "on another job",
  no_tools: "no tools or parts",
  other: "another reason",
};

/** Who can take the job: the ticket's team first, then everyone else. */
function PersonSelect({ id, row, people, value, onChange }) {
  const team = row.ticket.team;
  const mine = people.filter((p) => p.team === team);
  const others = people.filter((p) => p.team !== team);
  const opt = (p) => (
    <option key={p.user_id} value={p.user_id}>
      {p.name}
      {p.team ? ` (${p.team})` : ""}
      {p.available ? "" : ", unavailable"}
    </option>
  );
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a technician…</option>
      {mine.length > 0 && <optgroup label={team ? `${team} team` : "Team"}>{mine.map(opt)}</optgroup>}
      {others.length > 0 && <optgroup label="Other technicians">{others.map(opt)}</optgroup>}
    </select>
  );
}

export default function IssueRow({
  row,
  people,
  users,
  open,
  isNew,
  choice,
  busy,
  onToggle,
  onChoice,
  onAssign,
  onPriority,
  onDecide,
  onDeadline,
}) {
  const { ticket, wo, stage, clock } = row;
  const [date, setDate] = useState("");
  const done = stage.key === "fixed";
  const nameOf = (id) => users.find((u) => u.user_id === id)?.name || "someone";
  const history = wo?.dispatch?.history || [];
  const reasons = ticket.priority_reasons || [];
  const picked = choice[row.id] || "";

  return (
    <li className={"issue" + (row.needsYou ? " issue-needs" : "") + (done ? " issue-done" : "")}>
      <div className="issue-main">
        <div className="issue-head">
          <span className={"priority-tag priority-" + row.level}>{levelLabel(row.level)}</span>
          <strong className="issue-title">{row.title}</strong>
          {isNew && <span className="badge badge-warning">New</span>}
          {row.reopened && <span className="badge badge-danger">Came back</span>}
        </div>
        <p className="issue-place">{row.place || "Place not recorded"}</p>
        <p className="issue-meta">
          {ticket.source_fault_id
            ? "From a monitoring fault"
            : ticket.source_finding
              ? "From an audit recommendation"
              : ticket.source_wastage
                ? "From a wastage report"
                : row.reports === 1
                  ? "1 report"
                  : `${row.reports} reports`}
          {row.plusOnes > 0 ? `, ${row.plusOnes} more say the same` : ""}
          {ticket.team ? `, ${ticket.team}` : ""}
          {" · "}
          {row.technician ? row.technician : "Nobody has it yet"}
        </p>
      </div>

      <div className="issue-progress">
        <ProgressRail step={stage.step} stalled={stage.key === "queued"} />
        <span className="issue-stage">
          {row.needsYou && <span className="dot pulse" aria-hidden="true" />}
          {stage.label}
          {stage.detail ? `. ${stage.detail}` : ""}
          {stage.key === "queued" && row.waitingMin !== null ? ` Waiting ${row.waitingMin} min.` : ""}
        </span>
        {clock && (
          <span className={"issue-clock" + (clock.late ? " late" : "")}>
            {clock.paused ? "Clock paused for parts" : `Finish by ${fmt(clock.deadline)}, ${leftText(clock.hoursLeft)}`}
          </span>
        )}
      </div>

      <div className="issue-actions">
        {stage.key === "queued" && row.suggested && (
          <button
            type="button"
            className="btn btn-green"
            disabled={busy}
            title="The person the system would pick right now"
            onClick={() => onAssign(row.id, row.suggested.user_id)}
          >
            Assign {row.suggested.name}
          </button>
        )}
        {stage.key === "queued" && (
          <>
            <PersonSelect id={`pick-${row.id}`} row={row} people={people} value={picked} onChange={(v) => onChoice(row.id, v)} />
            <button
              type="button"
              className="btn btn-dark"
              disabled={busy || !picked}
              onClick={() => onAssign(row.id, picked)}
            >
              Assign
            </button>
          </>
        )}
        {stage.key === "verify" && wo && (
          <Link className="btn btn-green" to={`${PATHS.technician.workOrders}?wo=${wo.work_order_id}`}>
            Verify in Work Orders
          </Link>
        )}
        <button
          type="button"
          className="btn btn-light"
          aria-expanded={open}
          aria-controls={`more-${row.id}`}
          onClick={() => onToggle(row.id)}
        >
          {open ? "Hide details" : "Details"}
        </button>
      </div>

      {clock?.request && (
        <div className="issue-request">
          <span>
            {nameOf(wo.assigned_to_id)} asks for{" "}
            {clock.request.kind === "parts"
              ? `about ${clock.request.parts_days} days to wait for parts`
              : `more time until ${fmt(clock.request.new_deadline_at)}. ${clock.request.reason}`}
            . The clock keeps running until you answer.
          </span>
          <span className="issue-request-btns">
            <button type="button" className="btn btn-green" disabled={busy} onClick={() => onDecide(wo.work_order_id, true)}>
              Approve
            </button>
            <button type="button" className="btn btn-light" disabled={busy} onClick={() => onDecide(wo.work_order_id, false)}>
              Refuse
            </button>
          </span>
        </div>
      )}

      {open && (
        <div className="issue-more" id={`more-${row.id}`}>
          <div>
            <h3>Why this priority</h3>
            {ticket.priority_override ? (
              <p className="sub">
                Set by you. The system's own level is {levelLabel(ticket.priority_system)}.
              </p>
            ) : null}
            {reasons.length === 0 ? (
              <p className="sub">No reasons recorded.</p>
            ) : (
              <ul className="issue-list">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            {!done && (
              <div className="issue-field">
                <label htmlFor={`prio-${row.id}`}>Priority</label>
                <select
                  id={`prio-${row.id}`}
                  value={ticket.priority_override || ""}
                  disabled={busy}
                  onChange={(e) => onPriority(row.id, e.target.value || null)}
                >
                  <option value="">Use the system level ({levelLabel(ticket.priority_system || ticket.priority)})</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {levelLabel(l)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <h3>What happened so far</h3>
            {history.length === 0 ? (
              <p className="sub">Nothing yet.</p>
            ) : (
              <ul className="issue-list">
                {history.map((h, i) => (
                  <li key={i}>
                    {fmt(h.at)}: {EVENT_TEXT[h.event] || h.event}
                    {h.user_id ? ` ${nameOf(h.user_id)}` : ""}
                    {h.reason ? ` (${REASON_TEXT[h.reason] || h.reason})` : ""}
                  </li>
                ))}
              </ul>
            )}
            {!done && stage.key !== "queued" && (
              <div className="issue-field">
                <label htmlFor={`move-${row.id}`}>Give it to someone else</label>
                <span className="issue-field-row">
                  <PersonSelect id={`move-${row.id}`} row={row} people={people} value={picked} onChange={(v) => onChoice(row.id, v)} />
                  <button type="button" className="btn btn-dark" disabled={busy || !picked} onClick={() => onAssign(row.id, picked)}>
                    Reassign
                  </button>
                </span>
              </div>
            )}
            {wo && clock && !done && (
              <div className="issue-field">
                <label htmlFor={`due-${row.id}`}>Change the finish date</label>
                <span className="issue-field-row">
                  <input id={`due-${row.id}`} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
                  <button
                    type="button"
                    className="btn btn-dark"
                    disabled={busy || !date}
                    onClick={() => onDeadline(wo.work_order_id, new Date(date).toISOString()).then(() => setDate(""))}
                  >
                    Save date
                  </button>
                </span>
              </div>
            )}
            {wo && (
              <Link className="issue-link" to={`${PATHS.technician.workOrders}?wo=${wo.work_order_id}`}>
                Open the work order
              </Link>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
