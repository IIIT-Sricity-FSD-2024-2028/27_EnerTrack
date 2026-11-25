/**
 * NotesCard — free-text notes about the site visit.
 *
 * Saved to the audit's `summary` field. The page gives this card
 * key={audit.audit_id}, so switching audit throws the old card away and
 * the textarea starts again from the new audit's notes.
 */
import { useState } from "react";
import { useDispatch } from "react-redux";
import { updateEnergyAudit } from "../../../store/slices/energyAuditsSlice";

export default function NotesCard({ audit, showToast }) {
  const dispatch = useDispatch();
  const [notes, setNotes] = useState(audit.summary || "");

  function handleSave() {
    dispatch(
      updateEnergyAudit({
        id: audit.audit_id,
        changes: { summary: notes.trim() },
      }),
    )
      .unwrap()
      .then(() => {
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
