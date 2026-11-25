import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  archiveInitiative,
  createInitiative,
  fetchInitiatives,
  removeInitiative,
  requestInitiativeRework,
  selectBoardInitiatives,
  selectInitiativesByStatus,
  selectInitiativesError,
  selectInitiativesStatus,
  updateInitiative,
} from "../../store/slices/initiativesSlice";
import {
  fetchBuildings,
  selectAllBuildings,
} from "../../store/slices/buildingsSlice";
import {
  fetchTargets,
  selectAllTargets,
} from "../../store/slices/targetsSlice";
import initiativesCss from "../../styles/sustainability_officer/sust_initiatives.css?inline";
import sustLayoutCss from "./sustainability.css?inline";
import { SpendLine } from "./initiativeShared";
import { useTeams, rupees } from "./initiativeUtils";

/**
 * Board columns. Approval starts the work, so there is no "Approved" column:
 * an older record still marked approved is shown under In Progress.
 */
const STATE_ORDER = ["proposed", "in-progress", "completed"];
/** Statuses the server lets an initiative be archived from. */
const ARCHIVABLE = ["completed", "rejected"];

/**
 * The moves the Sustainability Officer makes from the board. Approving or
 * rejecting a proposal is the Organization Admin's decision (their approvals
 * page), and approving it starts the work, so the only move left is
 * completing it. The server refuses anything else.
 */
