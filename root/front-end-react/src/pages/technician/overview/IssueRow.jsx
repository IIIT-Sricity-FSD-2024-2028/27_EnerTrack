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
import { initialsOf, leftText, levelLabel, loadText, money } from "./issueStage";

const TEAM_LABEL = { electrician: "Electrician", plumber: "Plumber", general: "General Maintenance", hvac: "HVAC" };

const LEVELS = ["low", "medium", "high", "immediate"];
const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const EVENT_TEXT = {
  assigned: "System picked and sent it to",
  acknowledged: "Accepted by",
  declined: "Declined by",
  missed: "No answer from",
  queued: "Waiting for a person",
  reassigned: "System passed it on to",
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

/**
 * Who can take the job. A job with a team (a plumbing job, say) is offered
 * only to that team, the same rule the server enforces. A job with no team
 * (an "Other" report) is offered to everyone, grouped by team, because the
 * coordinator decides which team it is.
 */
function PersonSelect({ id, row, people, value, onChange }) {
  const team = row.ticket.team;
  const teamName = TEAM_LABEL[team] || team;
  const label = (p) => `${p.name}, ${p.team ? loadText(p) : "no team"}${p.available ? "" : ", unavailable"}`;
  const opt = (p) => (
    <option key={p.user_id} value={p.user_id}>
      {label(p)}
    </option>
  );
  const mine = team ? people.filter((p) => p.team === team) : [];
  const groups = {};
  if (!team) {
    for (const p of people) (groups[p.team || "no team set"] = groups[p.team || "no team set"] || []).push(p);
  }
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{team ? `Choose from the ${teamName} team…` : "Choose a technician…"}</option>
      {team && mine.length === 0 && (
        <option value="" disabled>
          No one is on the {teamName} team
        </option>
      )}
      {mine.map(opt)}
      {Object.entries(groups).map(([name, list]) => (
        <optgroup key={name} label={TEAM_LABEL[name] || name}>
          {list.map(opt)}
        </optgroup>
      ))}
    </select>
  );
}

/** One short line under the status: what is being waited for, in a few words. */
function nextLine(stage, row) {
  switch (stage.key) {
    case "assigned":
      return stage.ackLeft === null ? "Waiting for an answer" : `${stage.ackLeft} min left to accept`;
    case "approval":
      return `${money(row.wo?.details?.estimate?.total)} asked, waiting for Finance`;
    case "sentback":
      return "Technician to send a new estimate";
    case "verify":
      return "Check it and close the job";
    case "queued":
      return row.waitingMin !== null ? `Waiting ${row.waitingMin} min` : "";
    default:
      return "";
  }
}

