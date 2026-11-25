/**
 * TeamPanel — what the coordinator needs to judge the team, kept apart from
 * the issue list: who is free and how loaded, who has been declining, and
 * where the time went on jobs that are late (so a staffing gap is not blamed
 * on one person). It draws what it is given.
 */
import LoadBar from "./LoadBar";

const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function TeamPanel({ queue, busy, onSweep }) {
  const people = queue.team_status || [];
  const declines = queue.declines || [];
  const late = [...(queue.overdue || []), ...(queue.unsafe || [])].filter(
    (r, i, all) => all.findIndex((x) => x.work_order_id === r.work_order_id) === i,
  );

  return (
    <div className="card">
      <div className="feed-header">
        <div>
          <h2>Team and deadlines</h2>
          <small>How full each person is. Someone who is Full is not sent new jobs.</small>
        </div>
        <button type="button" className="btn btn-light" disabled={busy} onClick={onSweep}>
          Check timeouts now
        </button>
      </div>

      <div className="team-grid">
        <div>
          <h3>Team right now</h3>
          {people.length === 0 && <p className="sub">No technicians yet.</p>}
          <ul className="team-list team-load">
            {people.map((p) => (
              <li key={p.user_id}>
                <span>
                  {p.name}
                  <small>{p.team || "no team set"}</small>
                </span>
                {p.team ? (
                  <LoadBar person={p} />
                ) : (
                  <span className="load load-none">
                    <span className="load-text">
                      <strong>No team</strong>
                      <small>No automatic jobs</small>
                    </span>
                  </span>
                )}
                <span className={"badge " + (p.available ? "resolved" : "high")}>
                  {p.available ? "Available" : p.off_for_today ? "Off today" : "Not available"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Declines and missed answers this week</h3>
          {declines.length === 0 ? (
            <p className="sub">None. A pattern here is a conversation to have, not a penalty.</p>
          ) : (
            <ul className="team-list">
              {declines.map((d) => (
                <li key={d.user_id}>
                  <span>
                    {d.name}
                    <small>{d.team || "no team set"}</small>
                  </span>
                  <span>
                    {d.declines_this_week} declined, {d.missed_this_week} missed
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {late.length > 0 && (
        <div>
          <h3>Late or Critical jobs not yet safe: where the time went</h3>
          <ul className="team-list">
            {late.map((r) => (
              <li key={r.work_order_id}>
                <span>
                  {r.title}
                  <small>
                    {r.technician || "Unassigned"}, finish by {fmt(r.deadline_at)}
                  </small>
                </span>
                <span className="sub">
                  Waiting for staff {r.delays.waiting_for_staff_min} min, to start {r.delays.waiting_to_start_min} min,
                  working {r.delays.working_min} min, parts {r.delays.waiting_for_parts_min} min
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
