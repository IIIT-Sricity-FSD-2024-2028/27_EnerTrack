/**
 * IssueForm — the "New Issue Report" card on /campus/dashboard.
 *
 * Owns what the user is typing (controlled inputs). On submit it checks the
 * required fields, then hands the values UP to the parent through the
 * `onSubmit` prop. The parent (Dashboard.jsx) does the saving.
 *
 * Props:
 *   email           the signed-in user's email, shown read-only
 *   selectedTicket  a report clicked in My Reports (shown read-only), or null
 *   onSubmit        function the parent gives us; called with the form values
 *   onNewReport     called by "Create New Report" to go back to a blank form
 *
 * Replaces the form half of the old js/enduser/enduser.js.
 */
import { useEffect, useRef, useState } from "react";
import { getStatusInfo } from "./serviceRequestHelpers";

// sessionStorage key for the half-typed draft (same key the old page used)
const DRAFT_KEY = "dashboardFormState";

const EMPTY_FORM = {
  location: "",
  issueType: "",
  priority: "Medium",
  description: "",
};

const ISSUE_TYPES = [
  { value: "Electrical", label: "Electrical" },
  { value: "Plumbing", label: "Plumbing" },
  { value: "HVAC", label: "HVAC / Air Conditioning" },
  { value: "Structural", label: "Structural / Civil" },
  { value: "General Maintenance", label: "General Maintenance" },
  { value: "Safety Hazard", label: "Safety Hazard" },
  { value: "Other", label: "Other" },
];

const PRIORITIES = [
  { value: "Low", hint: "Not urgent" },
  { value: "Medium", hint: "Needs attention" },
  { value: "High", hint: "Urgent / safety risk" },
];

// Reads a saved draft, so a page refresh does not lose what was typed.
function loadDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    return saved ? { ...EMPTY_FORM, ...saved } : EMPTY_FORM;
  } catch {
    return EMPTY_FORM;
  }
}

export default function IssueForm({
  email,
  selectedTicket,
  onSubmit,
  onNewReport,
}) {
  // Everything the user has typed, in one object
  const [form, setForm] = useState(loadDraft);
  // Which required fields failed validation: { location: true, ... }
  const [errors, setErrors] = useState({});
  // True while a submit is in flight, so a double-click sends only one report.
  // The ref blocks a second click at once; the state greys out the button.
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  // Save the draft every time the form changes
  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  // One handler for every input: the input's `name` says which field changed
  // While a report is selected the fields show it, read-only
  const viewing = selectedTicket !== null && selectedTicket !== undefined;
  const shown = viewing
    ? {
        location: selectedTicket.location || "",
        issueType: selectedTicket.issueType || "",
        priority: selectedTicket.priority || "Medium",
        description: selectedTicket.description || "",
      }
    : form;
  // A report's type may not be one of the dropdown choices (e.g. "General")
  const extraType =
    viewing &&
    shown.issueType &&
    !ISSUE_TYPES.some((t) => t.value === shown.issueType)
      ? shown.issueType
      : null;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
    setErrors({ ...errors, [name]: false }); // typing clears the red border
  }

  function handlePriority(value) {
    if (viewing) return;
    setForm({ ...form, priority: value });
  }

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser reloading the page
    if (submittingRef.current) return; // the first click is still sending
    if (viewing) return;

    // The form has noValidate, so the browser's popup never shows: this
    // check handles empty and spaces-only fields, and marks both in red.
    const newErrors = {
      location: form.location.trim() === "",
      description: form.description.trim() === "",
    };
    setErrors(newErrors);
    if (newErrors.location || newErrors.description) return;

    submittingRef.current = true;
    setSubmitting(true);
    let saved;
    try {
      saved = await onSubmit({
        location: form.location.trim(),
        issueType: form.issueType,
        priority: form.priority,
        description: form.description.trim(),
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }

    // The parent returns false when the report was refused: keep the text
    // so the visitor does not have to type it all again.
    if (saved !== false) {
      setForm(EMPTY_FORM); // back to a blank form (priority back to Medium)
    }
  }

  return (
    <div>
      <div className="report-card">
        <div className="report-card-header">
          <h2>
            {viewing
              ? `Viewing Report #${selectedTicket.id}`
              : "New Issue Report"}
          </h2>
          <p>
            {viewing
              ? `Status: ${getStatusInfo(selectedTicket.status).label}`
              : "Fill in the details below. Our team will be notified immediately."}
          </p>
        </div>

        <div className="report-card-body">
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="issueLocation">Location / Building</label>
              <input
                type="text"
                id="issueLocation"
                name="location"
                placeholder="e.g., Block B, 3rd floor men's restroom"
                required
                autoComplete="off"
                readOnly={viewing}
                className={errors.location ? "error-highlight" : ""}
                value={shown.location}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="issueType">Issue Type</label>
              <select
                id="issueType"
                name="issueType"
                disabled={viewing}
                value={shown.issueType}
                onChange={handleChange}
              >
                <option value="">Select a category (optional)</option>
                {extraType && <option value={extraType}>{extraType}</option>}
                {ISSUE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Priority Level</label>
              <div className="priority-grid">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={
                      shown.priority === p.value
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

            <div className="form-group">
              <label htmlFor="issueDescription">Issue Description</label>
              <textarea
                id="issueDescription"
                name="description"
                rows="5"
                placeholder="Describe the issue clearly — what you saw, when it started, and any relevant details..."
                required
                readOnly={viewing}
                className={errors.description ? "error-highlight" : ""}
                value={shown.description}
                onChange={handleChange}
              ></textarea>
            </div>

            <div className="form-group">
              <label htmlFor="userEmail">Email Address</label>
              <input type="email" id="userEmail" value={email} readOnly />
            </div>

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
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                Submit Report
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
    </div>
  );
}