const dueText = (iso) =>
  new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

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
  const next = nextLine(stage, row);
  const hurry = stage.key === "assigned" && stage.ackLeft !== null && stage.ackLeft <= 3;

  const source = ticket.source_fault_id
    ? "From a monitoring fault"
    : ticket.source_finding
      ? "From an audit recommendation"
      : ticket.source_wastage
        ? "From a wastage report"
        : row.reports > 1
          ? `${row.reports} reports`
          : "";
  const tags = [source, row.plusOnes > 0 ? `${row.plusOnes} more say the same` : ""].filter(Boolean);

  return (
    <li className={`issue level-${row.level}` + (row.needsYou ? " issue-needs" : "") + (done ? " issue-done" : "")}>
      <div className="issue-main">
        <div className="issue-head">
          <span className={"priority-tag priority-" + row.level}>{levelLabel(row.level)}</span>
          {isNew && <span className="badge badge-warning">New</span>}
          {row.reopened && <span className="badge badge-danger">Came back</span>}
        </div>
        <h3 className="issue-title">{row.title}</h3>
        <p className="issue-place">{row.place || "Place not recorded"}</p>
        {tags.length > 0 && (
          <ul className="issue-tags" aria-label="About this issue">
            {tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="issue-state">
        <div className={"holder" + (row.holder ? "" : " holder-none")}>
          <span className="holder-avatar" aria-hidden="true">
            {row.holder ? initialsOf(row.holder.name) : "?"}
          </span>
          <span className="holder-text">
            <strong>{row.holder ? row.holder.name : "Nobody has it yet"}</strong>
            <small>
              {row.holder
                ? TEAM_LABEL[row.holder.team] || "Technician"
                : ticket.team
                  ? `${TEAM_LABEL[ticket.team] || ticket.team} team needed`
                  : "Choose a team"}
            </small>
          </span>
        </div>

        <ProgressRail step={stage.step} stalled={stage.key === "queued"} />

        <div className="issue-status">
          <span className={`status-pill st-${stage.key}`}>
            {row.needsYou && <span className="dot pulse" aria-hidden="true" />}
            {stage.key === "queued" ? "Needs a person" : stage.label}
          </span>
          {next && <span className={"issue-next" + (hurry ? " urgent" : "")}>{next}</span>}
        </div>
      </div>

      <div className="issue-side">
        <button
          type="button"
          className="btn btn-light"
          aria-expanded={open}
          aria-controls={`more-${row.id}`}
          onClick={() => onToggle(row.id)}
        >
          {open ? "Hide details" : "Details"}
        </button>
        {clock && (
          <span className={"issue-due" + (clock.late ? " late" : "")}>
            {clock.paused ? (
              "Clock paused for parts"
            ) : (
              <>
                <span>Due {dueText(clock.deadline)}</span>
                <strong>{leftText(clock.hoursLeft)}</strong>
              </>
            )}
          </span>
        )}
      </div>

      {(stage.key === "queued" || stage.key === "verify") && (
        <div className="issue-act">
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
            <span className="issue-field-row">
              <PersonSelect id={`pick-${row.id}`} row={row} people={people} value={picked} onChange={(v) => onChoice(row.id, v)} />
              <button type="button" className="btn btn-dark" disabled={busy || !picked} onClick={() => onAssign(row.id, picked)}>
                Assign
              </button>
            </span>
          )}
          {stage.key === "verify" && wo && (
            <Link className="btn btn-green" to={`${PATHS.technician.workOrders}?wo=${wo.work_order_id}`}>
              Verify in Work Orders
            </Link>
          )}
        </div>
      )}

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
          {wo?.details?.estimate && (
            <section className="issue-cost">
              <h4>Cost estimate</h4>
              <p className="sub">
                {money(wo.details.estimate.total)} for materials
                {wo.details.estimate.submitted_at ? `, sent ${fmt(wo.details.estimate.submitted_at)}` : ""}.{" "}
                {wo.status === "approval"
                  ? "Waiting for Finance to approve."
                  : wo.details.decision?.result === "sent_back"
                    ? `Finance sent it back${wo.details.decision.by ? ` (${nameOf(wo.details.decision.by)})` : ""}${wo.details.decision.reason ? `: ${wo.details.decision.reason}` : "."}`
                    : "Approved."}
              </p>
            </section>
          )}
          <section>
            <h4>Priority</h4>
            {ticket.priority_override ? (
              <p className="sub">Set by you. The system's own level is {levelLabel(ticket.priority_system)}.</p>
            ) : reasons.length > 0 ? (
              <p className="sub">{reasons.join(". ")}.</p>
            ) : (
              <p className="sub">No reasons recorded.</p>
            )}
            {!done && (
              <select
                id={`prio-${row.id}`}
                aria-label="Priority"
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
            )}
          </section>

          <section>
            <h4>Who has it</h4>
            {history.length === 0 ? (
              <p className="sub">Nothing yet.</p>
            ) : (
              <ol className="timeline">
                {history.map((h, i) => (
                  <li key={i}>
                    <span>
                      {EVENT_TEXT[h.event] || h.event}
                      {h.user_id ? ` ${nameOf(h.user_id)}` : ""}
                      {h.reason ? ` (${REASON_TEXT[h.reason] || h.reason})` : ""}
                    </span>
                    <time>{fmt(h.at)}</time>
                  </li>
                ))}
              </ol>
            )}
            {!done && stage.key !== "queued" && (
              <span className="issue-field-row">
                <PersonSelect id={`move-${row.id}`} row={row} people={people} value={picked} onChange={(v) => onChoice(row.id, v)} />
                <button type="button" className="btn btn-dark" disabled={busy || !picked} onClick={() => onAssign(row.id, picked)}>
                  Give to them
                </button>
              </span>
            )}
          </section>

          <section>
            <h4>Deadline</h4>
            {clock ? (
              <p className="sub">
                Due {fmt(clock.deadline)}, {leftText(clock.hoursLeft)}.
              </p>
            ) : (
              <p className="sub">No deadline set yet.</p>
            )}
            {wo && clock && !done && (
              <span className="issue-field-row">
                <input id={`due-${row.id}`} aria-label="New finish date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
                <button
                  type="button"
                  className="btn btn-dark"
                  disabled={busy || !date}
                  onClick={() => onDeadline(wo.work_order_id, new Date(date).toISOString()).then(() => setDate(""))}
                >
                  Save date
                </button>
              </span>
            )}
            {wo && (
              <Link className="issue-link" to={`${PATHS.technician.workOrders}?wo=${wo.work_order_id}`}>
                Open the work order
              </Link>
            )}
          </section>
        </div>
      )}
    </li>
  );
}
