import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  DatabaseService,
  MeterStatus,
  PlatformInvoice,
  PlatformInvoiceStatus,
  SavingsVerification,
  SubscriptionStatus,
  VerificationStatus,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { buildInvoice, effectiveSharePct } from "../billing/pricing";
import {
  CreatePlatformInvoiceDto,
  GenerateInvoiceDto,
} from "./dto/create-platform-invoice.dto";
import { PutPlatformInvoiceDto } from "./dto/put-platform-invoice.dto";
import { UpdatePlatformInvoiceDto } from "./dto/update-platform-invoice.dto";

/** Days between issuing an invoice and its due date. */
const PAYMENT_TERMS_DAYS = 30;

/**
 * EnerTrack's own billing.
 *
 * The service gathers inputs and persists results; it does not decide
 * prices. Every figure comes from pricing.ts, which is pure and has no
 * access to this database — so the rules that matter can be read, and
 * tested, in one file without a running application.
 */
@Injectable()
export class PlatformInvoicesService {
  constructor(private database: DatabaseService) {}

  /* ── The engine ────────────────────────────────────────────────── */

  /**
   * Builds one period's invoice from platform state.
   *
   * Nothing here is typed by a human. The subscription line reads the live
   * meter count, the audit line reads the contract's start date, and the
   * performance share reads a verification the client has accepted. That
   * is what "billing is derived, never entered" means in practice: revenue
   * cannot drift away from the data the platform actually holds.
   *
   * Returns a draft. Issuing it is a separate, deliberate act.
   */
  generate(dto: GenerateInvoiceDto) {
    const org = this.database.organizations.find(
      (o) => o.organization_id === dto.organization_id,
    );
    if (!org)
      throw new NotFoundException(
        `Organization with ID ${dto.organization_id} not found`,
      );

    const subscription = this.database.subscriptions.find(
      (s) =>
        s.organization_id === dto.organization_id &&
        s.status !== SubscriptionStatus.CANCELLED,
    );
    if (!subscription)
      throw new NotFoundException(
        `Organization ${dto.organization_id} has no active subscription to bill`,
      );

    const plan = this.database.subscriptionPlans.find(
      (p) => p.plan_id === subscription.plan_id,
    );
    if (!plan)
      throw new NotFoundException(
        `Subscription ${subscription.subscription_id} references plan ${subscription.plan_id}, which no longer exists`,
      );

    const existing = this.database.platformInvoices.find(
      (i) =>
        i.organization_id === dto.organization_id && i.period === dto.period,
    );
    if (existing)
      throw new ConflictException(
        `An invoice for ${org.name} covering ${dto.period} already exists (${existing.platform_invoice_id})`,
      );

    const totals = buildInvoice({
      period: dto.period,
      subscription,
      plan,
      billedMeterCount: this.billedMeterCount(dto.organization_id),
      floorAreaSqm: org.floor_area_sqm,
      verification: this.billableVerification(dto.organization_id, dto.period),
      taxPct: dto.tax_pct,
    });

    const invoice: PlatformInvoice = {
      platform_invoice_id: crypto.randomUUID(),
      organization_id: dto.organization_id,
      subscription_id: subscription.subscription_id,
      period: dto.period,
      ...totals,
      status: PlatformInvoiceStatus.DRAFT,
      issued_on: null,
      due_on: null,
      paid_on: null,
    };

    this.database.platformInvoices.push(invoice);
    return invoice;
  }

  /**
   * Previews a period's invoice without saving it, and says why each line
   * is or is not there.
   *
   * The explanation is the useful half. "No performance share this month"
   * is a question the Account Officer gets asked constantly, and the
   * answer is always one of a small number of specific reasons.
   */
  preview(organizationId: string, period: string) {
    const org = this.database.organizations.find(
      (o) => o.organization_id === organizationId,
    );
    if (!org)
      throw new NotFoundException(`Organization with ID ${organizationId} not found`);

    const subscription = this.database.subscriptions.find(
      (s) =>
        s.organization_id === organizationId &&
        s.status !== SubscriptionStatus.CANCELLED,
    );
    if (!subscription)
      throw new NotFoundException(
        `Organization ${organizationId} has no active subscription to bill`,
      );

    const plan = this.database.subscriptionPlans.find(
      (p) => p.plan_id === subscription.plan_id,
    );
    if (!plan)
      throw new NotFoundException(`Plan ${subscription.plan_id} not found`);

    const verification = this.periodVerification(organizationId, period);
    const totals = buildInvoice({
      period,
      subscription,
      plan,
      billedMeterCount: this.billedMeterCount(organizationId),
      floorAreaSqm: org.floor_area_sqm,
      verification: this.billableVerification(organizationId, period),
    });

    return {
      organization_id: organizationId,
      organization_name: org.name,
      period,
      plan_name: plan.name,
      billed_meter_count: this.billedMeterCount(organizationId),
      share_pct: effectiveSharePct(subscription, plan),
      ...totals,
      performance_share_note: this.explainShare(verification),
    };
  }

