/**
 * CaseModals — opening a wastage case and choosing its remedy.
 *
 * A case is a *pattern* of waste the officer decides to tackle (a hotspot of
 * repeated reports, rising food weigh-ins, a meter well above last year).
 * Single incidents never come here: they are General Maintenance jobs.
 *
 * The remedy decides whether Finance is involved at all: a no-cost remedy
 * (a schedule, a policy, an awareness drive) goes straight to a target; one
 * that needs spending goes to Finance for its cost and payback first. The
 * server enforces the same rule.
 */
import { useState } from "react";
import Modal from "../components/Modal";

const KINDS = ["Energy", "Water", "Food", "Emissions"];

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
const hintStyle = { fontSize: "11px", color: "#6b7280", marginTop: "4px", lineHeight: 1.4 };

function FormError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" style={{ marginTop: "12px", fontSize: "12px", color: "#b91c1c", fontWeight: 600 }}>
      {message}
    </div>
  );
}

/**
 * "Open a wastage case" — from a signal (kind, place and the reports behind
 * it filled in) or on its own, from what the officer saw on Monitoring.
 */
export function OpenCaseModal({ signal, busy, onSubmit, onClose }) {
  const [kind, setKind] = useState(signal?.kind || "Energy");
  const [location, setLocation] = useState(signal?.location || "");
  const [title, setTitle] = useState(signal ? `${signal.kind} waste at ${signal.location}` : "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function handleConfirm() {
    if (title.trim().length < 5) return setError("Give the case a short title (at least 5 characters).");
    if (location.trim().length < 2) return setError("Say where the waste is.");
    onSubmit({
      type: kind,
      source_request_ids: signal?.ticket_ids || [],
      ...(signal?.sensor_reading_id ? { sensor_reading_id: signal.sensor_reading_id } : {}),
      details: {
        title: title.trim(),
        location: location.trim(),
        notes: notes.trim() || undefined,
        origin: signal ? signal.source : "monitoring",
        signalKey: signal?.key,
        signalReasons: signal?.reasons || [],
      },
    });
  }

  return (
    <Modal title="Open a wastage case" confirmLabel="Open case" busy={busy} onConfirm={handleConfirm} onClose={onClose} width={560}>
      {signal && (
        <div className="so-case-from">
          <strong>From the signal:</strong> {signal.reasons.join("; ") || "waste reports at this place"}
          {signal.ticket_ids.length > 0 && (
            <span>
              {" "}
              — {signal.ticket_ids.length} report{signal.ticket_ids.length === 1 ? "" : "s"} will be linked, and the people who sent
              them will hear the outcome when you close the case.
            </span>
          )}
        </div>
      )}
      <div style={{ display: "grid", gap: "12px" }}>
        <div>
          <label style={labelStyle} htmlFor="case-title">Title *</label>
          <input id="case-title" type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
          <div>
            <label style={labelStyle} htmlFor="case-kind">Kind *</label>
            <select id="case-kind" value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
              {KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="case-location">Where *</label>
            <input id="case-location" type="text" maxLength={120} value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
            {kind === "Food" && (
              <div style={hintStyle}>Use the same place name General Maintenance logs the bins under, so the target can be checked.</div>
            )}
          </div>
        </div>
        <div>
          <label style={labelStyle} htmlFor="case-notes">What you have seen (optional)</label>
          <textarea id="case-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
      </div>
      <FormError message={error} />
    </Modal>
  );
}

/** "Plan the remedy" — what will fix the cause, and whether it costs money. */
export function RemedyModal({ report, busy, onSubmit, onClose }) {
  const existing = report.details?.remedy || {};
  const [type, setType] = useState(existing.type || "");
  const [description, setDescription] = useState(existing.description || "");
  const [estimate, setEstimate] = useState(existing.estimate ? String(existing.estimate) : "");
  const [error, setError] = useState("");

  function handleConfirm() {
    if (!type) return setError("Choose whether the remedy costs money.");
    if (description.trim().length < 5) return setError("Describe the remedy in a few words.");
    const amount = Number(estimate);
    if (type === "spend" && !(amount > 0)) return setError("Give the estimated cost in rupees.");
    onSubmit({
      type,
      description: description.trim(),
      ...(type === "spend" ? { estimate: amount } : {}),
      plannedAt: new Date().toISOString(),
    });
  }

  const choice = (value, title, text) => (
    <label className={`so-choice${type === value ? " is-on" : ""}`}>
      <input type="radio" name="remedy-type" value={value} checked={type === value} onChange={() => setType(value)} />
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </label>
  );

  return (
    <Modal title="Plan the remedy" confirmLabel="Save remedy" busy={busy} onConfirm={handleConfirm} onClose={onClose} width={560}>
      <div style={{ display: "grid", gap: "10px", marginBottom: "14px" }} role="radiogroup" aria-label="Does the remedy cost money?">
        {choice("no_cost", "No cost", "A schedule, a policy, an awareness drive, housekeeping rounds. Goes straight to a target; Finance is not involved.")}
        {choice("spend", "Needs spending", "New fittings, sensors, timers, equipment. Finance works out the cost and payback before you set a target.")}
      </div>
      <div style={{ display: "grid", gap: "12px" }}>
        <div>
          <label style={labelStyle} htmlFor="remedy-desc">Remedy *</label>
          <input
            id="remedy-desc"
            type="text"
            maxLength={160}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === "spend" ? "e.g. Motion-sensor lights in LH-2" : "e.g. Switch-off round at 6 pm"}
            style={inputStyle}
          />
          <div style={hintStyle}>The people who reported the waste see this when you close the case.</div>
        </div>
        {type === "spend" && (
          <div>
            <label style={labelStyle} htmlFor="remedy-estimate">Estimated cost (₹) *</label>
            <input id="remedy-estimate" type="number" min="1" step="1" value={estimate} onChange={(e) => setEstimate(e.target.value)} style={inputStyle} />
            <div style={hintStyle}>A rough figure is enough; Finance refines it.</div>
          </div>
        )}
      </div>
      <FormError message={error} />
    </Modal>
  );
}
