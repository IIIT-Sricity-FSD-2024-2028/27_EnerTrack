/**
 * DispatchInbox — the technician's side of auto-dispatch.
 *
 * Jobs are PUSHED to one person by the system. There is no list to browse
 * and nothing to pick, so this component only offers three things:
 *   - the "Available today" switch (off = the system sends nothing new)
 *   - Acknowledge a job that was given to me
 *   - Decline it with a reason (it then moves to the next person)
 */
import { useCallback, useEffect, useState } from "react";
import api from "../../api/client";
import { capitalize } from "../technician/techUtils";

const REASONS = [
  { value: "sick", label: "I am unwell today" },
  { value: "on_another_job", label: "I am on another job" },
  { value: "no_tools", label: "I do not have the tools or parts" },
  { value: "other", label: "Another reason" },
];

function minutesLeft(dueAt) {
  if (!dueAt) return null;
  return Math.max(0, Math.round((new Date(dueAt).getTime() - Date.now()) / 60000));
}

export default function DispatchInbox({ onChange }) {
  const [state, setState] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState("on_another_job");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);

  const load = useCallback(
    () =>
      Promise.all([api.get("/dispatch/availability"), api.get("/dispatch/mine"), api.get("/notifications")])
        .then(([a, mine, msgs]) => {
          setError("");
          setState(a);
          setJobs(Array.isArray(mine) ? mine : []);
          setMessages(Array.isArray(msgs) ? [...msgs].reverse().slice(0, 5) : []);
        })
        .catch((e) => setError(e.message)),
    [],
  );

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
      setDeclining(null);
      await load();
      if (onChange) onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const pending = jobs.filter((j) => j.ack_status === "pending");
  const active = jobs.filter((j) => j.ack_status === "acknowledged" && j.sla);

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
        {state && (
          <button
            type="button"
            className={state.switched_on ? "btn btn-green" : "btn btn-light"}
            disabled={busy}
            onClick={() =>
              run(() =>
                api.put("/dispatch/availability", {
                  available: !state.switched_on,
                }),
              )
            }
          >
            {state.switched_on ? "Available today" : "Not available"}
          </button>
        )}
      </div>

      {state && state.switched_on && state.off_for_today && (
        <p className="sub">
          You were marked unavailable for today, so no new jobs will be sent
          until tomorrow. Tell your coordinator if this was a mistake.
        </p>
      )}
      {state && !state.switched_on && (
        <p className="sub">You will not be sent new jobs while this is off.</p>
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
                <small style={{ display: "block" }}>{job.description}</small>
              ) : null}
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
                    run(() =>
                      api.post(`/dispatch/work-orders/${job.work_order_id}/decline`, { reason }),
                    )
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
                    run(() => api.post(`/dispatch/work-orders/${job.work_order_id}/acknowledge`, {}))
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

const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/** One acknowledged job: its finish date and the few things a technician can do about it. */
function ActiveJob({ job, run, busy }) {
  const sla = job.sla;
  const [mode, setMode] = useState(null); // "parts" | "extend"
  const [days, setDays] = useState(2);
  const [date, setDate] = useState("");
  const [why, setWhy] = useState("");
  const base = `/dispatch/work-orders/${job.work_order_id}`;

  return (
    <div className="up-next-item" style={{ flexWrap: "wrap", gap: 8 }}>
      <span className="up-next-title" style={{ flex: 1, minWidth: 220 }}>
        {job.title}
        <small style={{ display: "block" }}>
          {sla.paused
            ? `Clock paused for parts until about ${fmt(sla.expected_back)}`
            : `Finish by ${fmt(sla.deadline_at)} (${sla.hours_left >= 0 ? `${sla.hours_left} h left` : "past due"})`}
        </small>
        {sla.request && (
          <small style={{ display: "block" }}>Waiting for the coordinator to answer your request.</small>
        )}
        {sla.safe_by && !sla.made_safe_at && (
          <small style={{ display: "block", color: "#b91c1c" }}>
            Make it safe by {fmt(sla.safe_by)}
          </small>
        )}
      </span>

      {mode === null && (
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {job.status === "new" && (
            <button type="button" className="btn btn-dark" disabled={busy} onClick={() => run(() => api.post(`${base}/start`, {}))}>
              Start work
            </button>
          )}
          {job.status === "inprogress" && (
            <button type="button" className="btn btn-green" disabled={busy} onClick={() => run(() => api.post(`${base}/finish`, {}))}>
              Mark done
            </button>
          )}
          {sla.safe_by && !sla.made_safe_at && (
            <button type="button" className="btn btn-green" disabled={busy} onClick={() => run(() => api.post(`${base}/made-safe`, {}))}>
              Made safe
            </button>
          )}
          {sla.paused ? (
            <button type="button" className="btn btn-dark" disabled={busy} onClick={() => run(() => api.post(`${base}/resume`, {}))}>
              Parts arrived
            </button>
          ) : (
            <button type="button" className="btn btn-light" onClick={() => setMode("parts")}>
              Needs parts
            </button>
          )}
          {!sla.request && (
            <button type="button" className="btn btn-light" onClick={() => setMode("extend")}>
              Request extension
            </button>
          )}
        </span>
      )}

      {mode === "parts" && (
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label>
            Expected wait (days){" "}
            <input type="number" min="1" max="60" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 70 }} />
          </label>
          {days > 5 && <small>Over 5 days needs the coordinator&apos;s OK.</small>}
          <button type="button" className="btn btn-dark" disabled={busy}
            onClick={() => run(() => api.post(`${base}/needs-parts`, { days })).then(() => setMode(null))}>
            Pause for parts
          </button>
          <button type="button" className="btn btn-light" onClick={() => setMode(null)}>Cancel</button>
        </span>
      )}

      {mode === "extend" && (
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="text" placeholder="Short reason" value={why} onChange={(e) => setWhy(e.target.value)} />
          <button type="button" className="btn btn-dark" disabled={busy || !date || why.trim().length < 3}
            onClick={() => run(() => api.post(`${base}/extension`, { new_deadline_at: new Date(date).toISOString(), reason: why })).then(() => setMode(null))}>
            Send request
          </button>
          <button type="button" className="btn btn-light" onClick={() => setMode(null)}>Cancel</button>
        </span>
      )}
    </div>
  );
}
