/**
 * JrActionPanel — the junior technician's action panel for the selected
 * work order. It only offers the action for the order's current stage:
 *
 *   new, estimate needed (none yet, or rejected) → "estimate first" + Reject
 *   new                                          → Accept Task / Reject Task
 *   approval                                     → waiting for Finance
 *   inprogress                                   → notes + Submit for Review
 *   review                                       → waiting for the admin
 *
 * The old page let a technician accept an order that still needed a cost
 * estimate, which skipped Finance's approval. It also threw away the
 * resolution notes on Submit for Review.
 *
 * The page renders this with key={work order id}, so half-typed notes do
 * not carry over to another order.
 *
 * Ported from renderActionPanel() in js/technician_jr/workOrdersPage.js.
 */
import { useState } from "react";

export default function JrActionPanel({
  wo,
  busy,
  onAccept,
  onReject,
  onSubmitReview,
}) {
  const [notes, setNotes] = useState("");

  const details = wo.details || {};
  // No estimate yet although one is required, or the last one was rejected
  // (Finance's Reject sends the order back to New but keeps the estimate).
  const needsEstimate =
    (details.estimateRequired && !details.estimate) ||
    (wo.status === "new" && details.estimate);

  const rejectButton = (
    <button
      type="button"
      className="btn btn-light btn-full reject-btn"
      disabled={busy}
      onClick={onReject}
    >
      Reject Task
    </button>
  );

  let title;
  let body;

  if (wo.status === "new" && needsEstimate) {
    title = "Work Order Assignment";
    body = (
      <div>
        <p className="callout callout--warning stage-note mb-10">
          This work order needs an approved cost estimate before work can
          start. Send one with the Cost Estimate form.
        </p>
        {rejectButton}
      </div>
    );
  } else if (wo.status === "new") {
    title = "Work Order Assignment";
    body = (
      <div className="grid2">
        <div className="option active">
          <b>Accept Task</b>
          <p>Begin phase execution.</p>
          <button
            type="button"
            className="btn btn-dark btn-full"
            disabled={busy}
            onClick={onAccept}
          >
            Accept Task
          </button>
        </div>
        <div className="option">
          <b>Reject Task</b>
          <p>Return work order to the queue.</p>
          {rejectButton}
        </div>
      </div>
    );
  } else if (wo.status === "approval") {
    title = "Cost Estimate Approval";
    body = (
      <p className="stage-note">
        Waiting for the Financial Analyst to approve the submitted estimate.
      </p>
    );
  } else if (wo.status === "inprogress") {
    title = "System Operational Check";
    body = (
      <div>
        <p className="sub mb-10">Document completion.</p>
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
    // review (closed orders are not on the board)
    title = "Under Review";
    body = (
      <p className="stage-note">
        This task is under review by the Technician Administrator.
      </p>
    );
  }

  return (
    <div className="card no-margin">
      <h2 className="section-title-small mb-10">{title}</h2>
      {body}
    </div>
  );
}
