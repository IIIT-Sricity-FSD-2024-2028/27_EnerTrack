import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "../../ui/useToast";
import {
  createTarget,
  fetchTargets,
  removeTarget,
  selectAllTargets,
  selectTargetsError,
  selectTargetsStatus,
} from "../../store/slices/targetsSlice";
import {
  fetchBuildings,
  selectAllBuildings,
} from "../../store/slices/buildingsSlice";
import { useAuth } from "../../auth/useAuth";
import TargetCard from "./components/TargetCard";
import { addMonths, lastFullMonth, periodName } from "./periods";
import sustLayoutCss from "./sustainability.css?inline";
import "./components/targets.css";

const METRICS = [
  { value: "energy_kwh", label: "Electricity", noun: "electricity" },
  { value: "water_kl", label: "Water", noun: "water" },
  { value: "gas_m3", label: "Natural gas", noun: "natural gas" },
  { value: "emissions_kg", label: "Emissions (Scope 1 + 2)", noun: "emissions" },
];

/** Baseline years with a complete year of finished months, newest first. */
function baselineYears(last) {
  const y = Number(last.slice(0, 4));
  const latestFull = last.endsWith("-12") ? y : y - 1;
  return [latestFull, latestFull - 1].filter((year) => year >= 2025).map(String);
}

