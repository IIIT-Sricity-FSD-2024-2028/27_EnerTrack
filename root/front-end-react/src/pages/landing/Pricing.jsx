import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchPublicPlans,
  selectPublicPlans,
  selectPublicPlansStatus,
} from "../../store/slices/subscriptionPlansSlice";
import SectionHeader from "./SectionHeader";

// 1,20,000 style rupee amounts, the way an Indian price list is written.
const inr = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

// One tier. `plan` is a single object from the API, passed down as a prop.
function PlanCard({ plan }) {
  const campuses =
    plan.max_campuses === null
      ? "unlimited campuses"
      : `${plan.max_campuses} campus${plan.max_campuses === 1 ? "" : "es"}`;

  return (
    <div className="plan-card">
      <h4>{plan.name}</h4>
      <div className="plan-price">
        {inr(plan.base_monthly_fee)}
        <span> per month</span>
      </div>
      <div className="plan-min">
        {plan.included_seats} staff included, then{" "}
        {inr(plan.price_per_extra_seat)} each · {campuses}
      </div>
      <p>{plan.tagline}</p>
      <ul>
        {(plan.features || []).map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Pricing() {
  const dispatch = useDispatch();
  // Starts empty. The cards appear once the plans arrive from the server.
  const plans = useSelector(selectPublicPlans);
  // The request failed, so the visitor is told instead of seeing an empty
  // gap where the prices should be. Never show made-up prices: a page with
  // no tiers is better than one showing prices the system would not charge.
  const failed = useSelector(selectPublicPlansStatus) === "failed";

  // Ask the server for the published pricing tiers when the section first
  // shows. Works signed out: /subscription-plans/public needs no session.
  useEffect(() => {
    dispatch(fetchPublicPlans());
  }, [dispatch]);

  return (
    <section className="section pricing" id="pricing">
      <SectionHeader title="One subscription. No share of your savings.">
        Every tier includes the audit, the platform and the reporting. What
        separates them is the size of the estate and the size of the team: more
        campuses and more staff means more people getting value out of it, so it
        costs more.
      </SectionHeader>

      {failed && plans.length === 0 && (
        <p className="pricing-note">
          Our current prices could not be loaded. Register your organisation and your
          auditor's proposal will show exactly what your plan costs.
        </p>
      )}

      {/* Hidden entirely until there is something to show. */}
      {plans.length > 0 && (
        <div className="plan-row">
          {plans.map((plan) => (
            <PlanCard key={plan.plan_id} plan={plan} />
          ))}
        </div>
      )}

      <p className="pricing-note">
        An Occupant account is always free. Anyone in your buildings can report a
        fault or a leak without adding to your bill — the people who spot
        problems first should never be a line item.
      </p>
    </section>
  );
}
