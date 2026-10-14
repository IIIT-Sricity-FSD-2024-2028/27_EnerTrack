import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import initiativesCss from "../../styles/sustainability_officer/sust_initiatives.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

const STATE_ORDER = ["proposed", "approved", "in-progress", "completed"];

const TIMELINE_OPTIONS = [
  { value: "3 weeks - Assessment -> Procurement -> Install", label: "3 weeks" },
  { value: "6 weeks - Assessment -> Procurement -> Install -> QA", label: "6 weeks" },
  { value: "8 weeks - Assessment -> Procurement -> Install -> Validation", label: "8 weeks" },
  { value: "12 weeks - Multi-phase rollout", label: "12 weeks" },
];

const INITIAL_DEMO_INITIATIVES = [
  {
    initiative_id: "iiii0000-0004-4000-8000-000000000000",
    title: "Greywater Harvesting System",
    description:
      "Install greywater collection and filtration systems in the dormitories to reuse water for landscaping and non-potable campus needs.",
    status: "proposed",
    feasible: true,
    target_reduction: "25%",
    onTrack: true,
    outcomes: [],
  },
  {
    initiative_id: "iiii0000-0006-4000-8000-000000000000",
    title: "Water Pressure Optimization",
    description:
      "Install pressure reducing valves (PRVs) across the campus water distribution network to minimize leakage rates and fixture wear.",
    status: "proposed",
    feasible: true,
    target_reduction: "8%",
    onTrack: true,
    outcomes: [],
  },
  {
    initiative_id: "iiii0000-0003-4000-8000-000000000000",
    title: "Cafeteria Food Waste Composting",
    description:
      "Establish a dedicated composting stream for pre-consumer and post-consumer food waste in all main dining halls to divert organic waste from landfills.",
    status: "approved",
    feasible: true,
    target_reduction: "40%",
    onTrack: true,
    outcomes: [],
  },
  {
    initiative_id: "iiii0000-0002-4000-8000-000000000000",
    title: "Smart HVAC Automation",
    description:
      "Implement occupancy-based smart thermostats and automated scheduling for the campus HVAC system to prevent heating/cooling in unoccupied zones.",
    status: "in-progress",
    feasible: true,
    target_reduction: "12%",
    onTrack: true,
    outcomes: [],
  },
  {
    initiative_id: "iiii0000-0001-4000-8000-000000000000",
    title: "LED Campus-Wide Retrofit",
    description:
      "Replace all remaining fluorescent and incandescent bulbs with high-efficiency LED lighting in all administrative and academic buildings to lower baseline energy consumption.",
    status: "completed",
    feasible: true,
    target_reduction: "15%",
    onTrack: true,
    outcomes: [
      "Reduced lighting energy load by 18%",
      "Decreased maintenance costs for replacements",
    ],
  },
];

function getNextState(status) {
  const idx = STATE_ORDER.indexOf(status);
  return idx < STATE_ORDER.length - 1 ? STATE_ORDER[idx + 1] : null;
}

function getPrevState(status) {
  const idx = STATE_ORDER.indexOf(status);
  return idx > 0 ? STATE_ORDER[idx - 1] : null;
}

function formatStatus(status) {
  const map = {
    proposed: "Proposed",
    approved: "Approved",
    "in-progress": "In Progress",
    completed: "Completed",
  };
  return map[status] || status;
}

function normalizeStatus(status) {
  if (!status) return "proposed";
  const s = status.toLowerCase().replace(/_/g, "-");
  return STATE_ORDER.includes(s) ? s : "proposed";
}

