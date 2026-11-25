/**
 * ReworkRequests — the Sustainability Officer checked a closed initiative job
 * and asked for it to be redone. The coordinator, who runs the technicians,
 * decides: the same technician (default), let the system pick, pick someone,
 * or decline with a note. Every choice except decline sets a finish date.
 * The officer is told the outcome.
 */
import { useState } from "react";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const CHOICES = [
  { value: "same", label: "Same technician" },
  { value: "auto", label: "Let the system pick" },
  { value: "pick", label: "Pick someone" },
  { value: "decline", label: "Decline" },
];

function Request({ req, people, busy, onDecide }) {
  const sameAvailable = !!req.original_technician_id;
  const [decision, setDecision] = useState(sameAvailable ? "same" : "auto");
  const [assignee, setAssignee] = useState("");
  const defaultDate =
    req.target_date && req.target_date >= todayIso() ? req.target_date : "";
  const [finishBy, setFinishBy] = useState(defaultDate);
  const [note, setNote] = useState("");
  const team = people.filter((p) => p.team === req.team);
  const declining = decision === "decline";
  const ready = declining
    ? note.trim().length >= 3
    : !!finishBy && (decision !== "pick" || !!assignee);

  return (
    <li className="rework-item">
      <div className="rework-head">
        <strong>{req.job_title}</strong>
        <small>
          {req.initiative_title}
          {req.original_technician_name
            ? ` · done by ${req.original_technician_name}`
            : ""}
        </small>
      </div>
      <p className="rework-reason">
        {req.requested_by_name || "The officer"} asked: {req.reason}
      </p>
      <div
        className="rework-choices"
        role="radiogroup"
        aria-label="Who redoes it"
      >
        {CHOICES.filter((c) => c.value !== "same" || sameAvailable).map((c) => (
          <label key={c.value}>
            <input
              type="radio"
              name={`rework-${req.ticket_id}`}
              value={c.value}
              checked={decision === c.value}
              onChange={() => setDecision(c.value)}
            />
            {c.value === "same" && req.original_technician_name
              ? `Same technician (${req.original_technician_name})`
              : c.label}
          </label>
        ))}
      </div>
      <div className="rework-fields">
        {decision === "pick" && (
          <select
            aria-label="Technician"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">
              Choose a {req.team_label?.toLowerCase() || "technician"}
            </option>
            {team.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.name}
                {p.available ? "" : " (not available today)"}
              </option>
            ))}
          </select>
        )}
        {declining ? (
          <input
            type="text"
            aria-label="Why not (sent to the officer)"
            placeholder="Why not? (sent to the officer)"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        ) : (
          <label className="rework-date">
            Finish by
            <input
              type="date"
              min={todayIso()}
              value={finishBy}
              onChange={(e) => setFinishBy(e.target.value)}
            />
          </label>
        )}
        <button
          type="button"
          className={declining ? "btn btn-light" : "btn btn-dark"}
          disabled={busy || !ready}
          onClick={() =>
            onDecide(req, {
              decision,
              assigneeId: decision === "pick" ? assignee : undefined,
              finishBy: declining ? undefined : finishBy,
              note: declining ? note.trim() : undefined,
            })
          }
        >
          {declining ? "Decline request" : "Send rework"}
        </button>
      </div>
    </li>
  );
}

export default function ReworkRequests({ requests, people, busy, onDecide }) {
  if (!requests.length) return null;
  return (
    <div className="card" id="rework-requests">
      <div className="feed-header">
        <div>
          <h2>Rework requested</h2>
          <small>
            The Sustainability Officer checked this initiative work and wants it
            redone. Decide who does it and by when, or decline with a note.
          </small>
        </div>
      </div>
      <ul className="rework-list">
        {requests.map((r) => (
          <Request
            key={r.ticket_id}
            req={r}
            people={people}
            busy={busy}
            onDecide={onDecide}
          />
        ))}
      </ul>
    </div>
  );
}