export default function SustainabilityTargets() {
  const { user } = useAuth();
  const [last] = useState(() => lastFullMonth());
  const years = baselineYears(last);
  const firstOpenMonth = addMonths(last, 1);

  const dispatch = useDispatch();
  const targets = useSelector(selectAllTargets);
  const buildings = useSelector(selectAllBuildings);
  const status = useSelector(selectTargetsStatus);
  const loadError = useSelector(selectTargetsError);
  const loading = status === "idle" || status === "loading";
  const showToast = useToast();

  // Default to a measure without an open campus-wide target until edited.
  const [selectedMetric, setMetric] = useState(null);
  const freeMetric = METRICS.find(({ value }) => !targets.some((target) =>
    target.metric === value && target.building_ids.length === 0 &&
    (target.status === "proposed" || target.status === "active"),
  ));
  const metric = selectedMetric ?? freeMetric?.value ?? METRICS[0].value;
  const [reduction, setReduction] = useState("10");
  const [baselineYear, setBaselineYear] = useState(years[0] || "2025");
  const [deadline, setDeadline] = useState(`${Number(last.slice(0, 4)) + 1}-12`);
  const [scope, setScope] = useState([]);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    dispatch(fetchTargets({ force: true }));
    dispatch(fetchBuildings());
  }, [dispatch]);

  const metricInfo = METRICS.find((m) => m.value === metric);
  const reductionNum = Number(reduction);
  const scopeNames = scope.map((id) => buildings.find((b) => b.building_id === id)?.name).filter(Boolean);
  const preview =
    reductionNum > 0 && deadline
      ? `Cut ${metricInfo.noun}${scopeNames.length ? ` in ${scopeNames.join(", ")}` : ""} by ${reductionNum}% against ${baselineYear} by ${periodName(deadline)}.`
      : null;

  // The server allows one open (proposed or active) target per measure and
  // scope; say so before submitting rather than after.
  const sameScope = (t) => [...t.building_ids].sort().join() === [...scope].sort().join();
  const clash = targets.find(
    (t) => t.metric === metric && sameScope(t) && (t.status === "proposed" || t.status === "active"),
  );

  const toggleBuilding = (id) =>
    setScope((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const handlePropose = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!(reductionNum > 0 && reductionNum <= 100)) {
      setFormError("Enter a reduction between 0.1 and 100 percent.");
      return;
    }
    if (!deadline || deadline < firstOpenMonth) {
      setFormError(`The deadline must be ${periodName(firstOpenMonth)} or later.`);
      return;
    }
    setSaving(true);
    try {
      await dispatch(createTarget({
        metric,
        baseline_from: `${baselineYear}-01`,
        baseline_to: `${baselineYear}-12`,
        reduction_pct: reductionNum,
        deadline,
        building_ids: scope,
        ...(note.trim() ? { note: note.trim() } : {}),
      })).unwrap();
      showToast("Target proposed. The Organization Admin has been asked to approve it.", "success");
      setNote("");
      setScope([]);
    } catch (err) {
      setFormError(err.message || "The target could not be proposed.");
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async (t) => {
    if (!window.confirm("Withdraw this proposed target?")) return;
    setBusyId(t.target_id);
    try {
      await dispatch(removeTarget(t.target_id)).unwrap();
      showToast("Proposal withdrawn.", "success");
    } catch (err) {
      showToast(err.message || "Could not withdraw the proposal.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const active = targets.filter((t) => t.status === "active");
  const waiting = targets.filter((t) => t.status === "proposed");
  const closed = targets.filter((t) => ["met", "missed", "rejected"].includes(t.status));

  return (
    <div className="sustainability-targets-page" style={{ width: "100%" }}>
      <style>{sustLayoutCss}</style>

      <header style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "26px", fontWeight: 700, color: "#111827" }}>Targets</h1>
        <p style={{ margin: 0, color: "#4b5563", fontSize: "14px" }}>
          Set reduction targets against a past year. The Organization Admin approves them, then progress is measured
          from meter readings each month.
        </p>
      </header>

      {loadError && (
        <p role="alert" className="tempty" style={{ color: "#991b1b", borderStyle: "solid", marginBottom: "16px" }}>
          {loadError}{" "}
          <button type="button" className="tbtn" onClick={() => dispatch(fetchTargets({ force: true }))}>
            Retry
          </button>
        </p>
      )}

      <section className="tsection" aria-labelledby="active-heading">
        <h2 id="active-heading">Active</h2>
        <p>The black line on each bar is where the target should be by now.</p>
        {loading ? (
          <p className="tempty">Loading targets…</p>
        ) : active.length === 0 ? (
          <p className="tempty">No active targets. Propose one below.</p>
        ) : (
          <div className="tlist">
            {active.map((t) => (
              <TargetCard key={t.target_id} target={t} />
            ))}
          </div>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="tsection" aria-labelledby="waiting-heading">
          <h2 id="waiting-heading">Waiting for approval</h2>
          <div className="tlist">
            {waiting.map((t) => (
              <TargetCard
                key={t.target_id}
                target={t}
                actions={
                  t.created_by_id === user?.user_id ? (
                    <button type="button" className="tbtn tbtn--danger" disabled={busyId === t.target_id} onClick={() => handleWithdraw(t)}>
                      Withdraw
                    </button>
                  ) : null
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="tsection" aria-labelledby="propose-heading">
        <form className="tform" onSubmit={handlePropose} noValidate>
          <h2 id="propose-heading">Propose a target</h2>
          <p>Measured month by month against the same month of the baseline year.</p>

          <div className="tform__grid">
            <div className="tform__field">
              <label htmlFor="tMetric">Measure</label>
              <select
                id="tMetric"
                value={metric}
                onChange={(e) => {
                  setMetric(e.target.value);
                }}
              >
                {METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="tform__field">
              <label htmlFor="tReduction">Reduction (%)</label>
              <input id="tReduction" type="number" inputMode="decimal" min="0.1" max="100" step="0.1" value={reduction} onChange={(e) => setReduction(e.target.value)} />
            </div>
            <div className="tform__field">
              <label htmlFor="tBaseline">Against</label>
              <select id="tBaseline" value={baselineYear} onChange={(e) => setBaselineYear(e.target.value)}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="tform__field">
              <label htmlFor="tDeadline">By the end of</label>
              <input id="tDeadline" type="month" min={firstOpenMonth} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>

            <fieldset className="tform__field tform__wide" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="tform__legend">Buildings (leave all unticked for the whole campus)</legend>
              <div className="tform__buildings">
                {buildings.map((b) => (
                  <label key={b.building_id}>
                    <input type="checkbox" checked={scope.includes(b.building_id)} onChange={() => toggleBuilding(b.building_id)} />
                    {b.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="tform__field tform__wide">
              <label htmlFor="tNote">Note for the approver (optional)</label>
              <textarea id="tNote" rows="2" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="How it will be achieved" />
            </div>
          </div>

          {clash ? (
            <p className="tform__error" role="status">
              There is already {clash.status === "active" ? "an active" : "a proposed"} {metricInfo.noun} target for
              {scope.length ? " these buildings" : " the whole campus"}. Choose another measure or different buildings.
            </p>
          ) : (
            preview && <p className="tform__preview">{preview}</p>
          )}
          {formError && (
            <p className="tform__error" role="alert">
              {formError}
            </p>
          )}
          <div className="tform__actions">
            <button type="submit" className="tbtn tbtn--primary" disabled={saving || !!clash}>
              {saving ? "Proposing…" : "Propose target"}
            </button>
          </div>
        </form>
      </section>

      {closed.length > 0 && (
        <section className="tsection" aria-labelledby="closed-heading">
          <details>
            <summary id="closed-heading" style={{ cursor: "pointer", fontSize: "16px", fontWeight: 600, color: "#111827" }}>
              Closed and not approved ({closed.length})
            </summary>
            <div className="tlist" style={{ marginTop: "12px" }}>
              {closed.map((t) => (
                <TargetCard key={t.target_id} target={t} />
              ))}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
