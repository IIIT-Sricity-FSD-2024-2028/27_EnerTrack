/**
 * AuditModals — the three forms the Sustainability Officer fills in while
 * working a wastage report (ported from window._auditAction('dismiss'),
 * window._sendBackToFinance and window._openTargetModal in
 * js/sustainability_officer/overviewPage.js).
 *
 * Each one only checks its own fields and hands the values to onSubmit;
 * the parent (WastageAuditQueue) does the saving.
 */
import { useState } from "react";
import Modal from "../components/Modal";

const DISMISS_REASONS = ["False Alarm", "Insufficient Evidence", "Already Addressed", "Out of Scope", "Other"];

const METRIC_UNITS = { Energy: "kWh", Water: "L", Emissions: "kg CO2e", Food: "kg" };

const TARGET_HELP = {
  Energy: "Set a realistic reduction target in kWh for the reported wastage zone.",
  Water: "Set a capped water loss target in liters for the identified location.",
  Emissions: "Set an emissions reduction target in kg CO2e for this source.",
  Food: "Set an upper limit for food wastage (kg) for this cafeteria area.",
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

/** "Dismiss Report With Reason" — reason + explanation shown to the end user. */
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
    <Modal title="Dismiss Report With Reason" confirmLabel="Confirm Dismissal" danger busy={busy} onConfirm={handleConfirm} onClose={onClose}>
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
          This will close <strong>Report #{report.shortId}</strong>, notify the end user, and move it to archives.
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
          <div style={hintStyle}>This explanation is shown to the end user in their dismissal notice.</div>
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
        Explain what changes are needed for report <strong>#{report.shortId}</strong>:
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
  const unit = sd.readingUnit || METRIC_UNITS[metricType] || "units";
  const measured = Number(sd.readingValue);
  const baseline = Number(sd.baselineValue);
  const userEstimate = Number(report.specificData?.reportedValue);
  const suggested = Number.isFinite(measured) && measured > 0 ? (measured * 0.85).toFixed(2) : "";
  const existing = report.metricTarget || {};
  const today = new Date().toISOString().split("T")[0];
  const show = (n) => (Number.isFinite(n) ? n : "—");

  const [value, setValue] = useState(String(existing.value ?? suggested ?? ""));
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
          <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>Current {metricType} Value</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#059669" }}>
            {show(measured)} <small style={{ fontSize: "13px" }}>{unit}</small>
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#6b7280", textAlign: "right" }}>
          Report #{report.shortId}
          <br />
          {metricType} Wastage
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
        <div>
          Measured current: <strong>{show(measured)} {unit}</strong> | Baseline: <strong>{show(baseline)} {unit}</strong> | End-user
          estimate: <strong>{show(userEstimate)} {report.specificData?.reportedUnit || unit}</strong>
        </div>
        <div>
          Recommended starting target: <strong>{suggested || "—"} {unit}</strong> (about 15% below current measured value).
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
          <div style={hintStyle}>
            Use the same unit as the measured/estimated wastage value shown above. Keep the target lower than the current measured
            value whenever possible.
          </div>
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
