/**
 * pricing.ts — the whole revenue model, as arithmetic.
 *
 * Deliberately free of Nest: no @Injectable, no DI, no DatabaseService.
 * Everything it needs arrives as an argument and everything it produces is
 * returned. That is what lets the rules below be unit-tested directly, and
 * it is why BillingService is thin — it gathers inputs and persists output,
 * it does not decide prices.
 *
 * Three revenue streams, in the order a client meets them:
 *
 *   1. Audit fee          one-time, on the period the contract starts,
 *                         suppressed entirely when waived on signature
 *   2. Subscription       recurring, per billed meter, with a floor
 *   3. Performance share   a percentage of savings the client has accepted
 *                          as real, capped as a multiple of the subscription
 *
 * Two rules in here carry more weight than the rest, and both exist because
 * outcome-based billing is easy to get wrong in a way that favours the
 * vendor:
 *
 *   · adjustBaseline() strips out consumption changes EnerTrack did not
 *     cause, so the client is never billed a share of the weather.
 *   · performanceShareLine() refuses to bill a verification the client has
 *     not accepted. The guard lives here rather than in a controller so no
 *     route, present or future, can route around it.
 */

import {
  BillingCycle,
  InvoiceLineType,
  PeriodFactorValues,
  PlatformInvoiceLine,
  SavingsVerification,
  Subscription,
  SubscriptionPlan,
  VerificationStatus,
} from "../../core/database/database.service";

/** Annual contracts pay twelve months up front at a 10% discount. */
export const ANNUAL_DISCOUNT = 0.1;

/** GST applied to the subtotal of every platform invoice. */
export const DEFAULT_TAX_PCT = 18;

export interface BillingInputs {
  /** "YYYY-MM" period being billed. */
  period: string;
  subscription: Subscription;
  plan: SubscriptionPlan;
  /** Meters under management this period. See BillingService for the rule. */
  billedMeterCount: number;
  /** Estate size, for the per-square-metre half of the audit fee. */
  floorAreaSqm: number | null;
  /** The period's verification, whatever state it is in. May be absent. */
  verification: SavingsVerification | null;
  taxPct?: number;
}

export interface InvoiceTotals {
  line_items: PlatformInvoiceLine[];
  subtotal: number;
  tax_pct: number;
  tax_amount: number;
  total: number;
}

/** Rupees, to the nearest whole one. Every amount that leaves this file. */
function inr(value: number): number {
  return Math.round(value);
}

/**
 * Restates a baseline as what that same estate would have consumed under
 * the conditions actually seen in a later period.
 *
 * Savings are a counterfactual: you cannot measure what a campus *would*
 * have used, only what it did use against a model of what it would have.
 * A cool season, a smaller intake or a wing taken offline all move
 * consumption without anybody improving anything, so comparing raw
 * baseline against raw actual bills the client for all three.
 *
 * The correction is the simplest honest one — the ratio adjustment behind
 * IPMVP's routine adjustments. Each factor is applied as a ratio against
 * the baseline window's own average, so it cuts in both directions: a
 * hotter month raises the adjusted baseline and increases the claim, a
 * milder one lowers it and shrinks the claim.
 *
 * A zero or missing baseline factor is treated as "not measured" and
 * contributes a ratio of 1 rather than dividing by zero.
 */
export function adjustBaseline(
  baselineKwh: number,
  baseline: PeriodFactorValues,
  actual: PeriodFactorValues,
): number {
  const ratio = (base: number, now: number) =>
    base && base > 0 && Number.isFinite(now) ? now / base : 1;

  return (
    baselineKwh *
    ratio(baseline.cooling_degree_days, actual.cooling_degree_days) *
    ratio(baseline.occupancy_index, actual.occupancy_index) *
    ratio(baseline.floor_area_sqm, actual.floor_area_sqm)
  );
}

/**
 * Savings against an already-adjusted baseline, in kWh and in rupees.
 *
 * Clamped at zero. If a campus consumed more than its adjusted baseline
 * there is no saving to share, and EnerTrack does not invoice a negative
 * one — the downside sits with the client, which is the same asymmetry
 * every performance contract carries.
 */
export function verifiedSaving(
  adjustedBaselineKwh: number,
  actualKwh: number,
  tariffRate: number,
): { savedKwh: number; savedAmount: number } {
  const savedKwh = Math.max(0, adjustedBaselineKwh - actualKwh);
  return { savedKwh: Math.round(savedKwh), savedAmount: inr(savedKwh * tariffRate) };
}

/**
 * The recurring line. Per metered point, with the plan's floor applied so
 * a very small estate still covers the cost to serve it.
 *
 * Known trade-off, recorded rather than hidden: pricing per meter gives a
 * client a marginal reason not to add meters, which works against the
 * data-source ladder the product wants them to climb. The floor blunts it
 * at the small end, and it is the model the published pricing commits to.
 */