const SO_NEXT = {
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

/** Longest task a technician type can be given (the server's limit). */
const TASK_MAX = 300;

/**
 * "Does this need technicians on site?" No keeps the initiative as paperwork.
 * Yes asks which technician types and, optionally, what each must do: on
 * approval each type gets its own job, sent at once, due on the target date,
 * whose description is that task (if given) plus the initiative's description.
 */
function OnsiteFields({ idPrefix, onsite, teams, tasks, disabled, onChange }) {
  const { teams: options } = useTeams();
  const toggle = (value) =>
    onChange({ onsite, tasks, teams: teams.includes(value) ? teams.filter((t) => t !== value) : [...teams, value] });
  return (
    <fieldset className="init-onsite" disabled={disabled}>
      <legend>Does this need technicians on site?</legend>
      <div className="init-choice" role="radiogroup" aria-label="Needs technicians on site">
        {[
          { value: false, label: "No" },
          { value: true, label: "Yes" },
        ].map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={onsite === o.value}
            className={onsite === o.value ? "is-selected" : ""}
            onClick={() => onChange({ onsite: o.value, tasks, teams: o.value ? teams : [] })}
          >
            {o.label}
          </button>
        ))}
      </div>
      {onsite === true && (
        <div className="init-teams">
          <span className="init-teams-label">Technician types needed (one job each, in parallel)</span>
          {options.map((o) => (
            <div key={o.id} className="init-team">
              <label htmlFor={`${idPrefix}-team-${o.id}`}>
                <input
                  id={`${idPrefix}-team-${o.id}`}
                  type="checkbox"
                  checked={teams.includes(o.id)}
                  onChange={() => toggle(o.id)}
                />
                {o.label}
              </label>
              {teams.includes(o.id) && (
                <div className="init-task">
                  <label className="init-task-label" htmlFor={`${idPrefix}-task-${o.id}`}>
                    Task for the {o.label.toLowerCase()} <span>(optional)</span>
                  </label>
                  <textarea
                    id={`${idPrefix}-task-${o.id}`}
                    className="form-input"
                    placeholder={`What does the ${o.label.toLowerCase()} need to do?`}
                    rows={2}
                    maxLength={TASK_MAX}
                    value={tasks[o.id] || ""}
                    onChange={(e) => onChange({ onsite, teams, tasks: { ...tasks, [o.id]: e.target.value } })}
                  />
                  <span className="init-task-count">
                    {(tasks[o.id] || "").length}/{TASK_MAX}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Checks the on-site answer the way the server will; returns an error message or null. */
function onsiteProblem({ onsite, teams, targetDate }) {
  if (onsite === null || onsite === undefined) return "Answer: does this need technicians on site?";
  if (!onsite) return null;
  if (!teams.length) return "Pick the technician types the on-site work needs.";
  if (!targetDate) return "On-site work needs a target date: it is the technicians' finish date.";
  return null;
}

/** Only the ticked types' tasks that were filled in, trimmed. */
const tasksFor = (teams, tasks) =>
  Object.fromEntries(teams.map((t) => [t, (tasks[t] || "").trim()]).filter(([, task]) => task));

/**
 * Dot colour of a job: green closed, blue being checked by the coordinator,
 * amber waiting for someone to take it, grey otherwise.
 */
const jobTone = (j) =>
  !j.open ? "green" : j.stage === "Being checked" ? "blue" : j.stage === "Waiting for a person" ? "amber" : "none";

const shortDate = (iso) => formatDate(String(iso || "").slice(0, 10));

/** Where a rework request stands, in a sentence. */
function reworkStatus(r) {
  if (!r) return null;
  if (r.status === "pending") return { tone: "amber", text: `Rework requested: ${r.reason}. Waiting for the coordinator.` };
  if (r.status === "sent")
    return {
      tone: "none",
      text: `Rework sent to ${r.rework_technician_name || "a technician"}${r.rework_finish_by ? `, finish by ${shortDate(r.rework_finish_by)}` : ""}.`,
    };
  if (r.status === "declined")
    return { tone: "red", text: `Rework declined${r.decided_by_name ? ` by ${r.decided_by_name}` : ""}: ${r.note}` };
  return null;
}

/**
 * The on-site jobs of an initiative: one row per job (first try or rework),
 * with its task, who has it, where it is, its finish date and what it has
 * cost. Once a job is closed the officer can ask the coordinator for rework;
 * the coordinator decides who redoes it and by when.
 */
function InitiativeWork({ init, onRequestRework }) {
  const { label } = useTeams();
  const [asking, setAsking] = useState(null); // work_order_id being asked about
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const jobs = init.jobs || [];
  if (!jobs.length) return null;

  async function submit(job) {
    setBusy(true);
    const ok = await onRequestRework(init, job, reason.trim());
    setBusy(false);
    if (ok) {
      setAsking(null);
      setReason("");
    }
  }

  const canAsk = (j) =>
    !j.open &&
    init.status === "in-progress" &&
    j.work_order_id &&
    !jobs.some((x) => x.rework_of === j.work_order_id) &&
    (!j.rework_request || j.rework_request.status === "declined");

  return (
    <div className="init-work">
      <p className="init-work-title">Work</p>
      <ul>
        {jobs.map((j) => {
          const rs = reworkStatus(j.rework_request);
          return (
            <li key={j.ticket_id}>
              <div className="init-work-row">
                <span className={`perf-status init-work-status perf--${jobTone(j)}`}>
                  {j.team_label || label(j.team)}
                  {j.rework_of ? " (rework)" : ""}
                </span>
                <span className="init-work-stage">{j.stage}</span>
              </div>
              {j.task && <p className="perf-note init-work-task">{j.task}</p>}
              <p className="perf-note">
                {j.technician_name ? `${j.technician_name} · ` : ""}
                {j.open ? `finish by ${shortDate(j.finish_by)}` : `closed ${shortDate(j.closed_at)}`}
                {j.spent > 0 ? ` · spent ${rupees(j.spent)}` : ""}
              </p>
              {j.rework_reason && <p className="perf-note">Rework of an earlier job: {j.rework_reason}</p>}
              {rs && <p className={`perf-note init-rework init-rework--${rs.tone}`}>{rs.text}</p>}
              {canAsk(j) &&
                (asking === j.work_order_id ? (
                  <div className="init-sendback">
                    <input
                      type="text"
                      className="form-input"
                      aria-label="What needs redoing"
                      placeholder="What needs redoing?"
                      value={reason}
                      maxLength={500}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="init-sendback-actions">
                      <button
                        type="button"
                        className="btn-action"
                        disabled={busy || reason.trim().length < 3}
                        onClick={() => submit(j)}
                      >
                        Send request
                      </button>
                      <button type="button" className="btn-action" onClick={() => setAsking(null)}>
                        Cancel
                      </button>
                    </div>
                    <p className="perf-note">The coordinator decides who redoes it and by when.</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-action init-sendback-open"
                    onClick={() => setAsking(j.work_order_id)}
                  >
                    Request rework
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * What the initiative has actually saved, measured from meter readings
 * against the same months last year. Replaces the old manual on/off-track
 * toggle.
 *
 *   ● On track                    133% of expected
 *   53,020 kWh saved
 *   ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 *   40,000 kWh expected · 8 months vs the same months last year
 */
function Performance({ init }) {
  const p = init.performance;
  if (!p || init.status === "proposed" || init.status === "rejected") return null;

  if (!p.measurable)
    return (
      <div className="perf perf--inline">
        <span className="perf-status">Not measured</span>
        <span className="perf-note">{p.reason === "No measure chosen." ? "no measure chosen" : "not started yet"}</span>
      </div>
    );

  if (init.status === "completed" && init.verified_saving != null)
    return (
      <div className="perf perf--green">
        <span className="perf-status">Verified</span>
        <p className="perf-figure">
          <strong>
            {num(init.verified_saving)} {p.unit}
          </strong>{" "}
          verified saving
        </p>
        {init.expected_saving ? (
          <p className="perf-note">
            Expected {num(init.expected_saving)} {p.unit} a year
          </p>
        ) : null}
      </div>
    );

  if (p.months_compared === 0)
    return (
      <div className="perf">
        <span className="perf-status">Measuring</span>
        <p className="perf-note">No full months to compare yet.</p>
      </div>
    );

  const label = { green: "On track", amber: "Behind", red: "Well behind" }[p.rating] || "Measured";
  const actual = Number(p.actual_saving_to_date || 0);
  const expected = p.expected_to_date != null ? Number(p.expected_to_date) : null;
  const pct = expected > 0 ? Math.round((actual / expected) * 100) : null;
  const months = `${p.months_compared} month${p.months_compared === 1 ? "" : "s"}`;

  return (
    <div className={`perf perf--${p.rating || "none"}`}>
      <div className="perf-head">
        <span className="perf-status">{label}</span>
        {pct != null && <span className="perf-pct">{pct}% of expected</span>}
      </div>
      <p className="perf-figure">
        {actual >= 0 ? (
          <>
            <strong>
              {num(actual)} {p.unit}
            </strong>{" "}
            saved
          </>
        ) : (
          <>
            <strong>
              {num(-actual)} {p.unit}
            </strong>{" "}
            more used
          </>
        )}
      </p>
      {pct != null && (
        <div className="perf-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      )}
      <p className="perf-note">
        {expected != null && `${num(expected)} ${p.unit} expected · `}
        {months} vs the same months last year
      </p>
    </div>
  );
}

export default function SustainabilityInitiatives() {
  const dispatch = useDispatch();
  const live = useSelector(selectBoardInitiatives);
  const status = useSelector(selectInitiativesStatus);
  const loadError = useSelector(selectInitiativesError);
  const loading = status === "idle" || status === "loading";
  const proposed = useSelector((state) => selectInitiativesByStatus(state, "proposed"));
  const inProgress = useSelector((state) => selectInitiativesByStatus(state, "in-progress"));
  const completed = useSelector((state) => selectInitiativesByStatus(state, "completed"));
  const columns = { proposed, "in-progress": inProgress, completed };
  const rejected = useSelector((state) => selectInitiativesByStatus(state, "rejected"));
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
  const buildings = useSelector(selectAllBuildings);
  const targets = useSelector(selectAllTargets);
  const [newTargetId, setNewTargetId] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  // On-site work: null until the officer answers, then false or true.
  const [newOnsite, setNewOnsite] = useState(null);
  const [newTeams, setNewTeams] = useState([]);
  const [newTasks, setNewTasks] = useState({});
  const { label: teamLabel } = useTeams();
  const teamList = (teams) => (teams || []).map(teamLabel).join(", ");
  const [isProposing, setIsProposing] = useState(false);

  // Edit modal
  const [editingInit, setEditingInit] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Load the board and the optional reference data for the form and cards.
  useEffect(() => {
    dispatch(fetchInitiatives());
    dispatch(fetchBuildings());
    dispatch(fetchTargets());
  }, [dispatch]);

  const buildingName = (id) => buildings.find((b) => b.building_id === id)?.name || "a building";
  const targetSummary = (id) => targets.find((t) => t.target_id === id)?.summary;
  const linkableTargets = targets.filter(
    (t) => t.metric === newMetric && (t.status === "active" || t.status === "proposed"),
  );

  const retryLoad = () => dispatch(fetchInitiatives({ force: true }));

  // Wait for the server to validate the move and return its current jobs.
  const handleMoveState = async (id, nextState) => {
    try {
      await dispatch(updateInitiative({ id, changes: { status: nextState } })).unwrap();
      showToast(`Moved to ${formatStatus(nextState)}`, "success");
    } catch (err) {
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
    setNewOnsite(null);
    setNewTeams([]);
    setNewTasks({});
  };

  // The officer checked a closed job and it is not right: ask the
  // coordinator for rework. They decide who redoes it and by when.
  const handleRequestRework = async (init, job, reason) => {
    try {
      await dispatch(requestInitiativeRework({ id: idOf(init), workOrderId: job.work_order_id, reason })).unwrap();
      showToast(`Rework requested on the ${teamLabel(job.team)} job. The coordinator will decide who redoes it.`, "success");
      return true;
    } catch (err) {
      showToast(err.message || "Could not request rework.", "error");
      return false;
    }
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
    const onsiteError = onsiteProblem({ onsite: newOnsite, teams: newTeams, targetDate: newTargetDate });
    if (onsiteError) return showToast(onsiteError, "error");

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
      onsite_work: newOnsite === true,
      ...(newOnsite ? { teams: newTeams, team_tasks: tasksFor(newTeams, newTasks) } : {}),
    };

    setIsProposing(true);
    try {
      await dispatch(createInitiative(payload)).unwrap();
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
      await dispatch(removeInitiative(id)).unwrap();
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
      await dispatch(archiveInitiative(id)).unwrap();
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
    // Once approved, what it saves, how much and its cost are what the
    // Organization Admin agreed to; the server refuses changes (409), so
    // they are not sent.
    const termsLocked = editingInit.status !== "proposed";
    const editTeams = editingInit.teams || [];
    const editTasks = editingInit.team_tasks || {};
    if (!termsLocked) {
      const onsiteError = onsiteProblem({
        onsite: editingInit.onsite_work === true,
        teams: editTeams,
        targetDate: editingInit.target_date,
      });
      if (onsiteError) return showToast(onsiteError, "error");
    }
    const patch = {
      title,
      description: editingInit.description || "",
      feasible: editingInit.feasible,
      ...(!termsLocked && editingInit.metric ? { metric: editingInit.metric } : {}),
      ...(!termsLocked && editingInit.savingText !== undefined && String(editingInit.savingText).trim() !== ""
        ? { expected_saving: Number(String(editingInit.savingText).replace(/,/g, "")) }
        : {}),
      ...(!termsLocked && capex !== undefined ? { capex } : {}),
      ...(editingInit.target_date ? { target_date: editingInit.target_date } : {}),
      // Whether it needs technicians, and which, is part of what the admin approves.
      ...(!termsLocked
        ? {
            onsite_work: editingInit.onsite_work === true,
            ...(editingInit.onsite_work ? { teams: editTeams, team_tasks: tasksFor(editTeams, editTasks) } : {}),
          }
        : {}),
    };

    try {
      await dispatch(updateInitiative({ id, changes: patch })).unwrap();
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
          <OnsiteFields
            idPrefix="new-init"
            onsite={newOnsite}
            teams={newTeams}
            tasks={newTasks}
            onChange={({ onsite, teams, tasks }) => {
              setNewOnsite(onsite);
              setNewTeams(teams);
              setNewTasks(tasks);
            }}
          />
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
            The Organization Admin&apos;s approval starts the work and sends any
            on-site jobs. Check the work, then mark it completed.
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
              const colItems = columns[statusKey];

              return (
                <div key={statusKey} className="pipeline-col">
                  <h4>
                    {formatStatus(statusKey)} <span className="pipeline-count">{colItems.length}</span>
                  </h4>
                  <div id={`col-${statusKey}`}>
                    {colItems.map((init) => {
                      const id = idOf(init);
                      const next = SO_NEXT[statusKey];
                      const openJobs = (init.jobs || []).filter((j) => j.open).length;
                      const reworkPending = (init.jobs || []).some((j) => j.rework_request?.status === "pending");

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
                              {init.expected_saving_amount ? ` · promised ${rupees(init.expected_saving_amount)} a year` : ""}
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
                            <div className="kanban-stats-label">Technicians</div>
                            <div className="kanban-stats-val">
                              {init.onsite_work ? teamList(init.teams) : "No on-site work"}
                            </div>
                            {typeof init.capex === "number" && (
                              <>
                                <div className="kanban-stats-label">Cost</div>
                                <div className="kanban-stats-val">{rupees(init.capex)}</div>
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

                          {/* Only on-site jobs carry expense bills, so only they can spend. */}
                          {init.onsite_work && init.status !== "proposed" && <SpendLine money={init.money} />}

                          <InitiativeWork init={init} onRequestRework={handleRequestRework} />

                          <div className="kanban-state-row">
                            {init.status === "proposed" ? (
                              <p className="kanban-waiting" style={{ margin: 0, fontSize: "12px", color: "#78350f" }}>
                                Waiting for the Organization Admin to approve it.
                              </p>
                            ) : next && openJobs > 0 && next.to === "completed" ? (
                              // Completed only when every job (first try and rework) is closed.
                              <p className="kanban-waiting init-open-jobs">
                                {openJobs} job{openJobs === 1 ? "" : "s"} still open. Mark it completed once all work is done and checked.
                              </p>
                            ) : next && reworkPending ? (
                              <p className="kanban-waiting init-open-jobs">
                                Rework is waiting for the coordinator&apos;s decision. Mark it completed once that is settled.
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
                            <p className="init-decision">
                              Approved{init.decided_by_name ? ` by ${init.decided_by_name}` : ""}: {init.decision_note}
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
                      {(init.decision_note || (Array.isArray(init.outcomes) && init.outcomes.length > 0)) && (
                        <p style={{ fontSize: "12px", color: "#991b1b", margin: "6px 0 0 0" }}>
                          Rejected{init.decided_by_name ? ` by ${init.decided_by_name}` : ""}:{" "}
                          {init.decision_note || init.outcomes.join(" · ")}
                        </p>
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
              {editingInit.status !== "proposed" && (
                <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
                  What it saves, the expected saving and the cost were approved by the Organization Admin. Ask them
                  to change these.
                </p>
              )}
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
                    disabled={editingInit.status !== "proposed"}
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
                    disabled={!editingInit.metric || editingInit.status !== "proposed"}
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
                    disabled={editingInit.status !== "proposed"}
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
              <OnsiteFields
                idPrefix="edit-init"
                onsite={editingInit.onsite_work === true}
                teams={editingInit.teams || []}
                tasks={editingInit.team_tasks || {}}
                disabled={editingInit.status !== "proposed"}
                onChange={({ onsite, teams, tasks }) =>
                  setEditingInit({ ...editingInit, onsite_work: onsite, teams, team_tasks: tasks })
                }
              />
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
