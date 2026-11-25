/**
 * DispatchInbox — the technician's side of auto-dispatch.
 *
 * Jobs are PUSHED to one person by the system. There is no list to browse
 * and nothing to pick, so this component only offers three things:
 *   - the "Available today" switch (off = the system sends nothing new
 *     today; locked while the coordinator's "off for today" applies)
 *   - Acknowledge a job that was given to me
 *   - Decline it with a reason (it then moves to the next person)
 *
 * Everything comes from the Redux store (availability, my jobs, messages),
 * refreshed every 30 seconds by useLiveData. Each action (jobAction,
 * setAvailability) reloads my jobs and the work orders by itself, so the
 * rest of the page follows without being told.
 */
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveData } from "../../store/useLiveData";
import {
  fetchAvailability,
  fetchMyJobs,
  jobAction,
  selectAvailability,
  selectMyJobs,
  setAvailability,
} from "../../store/slices/dispatchSlice";
import {
  fetchNotifications,
  selectAllNotifications,
} from "../../store/slices/notificationsSlice";
import { capitalize } from "../technician/techUtils";
import ReopenPhoto from "../technician/components/ReopenPhoto";
import "./technician-jr.css";

const LOADS = [fetchAvailability, fetchMyJobs, fetchNotifications];

const REASONS = [
  { value: "sick", label: "I am unwell today" },
  { value: "on_another_job", label: "I am on another job" },
  { value: "no_tools", label: "I do not have the tools or parts" },
  { value: "other", label: "Another reason" },
];

const OFF_REASON = {
  sick: "you declined a job as unwell",
  missed: "a job was not answered in time",
};

/**
 * "Available today": whether the system may send me new jobs today. Switching
 * off lasts until midnight. Being marked off for today (declined as unwell,
 * or missed answering a job) also lasts until midnight and only the
 * coordinator can undo it, so the switch is locked then. Without a team the
 * system never sends jobs, so there is no switch at all.
 */
function AvailabilitySwitch({ state, busy, acceptedUnstarted, onSet }) {
  if (!state.has_team)
    return (
      <div className="avail avail--none" role="status">
        <strong>No team set.</strong> The system cannot send you jobs until your admin gives you a team.
      </div>
    );

  if (state.off_for_today)
    return (
      <div className="avail avail--amber" role="status">
        <span className="avail-dot" aria-hidden="true" />
        <div className="avail-text">
          <strong>Off for today</strong>
          <small>
            Because {OFF_REASON[state.off_reason] || "you were marked unavailable"}, no new jobs will be sent until
            midnight. If that was a mistake, ask your coordinator to put you back on duty.
          </small>
        </div>
        <button type="button" className="btn btn-light" disabled>
          Locked until midnight
        </button>
      </div>
    );

  const on = state.switched_on;
  function toggle() {
    if (on && acceptedUnstarted.length) {
      const n = acceptedUnstarted.length;
      const ok = window.confirm(
        `You have accepted ${n} job${n === 1 ? "" : "s"} you have not started. Switching off sends ${n === 1 ? "it" : "them"} to someone else, and each counts as a decline. Switch off for today?`,
      );
      if (!ok) return;
    }
    onSet(!on);
  }
  return (
    <div className={`avail ${on ? "avail--on" : "avail--off"}`}>
      <span className="avail-dot" aria-hidden="true" />
      <div className="avail-text">
        <strong>{on ? "Available today" : "Not available today"}</strong>
        <small>
          {on
            ? "The system can send you new jobs."
            : "No new jobs will be sent to you today. You are back on automatically tomorrow."}
        </small>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Available today"
        className={on ? "btn btn-light" : "btn btn-green"}
        disabled={busy}
        onClick={toggle}
      >
        {on ? "Switch off for today" : "Switch on"}
      </button>
    </div>
  );
}

function minutesLeft(dueAt) {
  if (!dueAt) return null;
  return Math.max(0, Math.round((new Date(dueAt).getTime() - Date.now()) / 60000));
}

