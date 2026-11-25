/**
 * NeedsYou — the strip of things only the coordinator can move on.
 * Each tile filters the issue board below; "Ready to verify" goes to the
 * Work Orders page, where a finished job is checked and closed; "Rework
 * requested" (only when there is some) jumps to the rework panel.
 */
import { Link } from "react-router-dom";
import { PATHS } from "../../../routes";

export default function NeedsYou({ counts, filter, onFilter }) {
  const tiles = [
    { id: "queued", label: "Waiting for a person", value: counts.queued },
    { id: "requests", label: "Requests to answer", value: counts.requests },
    { id: "unsafe", label: "Critical, not yet safe", value: counts.unsafe },
    { id: "late", label: "Late", value: counts.late },
  ];

  return (
    <div className="card needs-card">
      <div className="feed-header">
        <div>
          <h2>Needs you</h2>
          <small>Only you can move these on.</small>
        </div>
      </div>
      <div className="needs-grid">
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            className={"needs-tile" + (t.value ? " hot" : "") + (filter === t.id ? " active" : "")}
            onClick={() => onFilter(filter === t.id ? "all" : t.id)}
            aria-pressed={filter === t.id}
          >
            <span className="needs-value">{t.value}</span>
            <span className="needs-label">{t.label}</span>
          </button>
        ))}
        {counts.rework > 0 && (
          <a className="needs-tile hot" href="#rework-requests">
            <span className="needs-value">{counts.rework}</span>
            <span className="needs-label">Rework requested</span>
          </a>
        )}
        <Link className={"needs-tile" + (counts.verify ? " hot" : "")} to={PATHS.technician.workOrders}>
          <span className="needs-value">{counts.verify}</span>
          <span className="needs-label">Ready to verify, open Work Orders</span>
        </Link>
      </div>
    </div>
  );
}
