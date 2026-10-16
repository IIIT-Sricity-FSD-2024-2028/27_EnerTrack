/**
 * WastageForm — the "New Wastage Report" card on /campus/wastage.
 *
 * A controlled form whose fields change with the chosen category. On submit
 * it checks the fields and the estimate, warns about a possible duplicate,
 * then hands the values UP to the parent through `onSubmit` and resets.
 *
 * When a report is selected (clicked in My Wastage Logs) it shows that
 * report read-only instead, with a "Create New Report" link.
 *
 * Props:
 *   email           signed-in user's email, shown read-only
 *   reports         the user's current reports, for the duplicate check
 *   selectedReport  the report being viewed, or null
 *   onSubmit        async function the parent gives us; called with
 *                   { type, priority, specificData, photos }
 *   onNewReport     called by "Create New Report"
 *
 * Replaces the form half of js/enduser/wastage.js.
 */
import { useEffect, useRef, useState } from "react";
import { getBaselineRange } from "../../legacy/sensorSimulator";
import DuplicateModal from "./DuplicateModal";
import {
  ESTIMATE_FIELDS,
  getLocationKey,
  getStatusInfo,
  TYPE_FIELDS,
  WASTAGE_TYPES,
} from "./wastageHelpers";

// sessionStorage key for the half-typed draft (same key the old page used)
const DRAFT_KEY = "wastageFormState";

// Field values are stored as "<category>-<field>", e.g. "Energy-building",
// so each category keeps its own values when the user switches back and forth
// (the original page did the same with separate inputs per category).
const EMPTY_FORM = { type: "", priority: "Low" };

const PRIORITIES = [
  { value: "Low", hint: "Minor wastage" },
  { value: "Medium", hint: "Significant" },
  { value: "High", hint: "Massive/Severe" },
];

const ONE_DAY = 24 * 60 * 60 * 1000; // in milliseconds

// "2 photos attached — see the report card below." (shown while viewing)
function photoNote(photoUrls) {
  const count = (photoUrls || []).length;
  if (count === 0) return "No photos attached to this report.";
  const word = count === 1 ? "photo" : "photos";
  return `${count} ${word} attached — see the report card below.`;
}

// Reads a saved draft, so a page refresh does not lose what was typed.
function loadDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    return saved ? { ...EMPTY_FORM, ...saved } : EMPTY_FORM;
  } catch {
    return EMPTY_FORM;
  }
}

