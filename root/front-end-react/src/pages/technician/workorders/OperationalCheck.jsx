/**
 * OperationalCheck — the Technician Administrator's action panel for the
 * selected work order. It only offers the action that belongs to the
 * order's current stage:
 *
 *   new, nobody assigned         → re-assign it (a junior or Finance
 *                                  rejected it)
 *   new, estimate was rejected   → "submit a revised estimate"
 *   new, estimate still needed   → "submit a cost estimate first"
 *   new, assigned to you         → Start Work (→ inprogress)
 *   new, assigned to someone else→ waiting for them to accept
 *   approval                     → waiting for the Financial Analyst
 *   inprogress                   → resolution notes + Submit for Review
 *   review                       → the notes + Close & Archive
 *   closed                       → the notes
 *
 * The old page offered Submit for Review and Close at every stage, so an
 * order could skip the estimate, the approval and the work itself.
 *
 * The page renders this with key={work order id}, so picking another order
 * clears any half-typed notes or half-made choice.
 *
 * Ported from selectWorkOrder() in js/technician/workOrdersPage.js.
 */
import { useState } from "react";
import { assignableUsers, userName } from "../techUtils";

export default function OperationalCheck({
  wo,
  users,
  currentUserId,
  busy,
  onStartWork,
  onSubmitReview,
  onCloseClick,
  onReassign,
}) {
  const [notes, setNotes] = useState("");
  const [reassignId, setReassignId] = useState("");

  const details = wo.details || {};
  const estimateMissing = details.estimateRequired && !details.estimate;
  // Back in New but still holding an estimate = Finance rejected it (an
  // approved estimate moves the order on to In Progress instead).
  const estimateRejected = wo.status === "new" && details.estimate;

  async function handleReassign() {
    const ok = await onReassign(reassignId);
    if (ok) {
      setReassignId("");
    }
  }

  // ── Work out the title and the body for this stage ───
  let title = "System Operational Check";
  let body;

  if (wo.status === "new" && !wo.assigned_to_id) {
    title = "Requires Re-assignment";
    body = (
      <div className="callout callout--danger">
        <p className="reassign-heading">
          <strong>Nobody is assigned to this work order.</strong>
        </p>
        <div className="field">
          <select
            value={reassignId}
            onChange={(event) => setReassignId(event.target.value)}
          >
            <option value="">-- Select Alternate Tech --</option>
            {assignableUsers(users).map((tech) => (
              <option key={tech.user_id} value={tech.user_id}>
                {tech.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-dark btn-full"
          disabled={busy || reassignId === ""}
          onClick={handleReassign}
        >
          Re-assign Task
        </button>
      </div>
    );
  } else if (wo.status === "new" && estimateRejected) {
    body = (
      <p className="callout callout--danger stage-note">
        The Financial Analyst rejected the last cost estimate. Submit a revised
        one with the Cost Estimate form; work starts once it is approved.
      </p>
    );
  } else if (wo.status === "new" && estimateMissing) {
    body = (
      <p className="callout callout--warning stage-note">
        This work order needs a cost estimate first. Use the Cost Estimate
        form; work starts once the Financial Analyst approves it.
      </p>
    );
  } else if (wo.status === "new" && wo.assigned_to_id === currentUserId) {
    body = (
      <div>
        <p className="sub mb-10">This work order is assigned to you.</p>
        <button
          type="button"
          className="btn btn-dark btn-full"
          disabled={busy}
          onClick={onStartWork}
        >
          Start Work
        </button>
      </div>
    );
  } else if (wo.status === "new") {
    body = (
      <p className="callout stage-note">
        Waiting for {userName(users, wo.assigned_to_id)} to accept this work
        order.
      </p>
    );
  } else if (wo.status === "approval") {
    body = (
      <p className="callout stage-note">
        Waiting for the Financial Analyst to approve the cost estimate.
      </p>
    );
  } else if (wo.status === "inprogress") {
    body = (
      <div>
        <p className="sub mb-10">Document completion and submit for review.</p>
        <textarea
          className="completion-notes"
          placeholder="Enter resolution details..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-dark btn-full"
          disabled={busy}
          onClick={() => onSubmitReview(notes.trim())}
        >
          Submit for Review
        </button>
      </div>
    );
  } else {
    // review or closed
    title = "Resolution Details";
    body = (
      <p className="callout resolution-notes">
        {details.resolution_notes || "No notes provided."}
      </p>
    );
  }

  return (
    <div className="card no-margin">
      <h2 className="section-title-small mb-10">{title}</h2>
      {body}

      {/* Closing is the final check, so it is only offered in Review. */}
      {wo.status === "review" && (
        <button
          type="button"
          className="btn btn-red btn-full mt-12"
          disabled={busy}
          onClick={onCloseClick}
        >
          Close &amp; Archive Work Order
        </button>
      )}
    </div>
  );
}
