/**
 * IssueForm — the "New Issue Report" card on /campus/dashboard.
 *
 * Owns what the user is typing (controlled inputs). On submit it checks the
 * required fields, then hands the values UP to the parent through the
 * `onSubmit` prop. The parent (Dashboard.jsx) does the saving.
 *
 * Props:
 *   email     the signed-in user's email, shown read-only
 *   onSubmit  function the parent gives us; called with the form values
 *
 * Replaces the form half of the old js/enduser/enduser.js.
 */
import { useEffect, useState } from "react";

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

export default function IssueForm({ email, onSubmit }) {
  // Everything the user has typed, in one object
  const [form, setForm] = useState(loadDraft);
  // Which required fields failed validation: { location: true, ... }
  const [errors, setErrors] = useState({});

  // Save the draft every time the form changes
  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  // One handler for every input: the input's `name` says which field changed
  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
    setErrors({ ...errors, [name]: false }); // typing clears the red border
  }

  function handlePriority(value) {
    setForm({ ...form, priority: value });
  }

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser reloading the page

    // A field with only spaces passes the browser's own "required" check,
    // so check again after trimming.
    const newErrors = {
      location: form.location.trim() === "",
      description: form.description.trim() === "",
    };
    setErrors(newErrors);
    if (newErrors.location || newErrors.description) return;

    await onSubmit({
      location: form.location.trim(),
      issueType: form.issueType,
      priority: form.priority,
      description: form.description.trim(),
    });

    setForm(EMPTY_FORM); // back to a blank form (priority back to Medium)
  }

  return (
    <div className="report-card">
      <div className="report-card-header">
        <h2>New Issue Report</h2>
        <p>Fill in the details below. Our team will be notified immediately.</p>
      </div>

      <div className="report-card-body">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="issueLocation">Location / Building</label>
            <input
              type="text"
              id="issueLocation"
              name="location"
              placeholder="e.g., Block B, 3rd floor men's restroom"
              required
              autoComplete="off"
              className={errors.location ? "error-highlight" : ""}
              value={form.location}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="issueType">Issue Type</label>
            <select
              id="issueType"
              name="issueType"
              value={form.issueType}
              onChange={handleChange}
            >
              <option value="">Select a category (optional)</option>
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
                    form.priority === p.value
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
              className={errors.description ? "error-highlight" : ""}
              value={form.description}
              onChange={handleChange}
            ></textarea>
          </div>

          <div className="form-group">
            <label htmlFor="userEmail">Email Address</label>
            <input type="email" id="userEmail" value={email} readOnly />
          </div>

          <button type="submit" className="btn-submit">
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
        </form>
      </div>
    </div>
  );
}