export default function WastageForm({
  email,
  reports,
  selectedReport,
  onSubmit,
  onNewReport,
}) {
  // Everything typed, in one object
  const [form, setForm] = useState(loadDraft);
  // Which fields failed validation: { "Energy-building": true, ... }
  const [errors, setErrors] = useState({});
  // True while a report is being sent, so a double-click (on Log Wastage
  // Report or on the popup's Submit Anyway) sends only one. The ref blocks a
  // second click at once; the state greys out the button.
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  // Chosen photo files. A file input cannot be controlled by React, so we
  // only read from it; changing fileInputKey gives a fresh, empty one.
  const [photos, setPhotos] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  // A similar recent report, while the duplicate popup is open
  const [duplicate, setDuplicate] = useState(null);
  // Red message above the submit button (empty = hidden)
  const [message, setMessage] = useState("");

  // Save the draft every time the form changes
  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  const viewing = selectedReport !== null;
  // What the fields show: the selected report, or what the user typed
  const type = viewing ? selectedReport.type : form.type;
  const priority = viewing ? selectedReport.priority || "Low" : form.priority;
  const baseline = type ? getBaselineRange(type) : null;

  function valueOf(fieldName) {
    if (viewing) {
      const data = selectedReport.specificData || {};
      if (fieldName === "estimate") {
        const estimate =
          type === "Food" ? data.estimatedAmount : data.reportedValue;
        return estimate ?? ""; // ?? : use "" when there is no value
      }
      return data[fieldName] || "";
    }
    return form[`${type}-${fieldName}`] || "";
  }

  // One handler for every input: the input's `name` says which value changed
  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
    setErrors({ ...errors, [name]: false }); // typing clears the red border
    setMessage("");
  }

  function handlePriority(value) {
    if (!viewing) setForm({ ...form, priority: value });
  }

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser reloading the page
    if (submittingRef.current) return; // the first click is still sending
    // No category chosen yet: mark the dropdown red and stop
    if (!type) {
      setErrors({ type: true });
      return;
    }
    setMessage("");

    // 1. Required fields: every field of the chosen category, after trimming
    const newErrors = {};
    const fieldNames = [...TYPE_FIELDS[type].map((f) => f.name), "estimate"];
    fieldNames.forEach((name) => {
      if (valueOf(name).trim() === "") newErrors[`${type}-${name}`] = true;
    });
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    // 2. At most 4 photos
    if (photos.length > 4) {
      setMessage("Attach at most 4 photos.");
      return;
    }

    // 3. Collect the category's values, as the original page saved them
    const specificData = {};
    TYPE_FIELDS[type].forEach((f) => {
      specificData[f.name] = valueOf(f.name).trim();
    });
    if (type === "Food") specificData.estimatedAmount = valueOf("estimate");
    const reported = Number(valueOf("estimate"));

    // 4. The estimate must be a number of at least half the typical
    // (baseline) minimum. Zero and negative values fail the same check, so
    // they get the same message as any other too-small estimate.
    const estimateError = { [`${type}-estimate`]: true };
    if (!Number.isFinite(reported)) {
      setErrors(estimateError);
      setMessage("Please enter an estimated wastage value before submitting.");
      return;
    }
    const minimum = baseline.min * 0.5;
    if (reported < minimum) {
      setErrors(estimateError);
      setMessage(
        `This form cannot be accepted. Entered estimate (${reported} ${baseline.unit}) is below 50% of baseline (${minimum} ${baseline.unit}).`,
      );
      return;
    }
    specificData.reportedValue = reported;
    specificData.reportedUnit = baseline.unit;

    const values = { type, priority, specificData, photos };

    // 5. Same category, same place, in the last 7 days? Ask first.
    const location = getLocationKey(type, specificData);
    const found = reports.find(
      (r) =>
        r.type === type &&
        !r.archived &&
        r.status !== "Dismissed" &&
        r.timestamp &&
        new Date(r.timestamp).getTime() > Date.now() - 7 * ONE_DAY &&
        location !== "" &&
        getLocationKey(r.type, r.specificData || {}) === location,
    );
    if (found) {
      // Whole days since that report was filed, for the popup's sentence
      const daysAgo = Math.floor(
        (Date.now() - new Date(found.timestamp).getTime()) / ONE_DAY,
      );
      setDuplicate({ report: found, daysAgo: daysAgo, values: values });
      return;
    }

    await sendReport(values);
  }

  // Hand the values to the parent, then start a fresh form. The parent
  // returns false when the report was refused: then keep what was typed.
  async function sendReport(values) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    let saved;
    try {
      saved = await onSubmit(values);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    if (saved === false) return;
    resetForm();
  }

  // Back to a blank form: fields, red borders, message and chosen photos
  function resetForm() {
    setForm(EMPTY_FORM);
    setErrors({});
    setMessage("");
    setPhotos([]);
    setFileInputKey(fileInputKey + 1);
  }

  // Style for a field: red border if it failed validation
  function errorClass(name) {
    return errors[`${type}-${name}`] ? "error-highlight" : "";
  }

  return (
    <div>
      <div className="report-card">
        <div className="report-card-header">
          <h2>
            {viewing
              ? `Viewing Report #${selectedReport.id}`
              : "New Wastage Report"}
          </h2>
          <p>
            {viewing
              ? `Status: ${getStatusInfo(selectedReport.status).label}`
              : "Our Sustainability Officers will directly analyze and resolve this issue."}
          </p>
        </div>

        <div className="report-card-body">
          {/* noValidate: the browser's own "Please fill in this field" popup
              is off, so handleSubmit's checks run and mark every empty
              field in red */}
          <form onSubmit={handleSubmit} noValidate>
            {/* 1. Category */}
            <div className="form-group">
              <label htmlFor="wastageType">Wastage Category</label>
              <select
                id="wastageType"
                name="type"
                required
                className={errors.type ? "error-highlight" : ""}
                disabled={viewing}
                value={type}
                onChange={handleChange}
              >
                <option value="" disabled>
                  Select the type of wastage...
                </option>
                {WASTAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. The chosen category's own fields. key={type} makes React
                draw a fresh group when the category changes, so the
                slide-in animation plays again. */}
            {type && (
              <div className="type-fields" key={type}>
                {TYPE_FIELDS[type].map((field) => (
                  <div className="form-group" key={field.name}>
                    <label>{field.label}</label>
                    {field.textarea ? (
                      <textarea
                        name={`${type}-${field.name}`}
                        rows="3"
                        placeholder={field.placeholder}
                        required
                        disabled={viewing}
                        className={errorClass(field.name)}
                        value={valueOf(field.name)}
                        onChange={handleChange}
                      ></textarea>
                    ) : (
                      <input
                        type="text"
                        name={`${type}-${field.name}`}
                        placeholder={field.placeholder}
                        required
                        disabled={viewing}
                        className={errorClass(field.name)}
                        value={valueOf(field.name)}
                        onChange={handleChange}
                      />
                    )}
                  </div>
                ))}

                <div className="form-group">
                  <label>{ESTIMATE_FIELDS[type].label}</label>
                  <div className="baseline-hint">
                    Typical baseline for this report type (campus ~1800):{" "}
                    <strong>
                      {baseline.min}–{baseline.max} {baseline.unit}
                    </strong>
                    . Estimates below{" "}
                    <strong>
                      {baseline.min * 0.5} {baseline.unit}
                    </strong>{" "}
                    are not accepted.
                  </div>
                  <input
                    type="number"
                    name={`${type}-estimate`}
                    placeholder={ESTIMATE_FIELDS[type].placeholder}
                    min="0"
                    step={type === "Food" ? undefined : "0.01"}
                    required
                    disabled={viewing}
                    className={errorClass("estimate")}
                    value={valueOf("estimate")}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* 3. Priority */}
            <div className="form-group">
              <label>Priority / Severity</label>
              <div className="priority-grid">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={
                      priority === p.value
                        ? `priority-btn selected-${p.value.toLowerCase()}`
                        : "priority-btn"
                    }
                    onClick={() => handlePriority(p.value)}
                  >
                    {p.value}
                    <br />
                    <span style={{ fontWeight: 400, fontSize: "11px" }}>
                      {p.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Photos (not controlled: we only read the chosen files).
                While viewing, a browser can't show a report's photos in a
                file picker, so say how many there are instead. */}
            <div className="form-group">
              <label htmlFor="wastagePhotos">
                Photo Evidence (optional, up to 4)
              </label>
              {viewing ? (
                <p className="photos-note">
                  {photoNote(selectedReport.photoUrls)}
                </p>
              ) : (
                <input
                  key={fileInputKey}
                  type="file"
                  id="wastagePhotos"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  multiple
                  onChange={(event) => {
                    setPhotos(Array.from(event.target.files));
                    setMessage("");
                  }}
                />
              )}
            </div>

            {/* 5. Email */}
            <div className="form-group">
              <label htmlFor="userEmail">Email Address</label>
              <input
                type="email"
                id="userEmail"
                value={email}
                readOnly
                disabled={viewing}
              />
            </div>

            {message && (
              <p className="form-message" role="alert">
                {message}
              </p>
            )}

            {!viewing && (
              <button
                type="submit"
                className="btn-submit"
                disabled={submitting}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z"></path>
                  <path d="M12 3a9 9 0 0 0 9 9H3a9 9 0 0 0 9-9z"></path>
                </svg>
                Log Wastage Report
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Below the card while viewing: back to a blank form */}
      {viewing && (
        <div className="new-report-link" onClick={onNewReport}>
          <span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create New Report
          </span>
        </div>
      )}

      {/* The popup lives here: Cancel clears the form, Submit Anyway sends
          and resets, a click on the dark background just closes it */}
      {duplicate && (
        <DuplicateModal
          type={type}
          duplicate={duplicate.report}
          daysAgo={duplicate.daysAgo}
          onCancel={() => {
            setDuplicate(null);
            resetForm();
          }}
          onClose={() => setDuplicate(null)}
          onConfirm={() => {
            const values = duplicate.values;
            setDuplicate(null);
            sendReport(values);
          }}
        />
      )}
    </div>
  );
}
