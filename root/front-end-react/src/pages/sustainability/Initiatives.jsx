import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import initiativesCss from "../../styles/sustainability_officer/sust_initiatives.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

const STATE_ORDER = ["proposed", "approved", "in-progress", "completed"];
/** Statuses the server lets an initiative be archived from. */
const ARCHIVABLE = ["completed", "rejected"];

/**
 * The moves the Sustainability Officer makes from the board. Approving or
 * rejecting a proposal is the Organization Admin's decision (their approvals
 * page), and the server refuses anything else.
 */
const SO_NEXT = {
  approved: { to: "in-progress", label: "Start work" },
  "in-progress": { to: "completed", label: "Mark completed" },
};

/** The Sustainability Officer may only delete what never started. */
const WITHDRAWABLE = ["proposed", "rejected"];

function formatStatus(status) {
  const map = {
    proposed: "Proposed",
    approved: "Approved",
    "in-progress": "In Progress",
    completed: "Completed",
    rejected: "Rejected",
  };
  return map[status] || status;
}

/** Lower-cases and dashes a status; an unknown one is kept as-is, never relabelled. */
function normalizeStatus(status) {
  if (!status) return "proposed";
  return status.toLowerCase().replace(/_/g, "-");
}

const formatMoney = (n) =>
  typeof n === "number" ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;

const formatDate = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : null;

const todayIso = () => new Date().toISOString().slice(0, 10);

const idOf = (i) => i.initiative_id;

/** What an initiative can be measured on, and its unit. */
const MEASURES = [
  { value: "energy_kwh", label: "Electricity", unit: "kWh" },
  { value: "water_kl", label: "Water", unit: "kL" },
  { value: "gas_m3", label: "Natural gas", unit: "m³" },
  { value: "emissions_kg", label: "Emissions", unit: "kg CO₂e" },
];
const measureOf = (metric) => MEASURES.find((m) => m.value === metric);
const num = (n) => Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });

/**
 * What the initiative has actually saved, measured from meter readings
 * against the same months last year. Replaces the old manual on/off-track
 * toggle.
 */
function Performance({ init }) {
  const p = init.performance;
  if (!p || init.status === "proposed" || init.status === "rejected") return null;
  if (!p.measurable)
    return <p className="perf perf--none">Not measured: {p.reason === "No measure chosen." ? "no measure chosen" : "not started yet"}.</p>;
  if (init.status === "completed" && init.verified_saving != null)
    return (
      <p className="perf perf--done">
        Verified saving: {num(init.verified_saving)} {p.unit}
        {init.expected_saving ? ` (expected ${num(init.expected_saving)} ${p.unit} a year)` : ""}.
      </p>
    );
  if (p.months_compared === 0) return <p className="perf perf--none">No full months to compare yet.</p>;
  const label = { green: "On track", amber: "Behind", red: "Well behind" }[p.rating];
  return (
    <p className={`perf perf--${p.rating || "none"}`}>
      {label && <span className="perf__chip">{label}</span>}
      Saved {num(p.actual_saving_to_date)} {p.unit}
      {p.expected_to_date != null ? ` of ${num(p.expected_to_date)} expected` : ""} over {p.months_compared} month
      {p.months_compared === 1 ? "" : "s"}, against the same months last year.
    </p>
  );
}