export default function SustainabilityInitiatives() {
  const { user } = useAuth();
  const [initiatives, setInitiatives] = useState(INITIAL_DEMO_INITIATIVES);
  const [toast, setToast] = useState(null);

  // New initiative form fields
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newTimeline, setNewTimeline] = useState("3 weeks");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const selectRef = useRef(null);

  // Edit modal
  const [editingInit, setEditingInit] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Close timeline dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setTimelineOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch backend initiatives with fallback to initial data
  useEffect(() => {
    let active = true;

    api
      .get("/initiatives")
      .then((res) => {
        if (!active) return;
        const data = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(data) && data.length > 0) {
          const normalized = data
            .map((item) => ({
              ...item,
              status: normalizeStatus(item.status),
              onTrack: item.onTrack !== false,
            }))
            .filter((item) => STATE_ORDER.includes(item.status));

          if (normalized.length > 0) {
            setInitiatives(normalized);
          }
        }
      })
      .catch((err) => {
        console.warn("[Initiatives] API fetch failed, keeping demo data:", err);
      });

    return () => {
      active = false;
    };
  }, []);

  // Toggle onTrack / offtrack
  const handleToggleTrack = (id, isOn) => {
    setInitiatives((prev) =>
      prev.map((i) =>
        (i.initiative_id || i.id) === id ? { ...i, onTrack: isOn } : i,
      ),
    );

    api.patch(`/initiatives/${id}`, { onTrack: isOn }).catch((err) => {
      console.warn("[Initiatives] Track patch failed:", err);
    });

    showToast(
      isOn ? "Marked 'On Track'" : "Marked 'Off Track'",
      isOn ? "success" : "warning",
    );
  };

  // State advancement
  const handleMoveState = (id, nextState) => {
    setInitiatives((prev) =>
      prev.map((i) =>
        (i.initiative_id || i.id) === id ? { ...i, status: nextState } : i,
      ),
    );

    api.patch(`/initiatives/${id}`, { status: nextState }).catch((err) => {
      console.warn("[Initiatives] Status patch failed:", err);
    });

    showToast(`Moved to ${formatStatus(nextState)}`, "success");
  };

  // Propose new initiative from top bar
  const handlePropose = (e) => {
    if (e) e.preventDefault();

    const title = newTitle.trim();
    const desc = newDesc.trim();
    const target = newTarget.trim();

    if (!title) {
      showToast("Title is required.", "error");
      return;
    }
    if (!desc) {
      showToast("Description is required.", "error");
      return;
    }
    if (!target) {
      showToast("Target Reduction is required.", "error");
      return;
    }

    const payload = {
      created_by_id:
        user?.user_id || "550e8400-0005-4000-8000-000000000005",
      title,
      description: desc,
      status: "proposed",
      feasible: true,
      onTrack: true,
      target_reduction: target.includes("%") ? target : `${target}%`,
      outcomes: [],
      cost: newCost.trim() ? newCost.trim() : undefined,
      timeline: newTimeline,
    };

    api
      .post("/initiatives", payload)
      .then((res) => {
        const created = res?.initiative_id
          ? { ...res, onTrack: true }
          : { ...payload, initiative_id: `iiii-${Date.now()}` };
        setInitiatives((prev) => [created, ...prev]);
        showToast("Initiative proposed successfully!", "success");
      })
      .catch((err) => {
        console.warn("[Initiatives] Propose error, saving locally:", err);
        const fallback = { ...payload, initiative_id: `iiii-${Date.now()}` };
        setInitiatives((prev) => [fallback, ...prev]);
        showToast("Initiative proposed successfully!", "success");
      });

    // Reset inputs
    setNewTitle("");
    setNewDesc("");
    setNewTarget("");
    setNewCost("");
    setNewTimeline("3 weeks");
  };

  // Delete initiative
  const handleDelete = (id) => {
    setInitiatives((prev) =>
      prev.filter((i) => (i.initiative_id || i.id) !== id),
    );

    api.delete(`/initiatives/${id}`).catch((err) => {
      console.warn("[Initiatives] Delete failed:", err);
    });

    showToast("Initiative removed.", "success");
  };

  // Archive completed initiative
  const handleArchive = (init) => {
    const id = init.initiative_id || init.id;
    try {
      const raw = localStorage.getItem("enertrack_universal_v1");
      const data = raw ? JSON.parse(raw) : { sust: { initiativeArchives: [] } };
      if (!data.sust) data.sust = {};
      if (!data.sust.initiativeArchives) data.sust.initiativeArchives = [];

      data.sust.initiativeArchives.push({
        id,
        title: init.title,
        status: init.status,
        target: init.target_reduction,
        outcomes: init.outcomes,
        archivedAt: new Date().toISOString(),
      });

      localStorage.setItem("enertrack_universal_v1", JSON.stringify(data));
    } catch (e) {
      console.warn("[Initiatives] Failed to archive locally:", e);
    }

    setInitiatives((prev) =>
      prev.filter((i) => (i.initiative_id || i.id) !== id),
    );

    api.delete(`/initiatives/${id}`).catch((err) => {
      console.warn("[Initiatives] Server archive delete fallback:", err);
    });

    showToast("Initiative archived", "info");
  };

  // Save changes from Edit Modal
  const handleSaveEdit = () => {
    if (!editingInit) return;
    const title = editingInit.title?.trim();
    if (!title) {
      showToast("Title is required.", "error");
      return;
    }

    const id = editingInit.initiative_id || editingInit.id;
    const patch = {
      title,
      description: editingInit.description || "",
      target_reduction: editingInit.target_reduction || "",
      status: editingInit.status,
      feasible: editingInit.feasible,
    };

    setInitiatives((prev) =>
      prev.map((i) => ((i.initiative_id || i.id) === id ? { ...i, ...patch } : i)),
    );

    api.patch(`/initiatives/${id}`, patch).catch((err) => {
      console.warn("[Initiatives] Edit patch failed:", err);
    });

    setEditingInit(null);
    showToast("Initiative updated", "success");
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
          <h1>Sustainable Conservation Initiatives</h1>
          <p>
            Track, manage, and evaluate energy-saving initiatives across all
            monitored sites.
          </p>
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
              <label className="form-label" htmlFor="new-init-target">Target %</label>
              <input
                type="text"
                id="new-init-target"
                className="form-input"
                placeholder="e.g. 7.5"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-init-cost">Cost</label>
              <input
                type="text"
                id="new-init-cost"
                className="form-input"
                placeholder="e.g. 56500"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
              />
            </div>
            <div className="form-group" ref={selectRef}>
              <label className="form-label">Timeline</label>
              <div
                className={`custom-select ${timelineOpen ? "open" : ""}`}
                id="new-init-timeline"
              >
                <button
                  type="button"
                  className="select-trigger"
                  aria-expanded={timelineOpen}
                  onClick={() => setTimelineOpen((prev) => !prev)}
                >
                  <span className="select-value">{newTimeline}</span>
                  <span className="select-chevron" aria-hidden="true">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                <div className="select-menu">
                  {TIMELINE_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      className={`select-option ${newTimeline === opt.label ? "selected" : ""}`}
                      onClick={() => {
                        setNewTimeline(opt.label);
                        setTimelineOpen(false);
                      }}
                    >
                      <span>{opt.label}</span>
                      <span className="checkmark">
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-dark btn-propose"
              onClick={handlePropose}
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
              Propose
            </button>
          </div>
        </section>

        {/* PIPELINE (full width) */}
        <section className="panel">
          <h2 className="panel-title">Initiative pipeline</h2>
          <p className="panel-sub">
            Proposed → Approved → In Progress → Completed.
          </p>

          <div className="pipeline-grid">
            {STATE_ORDER.map((statusKey) => {
              const colItems = initiatives.filter(
                (i) => i.status === statusKey,
              );

              return (
                <div key={statusKey} className="pipeline-col">
                  <h4>{formatStatus(statusKey)}</h4>
                  <div id={`col-${statusKey}`}>
                    {colItems.map((init) => {
                      const id = init.initiative_id || init.id;
                      const nextState = getNextState(init.status);
                      const prevState = getPrevState(init.status);

                      return (
                        <div
                          key={id}
                          className={`kanban-card ${init.onTrack === false ? "offtrack" : ""}`}
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

                          <div className="kanban-stats">
                            <div className="kanban-stats-label">
                              Target Reduction
                            </div>
                            <div className="kanban-stats-val">
                              {init.target_reduction || "—"}
                            </div>
                            <div className="kanban-stats-label">Feasible</div>
                            <div className="kanban-stats-val">
                              {init.feasible !== false ? "Yes" : "No"}
                            </div>
                          </div>

                          {init.status === "completed" &&
                            init.outcomes &&
                            init.outcomes.length > 0 && (
                              <div className="kanban-outcomes">
                                {init.outcomes.map((o, idx) => (
                                  <div key={idx} className="outcome-pill">
                                    {o}
                                  </div>
                                ))}
                              </div>
                            )}

                          {init.status !== "completed" && (
                            <div className="kanban-track-toggle">
                              <button
                                type="button"
                                className={`track-btn ${init.onTrack !== false ? "active on" : ""}`}
                                onClick={() => handleToggleTrack(id, true)}
                              >
                                On Track
                              </button>
                              <button
                                type="button"
                                className={`track-btn ${init.onTrack === false ? "active off" : ""}`}
                                onClick={() => handleToggleTrack(id, false)}
                              >
                                Off Track
                              </button>
                            </div>
                          )}

                          <div className="kanban-state-row">
                            {prevState && (
                              <button
                                type="button"
                                className="btn-state btn-state-prev"
                                onClick={() => handleMoveState(id, prevState)}
                              >
                                ← {formatStatus(prevState)}
                              </button>
                            )}
                            {nextState && (
                              <button
                                type="button"
                                className="btn-state btn-state-next"
                                onClick={() => handleMoveState(id, nextState)}
                              >
                                {formatStatus(nextState)} →
                              </button>
                            )}
                          </div>

                          <div className="kanban-actions">
                            <button
                              type="button"
                              className="btn-action btn-edit-action"
                              onClick={() => setEditingInit({ ...init })}
                            >
                              Edit
                            </button>
                            {init.status === "completed" && (
                              <button
                                type="button"
                                className="btn-action btn-archive-action"
                                onClick={() => handleArchive(init)}
                              >
                                Archive
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-action btn-delete-action"
                              onClick={() => handleDelete(id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
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
                  Target Reduction
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editingInit.target_reduction || ""}
                  onChange={(e) =>
                    setEditingInit({
                      ...editingInit,
                      target_reduction: e.target.value,
                    })
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
                  Status
                </label>
                <select
                  className="form-input"
                  value={editingInit.status || "proposed"}
                  onChange={(e) =>
                    setEditingInit({ ...editingInit, status: e.target.value })
                  }
                >
                  <option value="proposed">Proposed</option>
                  <option value="approved">Approved</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
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