export function subscriptionLine(
  plan: SubscriptionPlan,
  billedMeterCount: number,
  cycle: BillingCycle,
  sourceRef: string,
): PlatformInvoiceLine {
  const metered = billedMeterCount * plan.price_per_meter_month;
  const atFloor = metered < plan.min_monthly_fee;
  const monthly = Math.max(metered, plan.min_monthly_fee);

  const amount =
    cycle === BillingCycle.ANNUAL ? monthly * 12 * (1 - ANNUAL_DISCOUNT) : monthly;

  return {
    type: InvoiceLineType.SUBSCRIPTION,
    description: atFloor
      ? `${plan.name} — monitoring subscription, minimum monthly fee` +
        (cycle === BillingCycle.ANNUAL ? " (annual, 10% discount)" : "")
      : `${plan.name} — monitoring subscription, ${billedMeterCount} metered points` +
        (cycle === BillingCycle.ANNUAL ? " (annual, 10% discount)" : ""),
    quantity: atFloor ? 1 : billedMeterCount,
    unit_price: atFloor ? plan.min_monthly_fee : plan.price_per_meter_month,
    amount: inr(amount),
    source_ref: sourceRef,
  };
}

/**
 * The one-time site audit, billed on the period the contract starts.
 *
 * Returns null when the fee was waived on signature, and null on every
 * period after the first — it is a one-time charge, not a recurring one.
 */
export function auditFeeLine(
  plan: SubscriptionPlan,
  subscription: Subscription,
  floorAreaSqm: number | null,
  period: string,
): PlatformInvoiceLine | null {
  if (subscription.audit_fee_waived_on) return null;
  if (!subscription.started_on) return null;
  if (subscription.started_on.slice(0, 7) !== period) return null;

  const area = floorAreaSqm ?? 0;
  const amount = plan.audit_fee_base + area * plan.audit_fee_per_sqm;
  if (amount <= 0) return null;

  return {
    type: InvoiceLineType.AUDIT_FEE,
    description: `Certified energy audit — site assessment and baseline (${area.toLocaleString("en-IN")} m²)`,
    quantity: 1,
    unit_price: inr(amount),
    amount: inr(amount),
    source_ref: subscription.baseline_audit_id,
  };
}

/**
 * The outcome-linked line, and the one with teeth in front of it.
 *
 * Two guards, in order:
 *
 *  1. The verification must be CLIENT_ACCEPTED. A draft is unfinished, an
 *     auditor-signed one is one party's opinion, and a disputed one is an
 *     open disagreement — none of those is a bill. This matters because
 *     the auditor who locks the baseline works for the party being paid
 *     the share; requiring the client's acceptance is what supplies the
 *     missing counterparty. Enforced here, in the engine, so it cannot be
 *     bypassed by adding a route later.
 *
 *  2. The result is capped as a percentage of the same period's
 *     subscription fee, so an unusual season cannot produce an invoice the
 *     client could not have budgeted for.
 */
export function performanceShareLine(
  verification: SavingsVerification | null,
  sharePct: number,
  subscriptionAmount: number,
  capPctOfSubscription: number,
): PlatformInvoiceLine | null {
  if (!verification) return null;
  if (verification.status !== VerificationStatus.CLIENT_ACCEPTED) return null;

  const uncapped = verification.saved_amount * (sharePct / 100);
  const cap = subscriptionAmount * (capPctOfSubscription / 100);
  const amount = inr(Math.min(uncapped, cap));
  if (amount <= 0) return null;

  const capped = uncapped > cap;
  const savings = verification.saved_kwh.toLocaleString("en-IN");

  return {
    type: InvoiceLineType.PERFORMANCE_SHARE,
    description:
      `Performance share, ${sharePct}% of verified savings ` +
      `(${savings} kWh, weather-adjusted)` +
      (capped ? ` — capped at ${capPctOfSubscription}% of subscription` : ""),
    quantity: 1,
    unit_price: amount,
    amount,
    source_ref: verification.verification_id,
  };
}

/** The share percentage in force: a negotiated override, else the plan's. */
export function effectiveSharePct(
  subscription: Subscription,
  plan: SubscriptionPlan,
): number {
  return subscription.performance_share_pct_override ?? plan.performance_share_pct;
}

/**
 * Assembles one period's invoice. Every organisation and every period goes
 * through this function, which is what keeps the model correct at three
 * tenants and at three thousand.
 */
export function buildInvoice(inputs: BillingInputs): InvoiceTotals {
  const { period, subscription, plan, billedMeterCount, floorAreaSqm, verification } =
    inputs;
  const taxPct = inputs.taxPct ?? DEFAULT_TAX_PCT;

  const subscription_line = subscriptionLine(
    plan,
    billedMeterCount,
    subscription.billing_cycle,
    subscription.subscription_id,
  );

  const lines: PlatformInvoiceLine[] = [subscription_line];

  const audit = auditFeeLine(plan, subscription, floorAreaSqm, period);
  if (audit) lines.push(audit);

  const share = performanceShareLine(
    verification,
    effectiveSharePct(subscription, plan),
    subscription_line.amount,
    plan.share_cap_pct_of_subscription,
  );
  if (share) lines.push(share);

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const tax_amount = inr(subtotal * (taxPct / 100));

  return {
    line_items: lines,
    subtotal: inr(subtotal),
    tax_pct: taxPct,
    tax_amount,
    total: inr(subtotal) + tax_amount,
  };
}
