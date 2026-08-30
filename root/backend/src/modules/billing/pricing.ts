/**
 * pricing.ts — the whole revenue model, as arithmetic.
 *
 * Deliberately free of Nest: no @Injectable, no DI, no DatabaseService.
 * Everything it needs arrives as an argument and everything it produces is
 * returned, which is what lets the rules below be unit-tested directly and
 * why BillingService is thin — it gathers inputs and persists output, it
 * does not decide prices.
 *
 * The model, in one sentence:
 *
 *   Each tier includes a number of staff seats. Go over the allowance and
 *   you pay per extra seat.
 *
 * That is the entire thing. A previous version charged a share of verified
 * energy savings, which needed locked baselines, weather normalisation,
 * attribution windows and a client counter-signature to be honest — about
 * 250 lines here and 600 elsewhere. Savings are still reported to the
 * client (see OrganizationsService.savings), because that is why anyone
 * buys the product; they are simply never invoiced. A number that is only
 * reported needs none of that machinery: rigour is proportional to
 * consequence.
 */

import {
  BillingCycle,
  InvoiceLineType,
  PlatformInvoiceLine,
  Subscription,
  SubscriptionPlan,
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
  /** Staff accounts in the organisation. See BillingService for the rule. */
  billableStaff: number;
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

/** Staff beyond the tier's allowance. Never negative. */
export function seatsOverAllowance(
  plan: SubscriptionPlan,
  billableStaff: number,
): number {
  return Math.max(0, billableStaff - plan.included_seats);
}

/** The flat tier fee, covering everything up to the included allowances. */
export function subscriptionLine(
  plan: SubscriptionPlan,
  cycle: BillingCycle,
  sourceRef: string,
): PlatformInvoiceLine {
  const annual = cycle === BillingCycle.ANNUAL;
  const amount = annual
    ? plan.base_monthly_fee * 12 * (1 - ANNUAL_DISCOUNT)
    : plan.base_monthly_fee;

  const campuses =
    plan.max_campuses === null ? "unlimited campuses" : `${plan.max_campuses} campus${plan.max_campuses === 1 ? "" : "es"}`;

  return {
    type: InvoiceLineType.SUBSCRIPTION,
    description:
      `${plan.name} — ${annual ? "annual" : "monthly"} subscription ` +
      `(${plan.included_seats} staff seats, ${campuses})` +
      (annual ? ", 10% discount" : ""),
    quantity: 1,
    unit_price: inr(amount),
    amount: inr(amount),
    source_ref: sourceRef,
  };
}

/**
 * The overage line, and the reason the model tracks headcount at all.
 *
 * Seats are metered rather than blocked: a client going over its allowance
 * is billed for the extra staff, not stopped from hiring them. Blocking a
 * hire to protect a price would be hostile, and the overage is the honest
 * way to say "a bigger team gets more out of this, so it costs more".
 *
 * Returns null when the client is inside its allowance, so an invoice for
 * a small tenant carries exactly one line.
 */
export function seatOverageLine(
  plan: SubscriptionPlan,
  billableStaff: number,
  cycle: BillingCycle,
  sourceRef: string,
): PlatformInvoiceLine | null {
  const extra = seatsOverAllowance(plan, billableStaff);
  if (extra === 0) return null;

  const annual = cycle === BillingCycle.ANNUAL;
  const unit = annual
    ? plan.price_per_extra_seat * 12 * (1 - ANNUAL_DISCOUNT)
    : plan.price_per_extra_seat;

  return {
    type: InvoiceLineType.SEAT_OVERAGE,
    description: `Additional staff seats (${billableStaff} staff, ${plan.included_seats} included)`,
    quantity: extra,
    unit_price: inr(unit),
    amount: inr(unit * extra),
    source_ref: sourceRef,
  };
}

/**
 * Assembles one period's invoice. Every organisation and every period goes
 * through this function, which is what keeps the model correct at three
 * tenants and at three thousand.
 *
 * At most two lines plus tax. That is the point.
 */
export function buildInvoice(inputs: BillingInputs): InvoiceTotals {
  const { subscription, plan, billableStaff } = inputs;
  const taxPct = inputs.taxPct ?? DEFAULT_TAX_PCT;
  const ref = subscription.subscription_id;

  const lines: PlatformInvoiceLine[] = [
    subscriptionLine(plan, subscription.billing_cycle, ref),
  ];

  const overage = seatOverageLine(
    plan,
    billableStaff,
    subscription.billing_cycle,
    ref,
  );
  if (overage) lines.push(overage);

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
