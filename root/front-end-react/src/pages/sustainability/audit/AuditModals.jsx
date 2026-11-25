/**
 * AuditModals — the forms the Sustainability Officer fills in while working
 * a wastage case: dismiss, send back to Finance, set a target, and check
 * whether the target was met. (Opening a case and planning its remedy are
 * in CaseModals.)
 *
 * Each one only checks its own fields and hands the values to onSubmit;
 * the parent (WastageAuditQueue) does the saving.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import Modal from "../components/Modal";

const DISMISS_REASONS = ["One-off, not a pattern", "Already addressed", "Insufficient evidence", "Out of scope", "Other"];

// Food targets are checked against General Maintenance's daily weigh-ins.
const METRIC_UNITS = { Energy: "kWh", Water: "L", Emissions: "kg CO2e", Food: "kg/day" };

const TARGET_HELP = {
  Energy: "Set a realistic reduction target in kWh for the reported wastage zone.",
  Water: "Set a capped water loss target in liters for the identified location.",
  Emissions: "Set an emissions reduction target in kg CO2e for this source.",
  Food: "Set an upper limit for food thrown away, in kg a day. It is checked against General Maintenance's bin weigh-ins for this place.",
};

const TARGET_PLACEHOLDER = { Energy: "120", Water: "650", Emissions: "45", Food: "18" };

const labelStyle = { display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" };
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 11px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "14px",
  color: "#1f2937",
  background: "#fff",
  fontFamily: "inherit",
};
const hintStyle = { fontSize: "11px", color: "#9ca3af", marginTop: "4px", lineHeight: 1.4 };

function FormError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" style={{ marginTop: "12px", fontSize: "12px", color: "#b91c1c", fontWeight: 600 }}>
      {message}
    </div>
  );
}

/** "Dismiss case" — the reason is kept on the case's record. */
export function DismissModal({ report, busy, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  function handleConfirm() {
    if (!reason) return setError("Please select a reason for dismissal.");
    if (comment.trim().length < 10) return setError("Explanation must be at least 10 characters.");
    onSubmit({ reason, comment: comment.trim() });
  }

  return (
    <Modal title="Dismiss case" confirmLabel="Dismiss case" danger busy={busy} onConfirm={handleConfirm} onClose={onClose}>
      <div
        style={{
          marginBottom: "12px",
          background: "linear-gradient(135deg,#fff1f2,#ffe4e6)",
          border: "1px solid #fecdd3",
          borderRadius: "12px",
          padding: "12px 14px",
        }}
      >
        <strong style={{ fontSize: "13px", color: "#9f1239" }}>Dismissal Confirmation</strong>
        <div style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.5, marginTop: "4px" }}>
          This closes case <strong>WR-{report.shortId}</strong> without action and moves it to archives. The waste reports behind it
          stay as they are.
        </div>
      </div>
      <div style={{ display: "grid", gap: "12px" }}>
        <div>
          <label style={labelStyle} htmlFor="dismiss-reason">Reason *</label>
          <select id="dismiss-reason" value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle}>
            <option value="">Select a reason...</option>
            {DISMISS_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="dismiss-comment">Explanation *</label>
          <textarea
            id="dismiss-comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Provide clear details (minimum 10 characters)..."
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <div style={hintStyle}>Kept on the case so you (and Finance) can see why it was dropped.</div>
        </div>
      </div>
      <FormError message={error} />
    </Modal>
  );
}

/** "Send Back to Finance Analyst" — what the analyst needs to revise. */
export function SendBackModal({ report, busy, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function handleConfirm() {
    if (!reason.trim()) return setError("Please explain what changes are needed.");
    onSubmit({ reason: reason.trim(), notes: notes.trim() });
  }

  return (
    <Modal title="↻ Send Back to Finance Analyst" confirmLabel="Send Back" busy={busy} onConfirm={handleConfirm} onClose={onClose}>
      <div style={{ marginBottom: "10px", fontSize: "13px", color: "#6b7280" }}>
        Explain what changes are needed for case <strong>WR-{report.shortId}</strong>:
      </div>
      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle} htmlFor="sb-reason">What needs to be revised? *</label>
        <textarea
          id="sb-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. The remediation cost seems too high, please re-assess..."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="sb-notes">Additional notes (optional)</label>
        <input
          id="sb-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any extra context..."
          style={inputStyle}
        />
      </div>
      <FormError message={error} />
    </Modal>
  );
}