  /** Plain-English reason the performance share is present or absent. */
  private explainShare(verification: SavingsVerification | null): string {
    if (!verification)
      return "No savings verification exists for this period, so no performance share is billable.";
    switch (verification.status) {
      case VerificationStatus.CLIENT_ACCEPTED:
        return `Billable: the client accepted ${verification.saved_kwh.toLocaleString("en-IN")} kWh of verified savings on ${verification.accepted_on}.`;
      case VerificationStatus.AUDITOR_SIGNED:
        return "Signed by the auditor but not yet accepted by the client, so it is not billable. Unaccepted savings are unbilled revenue.";
      case VerificationStatus.DISPUTED:
        return `Disputed by the client on ${verification.disputed_on}, so it is not billable. Reason given: ${verification.dispute_reason}`;
      default:
        return "Still a draft: the auditor has not signed it, so it is not billable.";
    }
  }

  /**
   * Meters under management for a tenant.
   *
   * Faulty and calibrating meters still bill. EnerTrack is managing the
   * point either way, and a broken meter is arguably the one most in need
   * of attention. Decommissioned meters are removed from service and drop
   * out entirely.
   */
  private billedMeterCount(organizationId: string): number {
    return this.database.meters.filter(
      (m) =>
        m.organization_id === organizationId &&
        m.status !== MeterStatus.DECOMMISSIONED,
    ).length;
  }

  /** The period's verification whatever state it is in, for explaining. */
  private periodVerification(
    organizationId: string,
    period: string,
  ): SavingsVerification | null {
    for (const audit of this.database.energyAudits) {
      if (audit.organization_id !== organizationId) continue;
      const match = audit.verifications.find((v) => v.period === period);
      if (match) return match;
    }
    return null;
  }

  /**
   * The period's verification, but only if the client accepted it.
   *
   * pricing.ts enforces the same rule again on the way out. That is
   * deliberate belt-and-braces on the one guard that stops an EnerTrack
   * employee enlarging an EnerTrack invoice unilaterally.
   */
  private billableVerification(
    organizationId: string,
    period: string,
  ): SavingsVerification | null {
    const match = this.periodVerification(organizationId, period);
    return match?.status === VerificationStatus.CLIENT_ACCEPTED ? match : null;
  }

  /* ── Revenue reporting ─────────────────────────────────────────── */

  /**
   * Platform-wide revenue. EnerTrack staff only — it aggregates across
   * every tenant, so it must never answer for a client caller.
   *
   * The recurring/outcome split is the number worth looking at: it says
   * how much of the business is predictable. A model where the outcome
   * share dominates is a model at the mercy of the weather.
   */
  revenueSummary() {
    const invoices = this.database.platformInvoices;
    const billable = invoices.filter(
      (i) => i.status !== PlatformInvoiceStatus.DRAFT,
    );

    const sumLines = (type: string) =>
      billable
        .flatMap((i) => i.line_items)
        .filter((l) => l.type === type)
        .reduce((sum, l) => sum + l.amount, 0);

    const recurring = sumLines("subscription");
    const outcome = sumLines("performance-share");
    const auditFees = sumLines("audit-fee");
    const billed = recurring + outcome + auditFees;

    // MRR from live contracts rather than from history, so it reflects
    // what the platform will bill next month, not what it billed last.
    const mrr = this.database.subscriptions
      .filter((s) => s.status === SubscriptionStatus.ACTIVE)
      .reduce((sum, s) => {
        const plan = this.database.subscriptionPlans.find(
          (p) => p.plan_id === s.plan_id,
        );
        if (!plan) return sum;
        const metered =
          this.billedMeterCount(s.organization_id) * plan.price_per_meter_month;
        return sum + Math.max(metered, plan.min_monthly_fee);
      }, 0);

    const byStatus = (status: PlatformInvoiceStatus) =>
      invoices
        .filter((i) => i.status === status)
        .reduce((sum, i) => sum + i.total, 0);

    return {
      mrr,
      arr: mrr * 12,
      billed_to_date: billed,
      revenue_mix: {
        recurring,
        outcome,
        audit_fees: auditFees,
        recurring_pct: billed > 0 ? Math.round((recurring / billed) * 100) : 0,
      },
      collections: {
        paid: byStatus(PlatformInvoiceStatus.PAID),
        issued: byStatus(PlatformInvoiceStatus.ISSUED),
        overdue: byStatus(PlatformInvoiceStatus.OVERDUE),
        draft: byStatus(PlatformInvoiceStatus.DRAFT),
      },
      by_organization: this.database.organizations.map((org) => {
        const own = billable.filter(
          (i) => i.organization_id === org.organization_id,
        );
        const sub = this.database.subscriptions.find(
          (s) =>
            s.organization_id === org.organization_id &&
            s.status !== SubscriptionStatus.CANCELLED,
        );
        const plan = this.database.subscriptionPlans.find(
          (p) => p.plan_id === sub?.plan_id,
        );
        return {
          organization_id: org.organization_id,
          organization_name: org.name,
          status: org.status,
          plan_name: plan?.name ?? null,
          billed_meter_count: this.billedMeterCount(org.organization_id),
          invoices: own.length,
          billed_to_date: own.reduce((sum, i) => sum + i.total, 0),
          outstanding: own
            .filter((i) => i.status !== PlatformInvoiceStatus.PAID)
            .reduce((sum, i) => sum + i.total, 0),
        };
      }),
      by_plan: this.database.subscriptionPlans.map((plan) => {
        const subs = this.database.subscriptions.filter(
          (s) =>
            s.plan_id === plan.plan_id &&
            s.status !== SubscriptionStatus.CANCELLED,
        );
        return {
          plan_id: plan.plan_id,
          plan_name: plan.name,
          subscribers: subs.length,
          mrr: subs.reduce((sum, s) => {
            const metered =
              this.billedMeterCount(s.organization_id) *
              plan.price_per_meter_month;
            return sum + Math.max(metered, plan.min_monthly_fee);
          }, 0),
        };
      }),
    };
  }

