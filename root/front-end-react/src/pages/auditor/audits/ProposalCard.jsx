/**
 * ProposalCard — which tier suits the estate, and what it costs.
 *
 * One document rather than two approvals: nobody signs off a scope without
 * knowing the price. The auditor picks a tier and enters what they counted
 * on site; the monthly figure comes back from the backend's pricing
 * engine. It is never typed here, so it cannot be quietly discounted.
 *
 * The client's Organization Admin then accepts, asks for changes, or
 * declines. Once accepted or declined, the form disappears.
 *
 * The page gives this card key={audit.audit_id}, so switching audit
 * resets the form to the new audit's values.
 */
import { useState } from "react";
import api from "../../../api/client";
import Badge from "../components/Badge";
import { formatCurrency, formatDate } from "../auditorUtils";

export default function ProposalCard({
  audit,
  org,
  plans,
  onSaved,
  showToast,
}) {
  const proposal = audit.proposal;

  // Start the form from the last proposal sent, if there was one.
  let firstPlanId = "";
  if (proposal) {
    firstPlanId = proposal.recommended_plan_id;
  } else if (plans.length > 0) {
    firstPlanId = plans[0].plan_id;
  }
  const [planId, setPlanId] = useState(firstPlanId);
  const [staff, setStaff] = useState(proposal ? proposal.estimated_staff : 0);
  const [campuses, setCampuses] = useState(
    proposal ? proposal.estimated_campuses : 1,
  );

  const decided = audit.status === "accepted" || audit.status === "declined";
  const clientName = org ? org.name : "The client";

  function planName(id) {
    const plan = plans.find((p) => p.plan_id === id);
    if (plan) {
      return plan.name;
    }
    return id;
  }

  function handleSend() {
    const body = {
      recommended_plan_id: planId,
      estimated_staff: Number(staff) || 0,
      estimated_campuses: Number(campuses) || 1,
    };

    api
      .post("/energy-audits/" + audit.audit_id + "/proposal", body)
      .then((updated) => {
        onSaved(updated);
        showToast(
          "Proposal sent. Their Organization Admin has been notified.",
          "success",
        );
      })
      .catch((err) => {
        // The backend refuses a tier too small for the estate, or an
        // organisation with no admin to send to. Both are worth showing.
        showToast(err.message, "error");
      });
  }

  return (
    <div className="card">
      <div className="header-row">
        <div>
          <h2>Proposal</h2>
          <p className="sub">
            What this organisation needs and what it costs, on one document.
            Their Organization Admin approves it, and the subscription starts
            the moment they do.
          </p>
        </div>
        {proposal && <Badge status={audit.status} />}
      </div>

      {proposal && (
        <dl className="dl" style={{ marginTop: "14px" }}>
          <dt>Proposed tier</dt>
          <dd>{planName(proposal.recommended_plan_id)}</dd>
          <dt>Monthly estimate</dt>
          <dd>
            <strong>{formatCurrency(proposal.monthly_estimate)}</strong> before
            GST
          </dd>
          <dt>Counted on site</dt>
          <dd>
            {proposal.estimated_staff} staff, {proposal.estimated_campuses}{" "}
            campus(es)
          </dd>
          <dt>Sent</dt>
          <dd>{formatDate(proposal.sent_on)}</dd>
        </dl>
      )}

      {/* The client's answer, if they have given one. */}
      {audit.status === "changes-requested" &&
        proposal &&
        proposal.response_note && (
          <div className="callout warn" style={{ marginTop: "16px" }}>
            <strong>
              {clientName} asked for changes on{" "}
              {formatDate(proposal.responded_on)}:
            </strong>
            <br />
            {proposal.response_note}
          </div>
        )}
      {audit.status === "declined" && proposal && proposal.response_note && (
        <div className="callout warn" style={{ marginTop: "16px" }}>
          <strong>Declined on {formatDate(proposal.responded_on)}:</strong>
          <br />
          {proposal.response_note}
        </div>
      )}
      {audit.status === "accepted" && proposal && (
        <div className="callout good" style={{ marginTop: "16px" }}>
          Accepted on {formatDate(proposal.responded_on)}. Their subscription is
          live and billing has started.
        </div>
      )}

      {!decided && (
        <div>
          <div className="section-title">
            {proposal ? "Revise and resend" : "Send a proposal"}
          </div>

          <div className="toolbar">
            <div className="field">
              <label htmlFor="propPlan">Tier</label>
              <select
                id="propPlan"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                {plans.map((plan) => (
                  <option key={plan.plan_id} value={plan.plan_id}>
                    {planLabel(plan)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="propStaff">Staff counted</label>
              <input
                id="propStaff"
                type="number"
                min="0"
                value={staff}
                onChange={(e) => setStaff(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="propCampuses">Campuses</label>
              <input
                id="propCampuses"
                type="number"
                min="1"
                value={campuses}
                onChange={(e) => setCampuses(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-green"
              onClick={handleSend}
            >
              {proposal ? "Resend proposal" : "Send proposal"}
            </button>
          </div>

          <p className="muted" style={{ fontSize: "12px" }}>
            The monthly figure is computed from the tier and the headcount you
            enter. It is an estimate — the first invoice bills whatever the
            staff count actually is on the day.
          </p>
        </div>
      )}
    </div>
  );
}

/** "Growth — ₹25,000/mo, 50 staff, 3 campus(es)" */
function planLabel(plan) {
  let campuses = plan.max_campuses;
  if (campuses === null) {
    campuses = "unlimited";
  }
  return (
    plan.name +
    " — " +
    formatCurrency(plan.base_monthly_fee) +
    "/mo, " +
    plan.included_seats +
    " staff, " +
    campuses +
    " campus(es)"
  );
}
