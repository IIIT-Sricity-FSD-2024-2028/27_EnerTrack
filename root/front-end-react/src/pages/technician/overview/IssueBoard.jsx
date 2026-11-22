/**
 * IssueBoard — every reported issue, newest trouble first, with filters.
 * It owns only what is on screen (which filter, which row is open, who was
 * picked in a dropdown). The page owns the data and the actions.
 */
import { useState } from "react";
import IssueRow from "./IssueRow";
import { FILTERS, sortRows } from "./issueStage";

export default function IssueBoard({ rows, people, users, filter, onFilter, lastSeen, busy, onAssign, onPriority, onDecide, onDeadline }) {
  const [openId, setOpenId] = useState(null);
  const [choice, setChoice] = useState({});
  const [showFixed, setShowFixed] = useState(false);

  const active = rows.filter((r) => r.stage.key !== "fixed");
  const fixed = rows.filter((r) => r.fixedThisWeek);

  const test = FILTERS.find((f) => f.id === filter)?.test || (() => true);
  const shown = sortRows(active.filter(test)).concat(showFixed ? fixed : []);

  return (
    <div className="card">
      <div className="feed-header">
        <div>
          <h2>Issues ({active.length} open)</h2>
          <small>Every report from students and staff. New reports appear here on their own.</small>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filter issues">
        {FILTERS.filter((f) => !f.hidden).map((f) => (
          <button
            key={f.id}
            type="button"
            className={"chip" + (filter === f.id ? " on" : "")}
            aria-pressed={filter === f.id}
            onClick={() => onFilter(f.id)}
          >
            {f.label}
            <span className="chip-n">{active.filter(f.test).length}</span>
          </button>
        ))}
        <label className="chip-check">
          <input type="checkbox" checked={showFixed} onChange={(e) => setShowFixed(e.target.checked)} />
          Show fixed this week ({fixed.length})
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          {active.length === 0
            ? "No open issues. New reports appear here as they come in."
            : "Nothing matches this filter."}
        </div>
      ) : (
        <ul className="issue-board">
          {shown.map((r) => (
            <IssueRow
              key={r.id}
              row={r}
              people={people}
              users={users}
              open={openId === r.id}
              isNew={!!lastSeen && new Date(r.ticket.created_at).getTime() > lastSeen}
              choice={choice}
              busy={busy}
              onToggle={(id) => setOpenId(openId === id ? null : id)}
              onChoice={(id, v) => setChoice({ ...choice, [id]: v })}
              onAssign={(id, v) => onAssign(id, v).then(() => setChoice((c) => ({ ...c, [id]: "" })))}
              onPriority={onPriority}
              onDecide={onDecide}
              onDeadline={onDeadline}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
