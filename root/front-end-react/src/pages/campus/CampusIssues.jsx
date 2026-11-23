/**
 * CampusIssues — /campus/issues. Every open issue on campus, filterable by
 * building and then floor, with "+1 This affects me too".
 *
 * Deliberately shows no names, no priority and no counts, so nobody can see
 * how many friends to ask for a +1 to push a ticket up.
 */
import { useCallback, useEffect, useState } from "react";
import api from "../../api/client";
import { statusClass, statusLabel } from "./serviceRequestHelpers";
import campusCss from "./campus.css?inline";

export default function CampusIssues() {
  const [catalogue, setCatalogue] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [buildingId, setBuildingId] = useState("");
  const [floor, setFloor] = useState("");
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/service-requests/catalogue"), api.get("/buildings")])
      .then(([cat, b]) => {
        setCatalogue(cat);
        setBuildings(Array.isArray(b) ? b : []);
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (buildingId) q.set("building_id", buildingId);
    if (buildingId && floor) q.set("floor", floor);
    api
      .get(`/service-requests/campus-issues${q.size ? `?${q}` : ""}`)
      .then((list) => setIssues(Array.isArray(list) ? list : []))
      .catch((e) => setError(e.message));
  }, [buildingId, floor]);

  useEffect(load, [load]);

  async function plusOne(id) {
    try {
      await api.post(`/service-requests/${id}/plus-one`, {});
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="campus-page">
      <style>{campusCss}</style>
      <div className="page-header">
        <h1>Campus issues</h1>
        <p>
          Everything that is open right now. If it affects you too, press +1: it
          helps us see how many people it reaches.
        </p>
      </div>

      <div className="report-card" style={{ marginBottom: 16 }}>
        <div
          className="report-card-body"
          style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="cb">Building</label>
            <select
              id="cb"
              value={buildingId}
              onChange={(e) => {
                setBuildingId(e.target.value);
                setFloor("");
              }}
            >
              <option value="">All buildings</option>
              {buildings.map((b) => (
                <option key={b.building_id} value={b.building_id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {buildingId && catalogue && (
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="cf">Floor</label>
              <select
                id="cf"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
              >
                <option value="">All floors</option>
                {catalogue.floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="ticket-section">
        <h2>
          Open issues <span className="ticket-count">{issues.length}</span>
        </h2>
        {issues.length === 0 ? (
          <div className="empty-state">
            <p>Nothing open here right now.</p>
          </div>
        ) : (
          issues.map((t) => (
            <div className="ticket-card" key={t.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                  {t.summary}
                </p>
              </div>
              <div className={`ticket-status ${statusClass(t.status)}`}>
                {statusLabel(t.status)}
              </div>
              <button
                type="button"
                className="plus-one-btn"
                disabled={t.mine}
                onClick={() => plusOne(t.id)}
              >
                {t.mine ? "Added" : "+1 This affects me too"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
