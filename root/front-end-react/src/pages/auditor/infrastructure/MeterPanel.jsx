/**
 * MeterPanel — the meters on the selected building.
 */
import { label } from "../auditorUtils";

export default function MeterPanel({ building, meters, onEdit, onDelete }) {
  let subtitle = "Select a building to view its meters.";
  if (building) {
    subtitle = "Showing meters for " + building.name;
  }

  let content;
  if (!building) {
    content = (
      <div className="empty-state">Select a building to see its meters.</div>
    );
  } else if (meters.length === 0) {
    content = (
      <div className="empty-state">No meters linked to this building.</div>
    );
  } else {
    content = (
      <div className="meter-list">
        {meters.map((meter) => (
          <article key={meter.meter_id} className="meter-card">
            <div className="meter-card-header">
              <div>
                <h3 className="meter-title">{meter.meter_code}</h3>
                <div className="meter-meta">
                  {label(meter.meter_type)} · {meter.zone || "No zone"}
                </div>
              </div>
              {/* infrastructure_shared.css colours .badge.active, .badge.faulty, ... */}
              <span className={"badge " + meter.status}>
                {label(meter.status)}
              </span>
            </div>
            <div className="meter-schema-list">
              <span>meter_id</span>
              <strong>{meter.meter_id}</strong>
              <span>building_id</span>
              <strong>{meter.building_id}</strong>
            </div>
            <div className="row-actions meter-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => onEdit("meter", meter)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-outline btn-danger"
                onClick={() => onDelete("meter", meter)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Meters</h2>
          <p>{subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            type="button"
            className="btn-dark"
            disabled={!building}
            onClick={() => onEdit("meter", null)}
          >
            + Add Meter
          </button>
        </div>
      </div>

      {content}
    </div>
  );
}
