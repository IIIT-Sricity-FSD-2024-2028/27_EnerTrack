/**
 * CampusIssues — /campus/issues. Every open issue on campus, grouped by the
 * kind of problem (in the report form's order) and filterable by building
 * and then floor, with "+1 It affects me" on each.
 *
 * Deliberately shows no names, no priority and no +1 counts, so nobody can
 * see how many friends to ask for a +1 to push a ticket up.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import { statusLabel } from "./serviceRequestHelpers";
import campusCss from "./campus.css?inline";

// The coloured dot in front of each status.
const DOT = {
  Reported: "ci-dot-reported",
  Assigned: "ci-dot-assigned",
  Visited: "ci-dot-progress",
  Checking: "ci-dot-progress",
  Fixed: "ci-dot-fixed",
};

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

  // One group per kind of problem, in the catalogue's order; anything the
  // catalogue does not know goes last under "Other".
  const groups = useMemo(() => {
    const types = catalogue?.issueTypes ?? [];
    const known = new Set(types.map((t) => t.id));
    const list = types.map((t) => ({
      id: t.id,
      label: t.label,
      items: issues.filter((i) => i.issue_type_id === t.id),
    }));
    list.push({
      id: "other",
      label: "Other",
      items: issues.filter((i) => !known.has(i.issue_type_id)),
    });
    return list.filter((g) => g.items.length > 0);
  }, [catalogue, issues]);

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

      <p className="ci-total">
        {issues.length} open {issues.length === 1 ? "issue" : "issues"}
      </p>

      {issues.length === 0 ? (
        <div className="empty-state">
          <p>Nothing open here right now.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section className="ci-group" key={g.id} aria-labelledby={`ci-${g.id}`}>
            <h2 className="ci-group-title" id={`ci-${g.id}`}>
              {g.label}
              <span className="ci-group-count">{g.items.length}</span>
            </h2>
            <ul className="ci-list">
              {g.items.map((t) => (
                <li className="ci-row" key={t.id}>
                  <div className="ci-main">
                    <p className="ci-title">{t.title}</p>
                    <p className="ci-place">{t.location}</p>
                  </div>
                  <span className={`ci-status ${DOT[t.status] || ""}`}>
                    {statusLabel(t.status)}
                  </span>
                  {t.mine ? (
                    <span className="ci-added">✓ Added</span>
                  ) : (
                    <button
                      type="button"
                      className="ci-plus"
                      aria-label={`This affects me too: ${t.title}, ${t.location}`}
                      onClick={() => plusOne(t.id)}
                    >
                      +1 It affects me
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
