/**
 * BuildingPanel — the selected campus's buildings, each with its
 * departments listed underneath.
 *
 * Clicking a building selects it; the meter panel then shows its meters.
 */
import { formatCurrency } from "../auditorUtils";

export default function BuildingPanel({
  campus,
  buildings,
  departments,
  meters,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}) {
  let title = "Buildings & Departments";
  let subtitle = "Select a campus above to manage its buildings.";
  if (campus) {
    title = campus.name + " — Buildings";
    subtitle =
      (campus.location || "—") +
      " · Budget " +
      formatCurrency(campus.total_budget);
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            type="button"
            className="btn-dark"
            disabled={!campus}
            onClick={() => onEdit("building", null)}
          >
            + Building
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={!selectedId}
            onClick={() => onEdit("department", null)}
          >
            + Department
          </button>
        </div>
      </div>

      {buildings.length === 0 && (
        <div className="empty-state">No buildings in this campus.</div>
      )}

      {buildings.length > 0 && (
        <div className="building-list">
          {buildings.map((building) => {
            const buildingDepts = departments.filter(
              (d) => d.building_id === building.building_id,
            );
            const meterCount = meters.filter(
              (m) => m.building_id === building.building_id,
            ).length;

            let className = "building-card";
            if (building.building_id === selectedId) {
              className = "building-card active";
            }

            return (
              <article key={building.building_id} className={className}>
                <button
                  type="button"
                  className="building-select"
                  onClick={() => onSelect(building.building_id)}
                >
                  <h3>{building.name}</h3>
                  <div className="building-meta">
                    {formatCurrency(building.budget)} · {meterCount} meter(s) ·{" "}
                    {buildingDepts.length} dept(s)
                  </div>
                  <div className="muted-cell">{building.building_id}</div>
                </button>
                <div className="building-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => onEdit("building", building)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="icon-btn btn-danger"
                    onClick={() => onDelete("building", building)}
                  >
                    Delete
                  </button>
                </div>

                {buildingDepts.length > 0 && (
                  <div className="dept-list">
                    {buildingDepts.map((dept) => (
                      <div key={dept.department_id} className="dept-item">
                        <span>
                          ↳ {dept.name}{" "}
                          <small className="muted-cell">
                            {formatCurrency(dept.budget)}
                          </small>
                        </span>
                        <span className="dept-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => onEdit("department", dept)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="icon-btn btn-danger"
                            onClick={() => onDelete("department", dept)}
                          >
                            Delete
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