export default function DispatchInbox() {
  const dispatch = useDispatch();
  const state = useSelector(selectAvailability);
  const jobs = useSelector(selectMyJobs);
  const allMessages = useSelector(selectAllNotifications);
  const messages = allMessages.slice(0, 5);
  const { error: loadError } = useLiveData(LOADS);

  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState("on_another_job");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const error = actionError || loadError;

  /** Runs one action thunk; it reloads what it changed by itself. */
  async function run(thunk) {
    setBusy(true);
    setActionError("");
    try {
      await dispatch(thunk).unwrap();
      setDeclining(null);
    } catch (e) {
      setActionError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  const pending = jobs.filter((j) => j.ack_status === "pending");
  const active = jobs.filter((j) => j.ack_status === "acknowledged" && j.sla);
  // Accepted but not started: switching off hands these to someone else.
  const acceptedUnstarted = jobs.filter((j) => j.ack_status === "acknowledged" && j.status === "new");

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="feed-header">
        <div>
          <h2>New jobs for you</h2>
          <small>
            The system sends each job to one person. Acknowledge it, or decline
            with a reason and it goes to the next.
          </small>
        </div>
      </div>

      {state && (
        <AvailabilitySwitch
          state={state}
          busy={busy}
          acceptedUnstarted={acceptedUnstarted}
          onSet={(on) => run(setAvailability(on)).catch(() => {})}
        />
      )}

      {error && <p className="sub" style={{ color: "#b91c1c" }}>{error}</p>}

      {pending.length === 0 && (
        <div className="empty-state">Nothing waiting for your answer.</div>
      )}

      {pending.map((job) => {
        const left = minutesLeft(job.ack_due_at);
        return (
          <div className="up-next-item" key={job.work_order_id} style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="up-next-title" style={{ flex: 1, minWidth: 220 }}>
              {job.title}
              {job.description ? (
                <small style={{ display: "block", whiteSpace: "pre-line" }}>{job.description}</small>
              ) : null}
              {job.has_reopen_photo && <ReopenPhoto ticketId={job.ticket_id} />}
            </span>
            <span className={"priority-tag priority-" + job.priority}>
              {job.priority === "immediate" ? "Critical" : capitalize(job.priority)}
            </span>
            {left !== null && <small>{left} min to answer</small>}

            {declining === job.work_order_id ? (
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={reason} onChange={(e) => setReason(e.target.value)}>
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-dark"
                  disabled={busy}
                  onClick={() =>
                    run(
                      jobAction({
                        id: job.work_order_id,
                        action: "decline",
                        body: { reason },
                      }),
                    ).catch(() => {})
                  }
                >
                  Confirm decline
                </button>
                <button type="button" className="btn btn-light" onClick={() => setDeclining(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <span style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-green"
                  disabled={busy}
                  onClick={() =>
                    run(
                      jobAction({ id: job.work_order_id, action: "acknowledge" }),
                    ).catch(() => {})
                  }
                >
                  Acknowledge
                </button>
                <button type="button" className="btn btn-light" onClick={() => setDeclining(job.work_order_id)}>
                  Decline
                </button>
              </span>
            )}
          </div>
        );
      })}

      {messages.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2>Messages</h2>
          {messages.map((m) => (
            <p className="sub" key={m.notification_id}>{m.message}</p>
          ))}
        </div>
      )}

      {active.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2>My deadlines</h2>
          {active.map((job) => (
            <ActiveJob key={job.work_order_id} job={job} run={run} busy={busy} />
          ))}
        </div>
      )}
    </div>
  );
}


const fmtDue = (iso) =>
  new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const LEVEL_NAME = { immediate: "Critical", high: "High", medium: "Medium", low: "Low" };
/** "1 d 23 h left" or "5 h left", rounded once so it never reads "1 d 24 h". */
const leftIn = (hours) => {
  const h = Math.round(Math.abs(hours));
  const text = h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h`;
  return hours < 0 ? "Past due" : `${text} left`;
};
const rupees = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

/** A short note under a job: what is happening to it that the technician should know. */
function JobNote({ tone, title, children }) {
  return (
    <div className={`job-note job-note-${tone}`}>
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  );
}

/** One acknowledged job: what it is, when it is due, where it stands, and what can be done next. */
function ActiveJob({ job, run, busy }) {
  const sla = job.sla;
  const [mode, setMode] = useState(null); // "extend"
  const [date, setDate] = useState("");
  const [why, setWhy] = useState("");
  // Runs one step on this job. An error is shown by the inbox.
  const step = (action, body) => run(jobAction({ id: job.work_order_id, action, body }));
  const stepThenClose = (action, body) => step(action, body).then(() => setMode(null), () => {});
  const late = sla.hours_left < 0;
  const needsSafe = sla.safe_by && !sla.made_safe_at;

  return (
    <div className="job-card">
      <div className="job-card-top">
        <div className="job-card-main">
          <div className="job-card-head">
            <span className={`priority-tag priority-${job.priority}`}>{LEVEL_NAME[job.priority] || "Medium"}</span>
            <strong className="job-card-title">{job.title}</strong>
          </div>
          {job.description && <p className="job-card-desc">{job.description}</p>}
          {job.has_reopen_photo && <ReopenPhoto ticketId={job.ticket_id} />}
          <p className={"job-card-due" + (late ? " late" : "")}>
            Finish by {fmtDue(sla.deadline_at)}
            <span>{leftIn(sla.hours_left)}</span>
          </p>
        </div>

        {mode === null && (
          <div className="job-card-actions">
            {job.status === "new" && (
              <button type="button" className="btn btn-dark" disabled={busy} onClick={() => step("start").catch(() => {})}>
                Start work
              </button>
            )}
            {job.status === "inprogress" && (
              <button type="button" className="btn btn-green" disabled={busy} onClick={() => step("finish").catch(() => {})}>
                Mark done
              </button>
            )}
            {needsSafe && (
              <button type="button" className="btn btn-green" disabled={busy} onClick={() => step("made-safe").catch(() => {})}>
                Made safe
              </button>
            )}
            {!sla.request && (
              <button type="button" className="btn btn-light" onClick={() => setMode("extend")}>
                Request extension
              </button>
            )}
          </div>
        )}
      </div>

      {needsSafe && (
        <JobNote tone="danger" title="Make it safe first">
          Do this by {fmtDue(sla.safe_by)}.
        </JobNote>
      )}
      {job.estimate?.state === "waiting" && (
        <JobNote tone="info" title="Cost estimate is with Finance">
          You asked for {rupees(job.estimate.total)}. You can start once it is approved.
        </JobNote>
      )}
      {job.estimate?.state === "sent_back" && (
        <JobNote tone="warn" title="Finance sent your estimate back">
          {job.estimate.reason ? `${job.estimate.reason} ` : ""}Send a new one from My Work Orders.
        </JobNote>
      )}
      {sla.request && (
        <JobNote tone="info" title="Request sent">
          Waiting for the coordinator to answer.
        </JobNote>
      )}

      {mode === "extend" && (
        <div className="job-extend">
          <label>
            New finish date
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Reason
            <input type="text" placeholder="A few words" value={why} onChange={(e) => setWhy(e.target.value)} />
          </label>
          <span className="job-extend-actions">
            <button
              type="button"
              className="btn btn-dark"
              disabled={busy || !date || why.trim().length < 3}
              onClick={() =>
                stepThenClose("extension", {
                  new_deadline_at: new Date(date).toISOString(),
                  reason: why,
                })
              }
            >
              Send request
            </button>
            <button type="button" className="btn btn-light" onClick={() => setMode(null)}>
              Cancel
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