/** "Set New <Type> Target" — also used for "Edit Target". */
export function TargetModal({ report, busy, onSubmit, onClose }) {
  const sd = report.systemData || {};
  const metricType = report.type || "Energy";
  const isFood = metricType === "Food";
  const place = report.details?.location || "";
  const unit = isFood ? METRIC_UNITS.Food : sd.readingUnit || METRIC_UNITS[metricType] || "units";
  const existing = report.metricTarget || {};
  const today = new Date().toISOString().split("T")[0];
  const show = (n) => (Number.isFinite(n) ? n : "—");

  // Food: the current figure is the last 30 days of weigh-ins for the place.
  const [food, setFood] = useState(null);
  useEffect(() => {
    if (!isFood) return undefined;
    let live = true;
    api
      .get("/food-waste-logs/summary")
      .then((rows) => {
        if (!live) return;
        const key = place.trim().toLowerCase().replace(/\s+/g, " ");
        const row = (Array.isArray(rows) ? rows : []).find((r) => r.location.trim().toLowerCase().replace(/\s+/g, " ") === key);
        setFood(row || false);
      })
      .catch(() => live && setFood(false));
    return () => {
      live = false;
    };
  }, [isFood, place]);

  const measured = isFood ? Number(food?.kg_per_day_30d) : Number(sd.readingValue);
  const baseline = isFood ? Number(food?.kg_per_day_7d) : Number(sd.baselineValue);
  const suggested = Number.isFinite(measured) && measured > 0 ? (measured * 0.85).toFixed(isFood ? 1 : 2) : "";

  // Until the officer types, the box shows the saved target or the suggestion
  // (which for food arrives once the weigh-ins load).
  const [typed, setValue] = useState(existing.value != null ? String(existing.value) : null);
  const value = typed ?? String(suggested || "");
  const [deadline, setDeadline] = useState(existing.deadline || "");
  const [error, setError] = useState("");

  function handleConfirm() {
    const num = Number(value);
    if (!value.trim() || isNaN(num) || num <= 0) return setError("Please enter a valid positive target value.");
    if (!deadline) return setError("Please select a target deadline.");
    if (deadline < today) return setError("The deadline cannot be in the past.");
    onSubmit({ value: num, unit, deadline });
  }

  return (
    <Modal title={`Set New ${metricType} Target`} confirmLabel="Set Target" busy={busy} onConfirm={handleConfirm} onClose={onClose}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "14px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>
            {isFood ? "Food thrown away, last 30 days" : `Current ${metricType} value`}
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#059669" }}>
            {show(measured)} <small style={{ fontSize: "13px" }}>{unit}</small>
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#6b7280", textAlign: "right" }}>
          Case WR-{report.shortId}
          <br />
          {place || `${metricType} waste`}
        </div>
      </div>
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
          padding: "10px",
          marginBottom: "14px",
          fontSize: "12px",
          color: "#334155",
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 600, color: "#1d4ed8", marginBottom: "6px" }}>How to set this target</div>
        <div>{TARGET_HELP[metricType] || TARGET_HELP.Energy}</div>
        {isFood ? (
          food === false ? (
            <div>
              No weigh-ins are logged for <strong>{place || "this place"}</strong> yet. Ask General Maintenance to log the bins there,
              or the target cannot be checked.
            </div>
          ) : (
            <div>
              Last 30 days: <strong>{show(measured)} {unit}</strong> | Last 7 days: <strong>{show(baseline)} {unit}</strong>
            </div>
          )
        ) : (
          <div>
            Measured current: <strong>{show(measured)} {unit}</strong> | Baseline: <strong>{show(baseline)} {unit}</strong>
          </div>
        )}
        <div>
          Recommended starting target: <strong>{suggested || "—"} {unit}</strong> (about 15% below the current figure).
        </div>
      </div>
      <div style={{ display: "grid", gap: "12px" }}>
        <div>
          <label style={labelStyle} htmlFor="mt-value">New Target Value ({unit}) *</label>
          <input
            id="mt-value"
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`e.g. ${TARGET_PLACEHOLDER[metricType] || "100"}`}
            style={inputStyle}
          />
          <div style={hintStyle}>Use the unit shown above, and keep the target below the current figure.</div>
        </div>
        <div>
          <label style={labelStyle} htmlFor="mt-deadline">Target Deadline *</label>
          <input id="mt-deadline" type="date" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} style={inputStyle} />
          <div style={hintStyle}>Pick a date by which this target should be met and verified in the next audit cycle.</div>
        </div>
      </div>
      <FormError message={error} />
    </Modal>
  );
}

