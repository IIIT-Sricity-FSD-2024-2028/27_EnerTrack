/**
 * CampusPanel — the row of campus cards along the top.
 *
 * Clicking a card selects it; the panels below then show its buildings.
 * The Organisation filter only appears on the admin page (no orgId).
 * Styles are in infrastructure_shared.css.
 */
import { formatCurrency } from "../auditorUtils";

export default function CampusPanel({
  campuses,
  buildings,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  orgName,
  showOrgFilter,
  orgs,
  orgFilter,
  onOrgFilterChange,
}) {
  return (
    <div className="panel campus-panel">
      <div className="panel-header">
        <div>
          <h2>Campuses</h2>
          <p>Select a campus to manage its buildings, departments & meters</p>
        </div>
        <div style={headerButtons}>
          {showOrgFilter && (
            <div
              className="form-field"
              style={{ marginBottom: 0, minWidth: "200px" }}
            >
              <label htmlFor="infraFilterOrg">Organisation</label>
              <select
                id="infraFilterOrg"
                value={orgFilter}
                onChange={(e) => onOrgFilterChange(e.target.value)}
              >
                <option value="">All organisations</option>
                {orgs.map((o) => (
                  <option key={o.organization_id} value={o.organization_id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            className="btn-dark"
            onClick={() => onEdit("campus", null)}
          >
            + Add Campus
          </button>
        </div>
      </div>

      <div className="campus-row">
        {campuses.length === 0 && (
          <div className="empty-state">No campuses yet.</div>
        )}

        {campuses.map((campus) => {
          const buildingCount = buildings.filter(
            (b) => b.campus_id === campus.campus_id,
          ).length;

          let className = "building-card";
          if (campus.campus_id === selectedId) {
            className = "building-card active";
          }

          return (
            <article key={campus.campus_id} className={className}>
              <button
                type="button"
                className="building-select"
                onClick={() => onSelect(campus.campus_id)}
              >
                <h3>{campus.name}</h3>
                <div className="building-meta">
                  {campus.location || "—"} ·{" "}
                  {formatCurrency(campus.total_budget)} · {buildingCount}{" "}
                  building(s)
                </div>
                <div className="building-meta">
                  <strong>{orgName(campus.organization_id)}</strong>
                </div>
                <div className="muted-cell">{campus.campus_id}</div>
              </button>
              <div className="building-actions">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onEdit("campus", campus)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="icon-btn btn-danger"
                  onClick={() => onDelete("campus", campus)}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const headerButtons = {
  display: "flex",
  gap: "8px",
  alignItems: "flex-end",
  flexWrap: "wrap",
};
