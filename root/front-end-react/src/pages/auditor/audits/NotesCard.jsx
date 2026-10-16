/**
 * NotesCard — free-text notes about the site visit.
 *
 * Saved to the audit's `summary` field. The page gives this card
 * key={audit.audit_id}, so switching audit throws the old card away and
 * the textarea starts again from the new audit's notes.
 */
import { useState } from "react";
import api from "../../../api/client";

export default function NotesCard({ audit, onSaved, showToast }) {
  const [notes, setNotes] = useState(audit.summary || "");

  function handleSave() {
    api
      .patch("/energy-audits/" + audit.audit_id, { summary: notes.trim() })
      .then((updated) => {
        onSaved(updated);
        showToast("Notes saved.", "success");
      })
      .catch((err) => {
        showToast(err.message, "error");
      });
  }

  return (
    <div className="card">
      <h2>Notes</h2>
      <p className="sub">Anything worth writing down about the visit.</p>

      <div className="field" style={{ marginTop: "14px" }}>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button type="button" className="btn btn-dark" onClick={handleSave}>
        Save notes
      </button>
    </div>
  );
}