/**
 * "Check the result" — after a target's deadline (or early), the evidence
 * from the report's meter and the officer's decision: met or missed.
 * The server suggests an outcome when it can measure one; the officer
 * decides either way.
 */
export function VerifyTargetModal({ report, busy, onSubmit, onClose }) {
  const [check, setCheck] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api
      .get(`/wastage-reports/${report.id}/target-check`)
      .then((res) => live && setCheck(res))
      .catch((err) => live && setError(err.message || "The readings could not be loaded."));
    return () => {
      live = false;
    };
  }, [report.id]);

  const t = check?.target || report.metricTarget || {};
  const food = check?.food || null;
  const pct = (n) => (n === null || n === undefined ? "—" : `${n}%`);
  const decide = (status) =>
    onSubmit({
      status,
      outcome: {
        result: status === "Target Met" ? "met" : "missed",
        suggested: check?.suggested ?? null,
        achieved_reduction_pct: check?.achieved_reduction_pct ?? null,
        required_reduction_pct: check?.required_reduction_pct ?? null,
      },
    });

  return (
    <Modal title="Was the target met?" busy={busy} onClose={onClose} cancelLabel="Close" width={560}>
      <div className="so-check">
        <dl>
          <div>
            <dt>Target</dt>
            <dd>
              {t.value ?? "—"} {t.unit || ""} by {t.deadline || "—"}
            </dd>
          </div>
          {food ? (
            <>
              <div>
                <dt>Weigh-ins at</dt>
                <dd>{food.location || "—"}</dd>
              </div>
              <div>
                <dt>Before the target</dt>
                <dd>{food.baseline_kg_per_day ?? "—"} kg a day</dd>
              </div>
              <div>
                <dt>Since the target ({food.days_logged} days logged)</dt>
                <dd>{food.achieved_kg_per_day ?? "—"} kg a day</dd>
              </div>
            </>
          ) : (
            <div>
              <dt>Meter</dt>
              <dd>{check ? (check.meter ? check.meter.meter_code : "Not linked") : "…"}</dd>
            </div>
          )}
          <div>
            <dt>Cut the target needs</dt>
            <dd>{check ? pct(check.required_reduction_pct) : "…"}</dd>
          </div>
          <div>
            <dt>{food ? "Cut measured (vs before the target)" : "Cut measured (vs same months last year)"}</dt>
            <dd>{check ? pct(check.achieved_reduction_pct) : "…"}</dd>
          </div>
        </dl>
        {error && <p className="so-check__reason" role="alert">{error}</p>}
        {check && <p className="so-check__reason">{check.reason}</p>}
        <div className="so-check__actions">
          {["Target Met", "Target Missed"].map((s) => (
            <button
              key={s}
              type="button"
              className={`so-btn ${s === "Target Met" ? "primary" : "danger"}${check?.suggested === s ? " is-suggested" : ""}`}
              disabled={busy || !check}
              onClick={() => decide(s)}
            >
              {s === "Target Met" ? "Target met" : "Target missed"}
              {check?.suggested === s ? " (suggested)" : ""}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
