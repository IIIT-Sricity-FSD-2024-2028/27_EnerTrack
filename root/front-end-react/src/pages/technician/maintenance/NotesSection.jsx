/**
 * NotesSection — one numbered notes card in the diagnostics workspace.
 * Used twice: "1. Preliminary Inspection Notes" and "2. Quick Fix Attempt".
 *
 * It has two modes:
 *   view — the saved text, with Edit and Delete buttons
 *   edit — a textarea with a Save button
 * It is in view mode when there is saved text and the user has not clicked
 * Edit; otherwise in edit mode.
 *
 * The text being typed (`draft`) lives here, not in the page, because only
 * this card cares about it until Save is clicked. The page renders this with
 * key={fault.fault_id}, so switching to another fault builds a fresh card
 * and any half-typed draft is thrown away.
 *
 * Anything placed between <NotesSection> and </NotesSection> (children) is
 * drawn at the bottom of the card — the Quick Fix card uses this for its
 * "Close Fault" button.
 *
 * Ported from the prelim / quickfix handlers in js/technician/maintenancePage.js.
 */
import { useState } from "react";

export default function NotesSection({
  title,
  description,
  placeholder,
  savedText,
  saveLabel,
  busy,
  onSave,
  onDelete,
  children,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    setDraft(savedText); // start from what is already saved
    setEditing(true);
  }

  async function handleSave() {
    const text = draft.trim();
    if (text === "") {
      return; // nothing to save
    }
    // onSave returns true only if the backend accepted it, so a failed save
    // keeps the textarea open with the text still in it.
    const ok = await onSave(text);
    if (ok) {
      setEditing(false);
      setDraft("");
    }
  }

  const showSaved = savedText && !editing;

  let body;
  if (showSaved) {
    body = (
      <div className="callout mb-16">
        <div className="notes-saved-text">{savedText}</div>
        <div className="notes-buttons">
          <button
            type="button"
            className="btn btn-light btn-xs"
            disabled={busy}
            onClick={startEditing}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-red btn-xs"
            disabled={busy}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div>
        <textarea
          className="diag-textarea"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="action-bar mt-16 notes-save-bar">
          <button
            type="button"
            className="btn btn-dark"
            disabled={busy}
            onClick={handleSave}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card detail-card">
      <h3 className="section-title">{title}</h3>
      <p className="section-desc">{description}</p>
      {body}
      {children}
    </div>
  );
}