  /* ── CRUD and lifecycle ────────────────────────────────────────── */

  create(createDto: CreatePlatformInvoiceDto) {
    const orgId = createDto.organization_id ?? currentOrgId();
    if (!orgId)
      throw new BadRequestException(
        "organization_id is required, either in the body or as the x-org-id header",
      );

    const newRecord = {
      platform_invoice_id: crypto.randomUUID(),
      issued_on: null,
      due_on: null,
      paid_on: null,
      ...createDto,
      organization_id: orgId,
    };
    this.database.platformInvoices.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.platformInvoices).sort((a, b) =>
      b.period.localeCompare(a.period),
    );
  }

  findOne(id: string) {
    const record = assertTenantOwns(
      this.database.platformInvoices.find(
        (item) => item.platform_invoice_id === id,
      ),
    );
    if (!record)
      throw new NotFoundException(`Platform invoice with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutPlatformInvoiceDto) {
    const index = this.indexOf(id);
    this.database.platformInvoices[index] = {
      ...this.database.platformInvoices[index],
      ...(putDto as any),
      platform_invoice_id: id,
      organization_id: this.database.platformInvoices[index].organization_id,
    };
    return this.database.platformInvoices[index];
  }

  update(id: string, updateDto: UpdatePlatformInvoiceDto) {
    const index = this.indexOf(id);
    this.database.platformInvoices[index] = {
      ...this.database.platformInvoices[index],
      ...(updateDto as any),
      platform_invoice_id: id,
      organization_id: this.database.platformInvoices[index].organization_id,
    };
    return this.database.platformInvoices[index];
  }

  /** Draft → issued. Sets the issue and due dates from the payment terms. */
  issue(id: string, issuedOn?: string) {
    const invoice = this.findOne(id);
    if (invoice.status !== PlatformInvoiceStatus.DRAFT)
      throw new ConflictException(
        `Invoice ${id} is already ${invoice.status} and cannot be issued again`,
      );

    const issued = issuedOn ?? new Date().toISOString().slice(0, 10);
    const due = new Date(issued);
    due.setDate(due.getDate() + PAYMENT_TERMS_DAYS);

    invoice.status = PlatformInvoiceStatus.ISSUED;
    invoice.issued_on = issued;
    invoice.due_on = due.toISOString().slice(0, 10);
    return invoice;
  }

  markPaid(id: string, paidOn?: string) {
    const invoice = this.findOne(id);
    if (invoice.status === PlatformInvoiceStatus.DRAFT)
      throw new ConflictException(
        `Invoice ${id} has not been issued yet, so it cannot be marked paid`,
      );
    if (invoice.status === PlatformInvoiceStatus.PAID)
      throw new ConflictException(`Invoice ${id} is already marked paid`);

    invoice.status = PlatformInvoiceStatus.PAID;
    invoice.paid_on = paidOn ?? new Date().toISOString().slice(0, 10);
    return invoice;
  }

  remove(id: string) {
    const index = this.indexOf(id);
    const invoice = this.database.platformInvoices[index];
    if (invoice.status === PlatformInvoiceStatus.PAID)
      throw new ConflictException(
        `Cannot delete invoice ${id}: it has been paid. Raise a credit note instead.`,
      );
    return this.database.platformInvoices.splice(index, 1)[0];
  }

  private indexOf(id: string): number {
    const index = this.database.platformInvoices.findIndex(
      (item) => item.platform_invoice_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.platformInvoices[index]))
      throw new NotFoundException(`Platform invoice with ID ${id} not found`);
    return index;
  }
}