export default function SustainabilityInitiatives() {
  const [initiatives, setInitiatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState(null);

  // New initiative form fields
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [searchParams] = useSearchParams();
  const [newMetric, setNewMetric] = useState(searchParams.get("building") ? "energy_kwh" : "");
  const [newSaving, setNewSaving] = useState("");
  // Arriving from Monitoring's "Propose initiative" pre-fills the building.
  const [newBuildings, setNewBuildings] = useState(() =>
    searchParams.get("building") ? [searchParams.get("building")] : [],
  );
  const [buildings, setBuildings] = useState([]);
  const [targets, setTargets] = useState([]);
  const [newTargetId, setNewTargetId] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [isProposing, setIsProposing] = useState(false);

  // Edit modal
  const [editingInit, setEditingInit] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Everything shown comes from the server. If it cannot be reached the page
  // says so; it never fills in example initiatives or keeps local copies.
  useEffect(() => {
    let active = true;

    api
      .get("/initiatives")
      .then((res) => {
        if (!active) return;
        const data = Array.isArray(res) ? res : res?.data;
        setInitiatives(
          (Array.isArray(data) ? data : []).map((item) => ({
            ...item,
            status: normalizeStatus(item.status),
          })),
        );
        setLoadError(null);
      })
      .catch((err) => {
        if (active) setLoadError(err.message || "Initiatives could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    api
      .get("/buildings")
      .then((res) => active && setBuildings(Array.isArray(res) ? res : []))
      .catch(() => {});
    // Targets an initiative can count towards (optional, for the form and cards).
    api
      .get("/targets")
      .then((res) => active && setTargets(Array.isArray(res) ? res : []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const buildingName = (id) => buildings.find((b) => b.building_id === id)?.name || "a building";
  const targetSummary = (id) => targets.find((t) => t.target_id === id)?.summary;
  const linkableTargets = targets.filter(
    (t) => t.metric === newMetric && (t.status === "active" || t.status === "proposed"),
  );

  const retryLoad = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const replaceInit = (id, next) =>
    setInitiatives((prev) => prev.map((i) => (idOf(i) === id ? next : i)));

  // Archived initiatives live in Archives; the board shows the rest.
  const live = initiatives.filter((i) => !i.archived_at);
  const rejected = live.filter((i) => i.status === "rejected");

  // State advancement
  const handleMoveState = async (id, nextState) => {
    const prevInit = initiatives.find((i) => idOf(i) === id);
    if (!prevInit) return;
    replaceInit(id, { ...prevInit, status: nextState });
    try {
      await api.patch(`/initiatives/${id}`, { status: nextState });
      showToast(`Moved to ${formatStatus(nextState)}`, "success");
    } catch (err) {
      replaceInit(id, prevInit);
      showToast(err.message || "Failed to move initiative. Nothing was changed.", "error");
    }
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDesc("");
    setNewMetric("");
    setNewSaving("");
    setNewBuildings([]);
    setNewTargetId("");
    setNewCost("");
    setNewTargetDate("");
  };

  // Propose new initiative from top bar. The server records who proposed it.
  const handlePropose = async (e) => {
    if (e) e.preventDefault();

    const title = newTitle.trim();
    const desc = newDesc.trim();
    const costText = newCost.trim().replace(/,/g, "");
    const savingText = newSaving.trim().replace(/,/g, "");

    if (!title) return showToast("Title is required.", "error");
    if (!desc) return showToast("Description is required.", "error");

    let expected;
    if (savingText) {
      expected = Number(savingText);
      if (!Number.isFinite(expected) || expected < 0)
        return showToast("Expected saving must be a number of zero or more.", "error");
      if (!newMetric) return showToast("Choose what the expected saving is measured in.", "error");
    }

    let capex;
    if (costText) {
      capex = Number(costText);
      if (!Number.isFinite(capex) || capex < 0) {
        return showToast("Cost must be a number of zero or more.", "error");
      }
    }
    if (newTargetDate && newTargetDate < todayIso()) {
      return showToast("Target date cannot be in the past.", "error");
    }

    const payload = {
      title,
      description: desc,
      status: "proposed",
      feasible: true,
      outcomes: [],
      ...(newMetric ? { metric: newMetric } : {}),
      ...(expected !== undefined ? { expected_saving: expected } : {}),
      ...(newBuildings.length ? { building_ids: newBuildings } : {}),
      ...(newTargetId && linkableTargets.some((t) => t.target_id === newTargetId) ? { target_id: newTargetId } : {}),
      ...(capex !== undefined ? { capex } : {}),
      ...(newTargetDate ? { target_date: newTargetDate } : {}),
    };

    setIsProposing(true);
    try {
      const created = await api.post("/initiatives", payload);
      if (created?.initiative_id) {
        setInitiatives((prev) => [{ ...created, status: normalizeStatus(created.status) }, ...prev]);
      } else {
        retryLoad();
      }
      showToast("Initiative proposed. The Organization Admin has been asked to approve it.", "success");
      resetForm();
    } catch (err) {
      showToast(err.message || "Failed to propose initiative. It was not saved.", "error");
    } finally {
      setIsProposing(false);
    }
  };

  // Delete initiative (permanent)
  const handleDelete = async (init) => {
    const id = idOf(init);
    if (!window.confirm(`Delete "${init.title}" permanently? This cannot be undone.`)) return;
    try {
      await api.delete(`/initiatives/${id}`);
      setInitiatives((prev) => prev.filter((i) => idOf(i) !== id));
      showToast("Initiative deleted.", "success");
    } catch (err) {
      showToast(err.message || "Failed to delete initiative.", "error");
    }
  };

  // Archive a completed or rejected initiative. The record stays on the
  // server with an archived_at stamp and moves to the Archives page.
  const handleArchive = async (init) => {
    const id = idOf(init);
    try {
      const archived = await api.patch(`/initiatives/${id}/archive`);
      replaceInit(id, {
        ...init,
        ...(archived && typeof archived === "object" ? archived : {}),
        status: init.status,
        archived_at: archived?.archived_at || new Date().toISOString(),
      });
      showToast("Initiative moved to Archives.", "success");
    } catch (err) {
      showToast(err.message || "Failed to archive initiative.", "error");
    }
  };

  // Save changes from Edit Modal
  const handleSaveEdit = async () => {
    if (!editingInit) return;
    const title = editingInit.title?.trim();
    if (!title) return showToast("Title is required.", "error");

    const costText = String(editingInit.capexText ?? "").trim().replace(/,/g, "");
    let capex;
    if (costText) {
      capex = Number(costText);
      if (!Number.isFinite(capex) || capex < 0) {
        return showToast("Cost must be a number of zero or more.", "error");
      }
    }

    const savingRaw = String(editingInit.savingText ?? "").trim().replace(/,/g, "");
    if (savingRaw && (!Number.isFinite(Number(savingRaw)) || Number(savingRaw) < 0)) {
      return showToast("Expected saving must be a number of zero or more.", "error");
    }

    const id = idOf(editingInit);
    const patch = {
      title,
      description: editingInit.description || "",
      feasible: editingInit.feasible,
      ...(editingInit.metric ? { metric: editingInit.metric } : {}),
      ...(editingInit.savingText !== undefined && String(editingInit.savingText).trim() !== ""
        ? { expected_saving: Number(String(editingInit.savingText).replace(/,/g, "")) }
        : {}),
      ...(capex !== undefined ? { capex } : {}),
      ...(editingInit.target_date ? { target_date: editingInit.target_date } : {}),
    };

    try {
      const saved = await api.patch(`/initiatives/${id}`, patch);
      const prev = initiatives.find((i) => idOf(i) === id) || {};
      replaceInit(id, {
        ...prev,
        ...(saved && typeof saved === "object" ? saved : patch),
        status: normalizeStatus((saved && saved.status) || patch.status),
      });
      setEditingInit(null);
      showToast("Initiative updated", "success");
    } catch (err) {
      showToast(err.message || "Failed to update initiative. Nothing was changed.", "error");
    }
  };

  return (
    <div className="sustainability-initiatives-page" style={{ width: "100%" }}>
      <style>{initiativesCss}</style>
      <style>{sustLayoutCss}</style>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background:
              toast.type === "error"
                ? "#ef4444"
                : toast.type === "warning"
                  ? "#f59e0b"
                  : toast.type === "info"
                    ? "#3b82f6"
                    : "#059669",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            zIndex: 9999,
            fontWeight: "600",
            fontSize: "13px",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <header className="page-header">
        <div className="page-header-text">
          <h1>Initiatives</h1>
          <p>Propose, track and close out energy and water saving projects.</p>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="main-grid-new">
        {/* TOP: NEW INITIATIVE FORM (compact horizontal bar) */}
        <section className="panel new-initiative-bar">
          <div className="form-bar-header">
            <h2 className="panel-title">New initiative</h2>
          </div>
          <div className="form-bar">
            <div className="form-group">
              <label className="form-label" htmlFor="new-init-title">Title</label>
              <input
                type="text"
                id="new-init-title"
                className="form-input"
                placeholder="Initiative name"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-init-desc">Description</label>
              <input
                type="text"
                id="new-init-desc"
                className="form-input"
                placeholder="Brief description"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-init-metric">Saves</label>
              <select
                id="new-init-metric"
                className="form-input"
                value={newMetric}
                onChange={(e) => setNewMetric(e.target.value)}
              >
                <option value="">Not measured</option>
                {MEASURES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-init-saving">
                Expected saving a year{newMetric ? ` (${measureOf(newMetric).unit})` : ""}
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="new-init-saving"
                className="form-input"
                placeholder={newMetric ? "e.g. 60000" : "Choose what it saves"}
                disabled={!newMetric}
                value={newSaving}
                onChange={(e) => setNewSaving(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-init-cost">Cost (capex)</label>
              <input
                type="text"
                inputMode="decimal"
                id="new-init-cost"
                className="form-input"
                placeholder="e.g. 56500"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-init-target-date">Target date</label>
              <input
                type="date"
                id="new-init-target-date"
                className="form-input"
                min={todayIso()}
                value={newTargetDate}
                onChange={(e) => setNewTargetDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-dark btn-propose"
              onClick={handlePropose}
              disabled={isProposing}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {isProposing ? "Proposing…" : "Propose"}
            </button>
          </div>
          {linkableTargets.length > 0 && (
            <div className="init-target">
              <label htmlFor="new-init-target-link">Counts towards a target (optional)</label>
              <select
                id="new-init-target-link"
                className="form-input"
                value={newTargetId}
                onChange={(e) => setNewTargetId(e.target.value)}
              >
                <option value="">None</option>
                {linkableTargets.map((t) => (
                  <option key={t.target_id} value={t.target_id}>
                    {t.summary.charAt(0).toUpperCase() + t.summary.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {buildings.length > 0 && (
            <fieldset className="init-buildings">
              <legend>Buildings it covers (none ticked means the whole campus)</legend>
              {buildings.map((b) => (
                <label key={b.building_id}>
                  <input
                    type="checkbox"
                    checked={newBuildings.includes(b.building_id)}
                    onChange={() =>
                      setNewBuildings((list) =>
                        list.includes(b.building_id) ? list.filter((x) => x !== b.building_id) : [...list, b.building_id],
                      )
                    }
                  />
                  {b.name}
                </label>
              ))}
            </fieldset>
          )}
        </section>

        {/* PIPELINE (full width) */}
        <section className="panel">
          <h2 className="panel-title">Initiative pipeline</h2>
          <p className="panel-sub">
            You propose; the Organization Admin approves or rejects; you start
            and complete the work. Archive a completed or rejected initiative to
            move it to Archives.
          </p>

          {loading && <p className="panel-sub" role="status">Loading initiatives…</p>}

          {!loading && loadError && (
            <div
              role="alert"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "12px 16px",
                borderRadius: "8px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                fontSize: "13px",
              }}
            >
              <span>
                <strong>Initiatives could not be loaded.</strong> {loadError}
              </span>
              <button type="button" className="btn-action" onClick={retryLoad}>
                Retry
              </button>
            </div>
          )}

          {!loading && !loadError && live.length === 0 && (
            <p className="panel-sub">No initiatives yet. Propose one above to start the pipeline.</p>
          )}

          <div className="pipeline-grid">
            {STATE_ORDER.map((statusKey) => {
              const colItems = live.filter((i) => i.status === statusKey);

              return (
                <div key={statusKey} className="pipeline-col">
                  <h4>{formatStatus(statusKey)}</h4>
                  <div id={`col-${statusKey}`}>
                    {colItems.map((init) => {
                      const id = idOf(init);
                      const next = SO_NEXT[init.status];

                      return (
                        <div
                          key={id}
                          className={`kanban-card ${init.performance?.rating === "red" ? "offtrack" : ""}`}
                          data-id={id}
                        >
                          <div className="kanban-header">
                            <h5>{init.title}</h5>
                          </div>

                          {init.description && (
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                margin: "0 0 8px 0",
                                lineHeight: "1.5",
                              }}
                            >
                              {init.description}
                            </p>
                          )}

                          {init.target_id && targetSummary(init.target_id) && (
                            <p className="init-source">Counts towards: {targetSummary(init.target_id)}</p>
                          )}
                          {init.source_finding && (
                            <p className="init-source">
                              From an energy audit
                              {init.expected_saving_amount ? ` · promised ${formatMoney(init.expected_saving_amount)} a year` : ""}
                            </p>
                          )}

                          <div className="kanban-stats">
                            {init.metric ? (
                              <>
                                <div className="kanban-stats-label">Saves</div>
                                <div className="kanban-stats-val">
                                  {measureOf(init.metric)?.label}
                                  {init.building_ids?.length ? ` · ${init.building_ids.map(buildingName).join(", ")}` : " · whole campus"}
                                </div>
                                {init.expected_saving != null && (
                                  <>
                                    <div className="kanban-stats-label">Expected a year</div>
                                    <div className="kanban-stats-val">
                                      {num(init.expected_saving)} {measureOf(init.metric)?.unit}
                                    </div>
                                  </>
                                )}
                              </>
                            ) : (
                              init.target_reduction && (
                                <>
                                  <div className="kanban-stats-label">Target Reduction</div>
                                  <div className="kanban-stats-val">{init.target_reduction}</div>
                                </>
                              )
                            )}
                            <div className="kanban-stats-label">Feasible</div>
                            <div className="kanban-stats-val">
                              {init.feasible !== false ? "Yes" : "No"}
                            </div>
                            {formatMoney(init.capex) && (
                              <>
                                <div className="kanban-stats-label">Cost</div>
                                <div className="kanban-stats-val">{formatMoney(init.capex)}</div>
                              </>
                            )}
                            {init.target_date && (
                              <>
                                <div className="kanban-stats-label">Target date</div>
                                <div className="kanban-stats-val">{formatDate(init.target_date)}</div>
                              </>
                            )}
                          </div>

                          {init.status === "completed" &&
                            init.outcomes &&
                            init.outcomes.length > 0 && (
                              <div className="kanban-outcomes">
                                {init.outcomes.map((o, idx) => (
                                  <div key={typeof o === "string" ? `${o}-${idx}` : idx} className="outcome-pill">
                                    {o}
                                  </div>
                                ))}
                              </div>
                            )}

                          <Performance init={init} />

                          <div className="kanban-state-row">
                            {init.status === "proposed" ? (
                              <p className="kanban-waiting" style={{ margin: 0, fontSize: "12px", color: "#78350f" }}>
                                Waiting for the Organization Admin to approve it.
                              </p>
                            ) : next ? (
                              <button
                                type="button"
                                className="btn-state btn-state-next"
                                onClick={() => handleMoveState(id, next.to)}
                              >
                                {next.label} →
                              </button>
                            ) : null}
                          </div>
                          {init.status !== "proposed" && init.decision_note && (
                            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#4b5563" }}>
                              Approval note: {init.decision_note}
                            </p>
                          )}

                          <div className="kanban-actions">
                            <button
                              type="button"
                              className="btn-action btn-edit-action"
                              onClick={() =>
                                setEditingInit({ ...init, capexText: init.capex ?? "", savingText: init.expected_saving ?? "" })
                              }
                            >
                              Edit
                            </button>
                            {ARCHIVABLE.includes(init.status) && (
                              <button
                                type="button"
                                className="btn-action btn-archive-action"
                                onClick={() => handleArchive(init)}
                              >
                                Archive
                              </button>
                            )}
                            {WITHDRAWABLE.includes(init.status) && (
                              <button
                                type="button"
                                className="btn-action btn-delete-action"
                                onClick={() => handleDelete(init)}
                              >
                                {init.status === "proposed" ? "Withdraw" : "Delete"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {rejected.length > 0 && (
            <details style={{ marginTop: "20px" }}>
              <summary style={{ cursor: "pointer", fontSize: "14px", fontWeight: 600, color: "#374151" }}>
                Rejected ({rejected.length})
              </summary>
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0 0", display: "grid", gap: "10px" }}>
                {rejected.map((init) => (
                  <li
                    key={idOf(init)}
                    className="kanban-card"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}
                  >
                    <div>
                      <h5 style={{ margin: "0 0 4px 0" }}>{init.title}</h5>
                      {init.description && (
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{init.description}</p>
                      )}
                      {Array.isArray(init.outcomes) && init.outcomes.length > 0 && (
                        <p style={{ fontSize: "12px", color: "#991b1b", margin: "6px 0 0 0" }}>{init.outcomes.join(" · ")}</p>
                      )}
                    </div>
                    <div className="kanban-actions" style={{ flexShrink: 0 }}>
                      <button type="button" className="btn-action btn-archive-action" onClick={() => handleArchive(init)}>
                        Archive
                      </button>
                      <button type="button" className="btn-action btn-delete-action" onClick={() => handleDelete(init)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      {/* EDIT MODAL */}
      {editingInit && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditingInit(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              padding: "24px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "18px",
                fontWeight: "600",
                color: "#111827",
              }}
            >
              Edit Initiative
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6b7280",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Title
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editingInit.title || ""}
                  onChange={(e) =>
                    setEditingInit({ ...editingInit, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6b7280",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Description
                </label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={editingInit.description || ""}
                  onChange={(e) =>
                    setEditingInit({
                      ...editingInit,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label
                    htmlFor="edit-init-metric"
                    style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: "4px" }}
                  >
                    Saves
                  </label>
                  <select
                    id="edit-init-metric"
                    className="form-input"
                    value={editingInit.metric || ""}
                    onChange={(e) => setEditingInit({ ...editingInit, metric: e.target.value || null })}
                  >
                    <option value="">Not measured</option>
                    {MEASURES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="edit-init-saving"
                    style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: "4px" }}
                  >
                    Expected saving a year{editingInit.metric ? ` (${measureOf(editingInit.metric)?.unit})` : ""}
                  </label>
                  <input
                    id="edit-init-saving"
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    disabled={!editingInit.metric}
                    value={editingInit.savingText ?? ""}
                    onChange={(e) => setEditingInit({ ...editingInit, savingText: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label
                    htmlFor="edit-init-cost"
                    style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: "4px" }}
                  >
                    Cost (capex)
                  </label>
                  <input
                    id="edit-init-cost"
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    value={editingInit.capexText ?? ""}
                    onChange={(e) => setEditingInit({ ...editingInit, capexText: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-init-target-date"
                    style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: "4px" }}
                  >
                    Target date
                  </label>
                  <input
                    id="edit-init-target-date"
                    type="date"
                    className="form-input"
                    value={editingInit.target_date || ""}
                    onChange={(e) => setEditingInit({ ...editingInit, target_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6b7280",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Feasible
                </label>
                <select
                  className="form-input"
                  value={editingInit.feasible !== false ? "true" : "false"}
                  onChange={(e) =>
                    setEditingInit({
                      ...editingInit,
                      feasible: e.target.value === "true",
                    })
                  }
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                className="btn-action"
                style={{ padding: "8px 16px", fontSize: "13px" }}
                onClick={() => setEditingInit(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-dark"
                style={{ padding: "8px 18px", fontSize: "13px" }}
                onClick={handleSaveEdit}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
