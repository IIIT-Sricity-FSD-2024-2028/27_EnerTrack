/**
 * CostEstimateCard — where a work order's cost estimate stands, and a small
 * form (materials + labour) to send one to the Financial Analyst.
 *
 * Shared by the Technician Administrator and Technician Jr work-order pages.
 *
 * The form is only offered while the order is New (first estimate, or a
 * revised one after Finance rejected the last) or In Progress with no
 * estimate yet. The old page offered it at every stage, so sending one for
 * an order already in Review pushed it back to Approval.
 *
 * The page renders this with key={work order id}, so picking another order
 * closes the form and clears the numbers.
 *
 * Ported from selectWorkOrder() / submitCostEstimate() in
 * js/technician/workOrdersPage.js.
 */
import { useState } from "react";

export default function CostEstimateCard({ wo, busy, onSubmit }) {
  const [formOpen, setFormOpen] = useState(false);
  const [materials, setMaterials] = useState("");
  const [labor, setLabor] = useState("");

  const details = wo.details || {};
  const estimate = details.estimate;

  // ── Where the estimate stands ────────────────────────
  // Where an estimate can be, by the order's status:
  //   approval            → waiting for Finance ("pending")
  //   new, with estimate  → Finance rejected it: their Reject sends the
  //                         order back to New but leaves the old estimate
  //   anything later      → Finance approved it ("approved")
  const rejected = estimate && wo.status === "new";

  let statusLine;
  if (estimate && wo.status === "approval") {
    statusLine = (
      <span className="cost-status cost-status--pending">
        Pending Approval (₹{estimate.total})
      </span>
    );
  } else if (rejected) {
    statusLine = (
      <span className="cost-status cost-status--required">
        Rejected (₹{estimate.total}) — submit a revised estimate
      </span>
    );
  } else if (estimate) {
    statusLine = (
      <span className="cost-status cost-status--approved">
        Approved (₹{estimate.total})
      </span>
    );
  } else if (!details.estimateRequired) {
    statusLine = (
      <span className="cost-status cost-status--not-required">
        Not required
      </span>
    );
  } else {
    statusLine = (
      <span className="cost-status cost-status--required">
        Required / Not Submitted
      </span>
    );
  }

  // The form is offered for a first estimate (New or In Progress with none
  // yet) and for a revised one after a rejection (New with an old one).
  const canEstimate =
    wo.status === "new" || (wo.status === "inprogress" && !estimate);

  // The inputs hold text; turn them into numbers to check and add them.
  const materialsCost = Number(materials);
  const laborCost = Number(labor);
  const filledIn =
    materials !== "" && labor !== "" && materialsCost + laborCost > 0;

  async function handleSubmit() {
    const ok = await onSubmit(materialsCost, laborCost);
    if (ok) {
      setFormOpen(false);
      setMaterials("");
      setLabor("");
    }
  }

  return (
    <div className="card mb-16">
      <h2 className="cost-card-title">Cost Estimate</h2>
      <div className="option mt-10">
        <span className="cost-status-line">{statusLine}</span>
        {canEstimate && (
          <button
            type="button"
            className="btn btn-light btn-full"
            onClick={() => setFormOpen(!formOpen)}
          >
            Cost Estimate Form
          </button>
        )}
      </div>

      {canEstimate && formOpen && (
        <div className="callout callout--warning">
          <p className="cost-form-heading">
            <strong>Submit Cost Estimate</strong>
          </p>
          <div className="field">
            <input
              type="number"
              min="0"
              placeholder="Materials cost (₹)"
              value={materials}
              onChange={(event) => setMaterials(event.target.value)}
            />
          </div>
          <div className="field">
            <input
              type="number"
              min="0"
              placeholder="Labor cost (₹)"
              value={labor}
              onChange={(event) => setLabor(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-dark btn-full"
            disabled={busy || !filledIn}
            onClick={handleSubmit}
          >
            Send to Finance Analyst
          </button>
        </div>
      )}
    </div>
  );
}
