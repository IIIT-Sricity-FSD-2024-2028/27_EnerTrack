import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  DatabaseService,
  PlatformInvoice,
  PlatformInvoiceStatus,
  SubscriptionStatus,
  UserRole,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { buildInvoice, seatsOverAllowance } from "../billing/pricing";
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
 * tested, in one file.
 */
@Injectable()
export class PlatformInvoicesService {
  /**
   * Staff accounts in an organisation.
   *
   * Every user except a Campus Visitor. That is the only carve-out, and it
   * exists because a university may have thousands of students filing
   * wastage reports — billing per student would be absurd, and it would
   * punish the client for opening the product up to the people who spot
   * problems first.
   */
  private billableStaff(organizationId: string): number {
    return this.database.users.filter(
      (u) =>
        u.organization_id === organizationId &&
        u.role !== UserRole.CAMPUS_VISITOR,
    ).length;
  }

  constructor(private database: DatabaseService) {}

  /* ── The engine ────────────────────────────────────────────────── */

  /**
   * Builds one period's invoice from platform state.
   *
   * Nothing here is typed by a human: the tier fee comes from the plan and
   * the overage from a live headcount. Returns a draft — issuing it is a
   * separate, deliberate act.
   */
  generate(dto: GenerateInvoiceDto) {
    const { org, subscription, plan } = this.resolve(dto.organization_id);

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
      billableStaff: this.billableStaff(dto.organization_id),
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

  /** Computes a period's invoice without saving it. */
  preview(organizationId: string, period: string) {
    const { org, subscription, plan } = this.resolve(organizationId);
    const staff = this.billableStaff(organizationId);
    const campuses = this.campusCount(organizationId);

    return {
      organization_id: organizationId,
      organization_name: org.name,
      period,
      plan_name: plan.name,
      billable_staff: staff,
      included_seats: plan.included_seats,
      seats_over_allowance: seatsOverAllowance(plan, staff),
      campuses_used: campuses,
      max_campuses: plan.max_campuses,
      ...buildInvoice({
        period,
        subscription,
        plan,
        billableStaff: staff,
      }),
    };
  }

  /** Shared lookup for the org, its live contract, and that contract's tier. */
  private resolve(organizationId: string) {
    const org = this.database.organizations.find(
      (o) => o.organization_id === organizationId,
    );
    if (!org)
      throw new NotFoundException(
        `Organization with ID ${organizationId} not found`,
      );

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
      throw new NotFoundException(
        `Subscription ${subscription.subscription_id} references plan ${subscription.plan_id}, which no longer exists`,
      );

    return { org, subscription, plan };
  }

  private campusCount(organizationId: string): number {
    return this.database.campus.filter(
      (c) => c.organization_id === organizationId,
    ).length;
  }

  /* ── Revenue reporting ─────────────────────────────────────────── */

  /**
   * Platform-wide revenue. EnerTrack staff only — it aggregates across
   * every tenant, so it must never answer for a client caller.
   *
   * Seat utilisation is the number worth watching: an organisation close
   * to or over its allowance is the natural upgrade conversation, and it
   * is a far more actionable signal than a revenue total.
   */
  revenueSummary() {
    const invoices = this.database.platformInvoices;
    const billed = invoices.filter(
      (i) => i.status !== PlatformInvoiceStatus.DRAFT,
    );

    const liveSubs = this.database.subscriptions.filter(
      (s) => s.status === SubscriptionStatus.ACTIVE,
    );

    const monthlyFor = (organizationId: string, planId: string) => {
      const plan = this.database.subscriptionPlans.find(
        (p) => p.plan_id === planId,
      );
      if (!plan) return 0;
      const staff = this.billableStaff(organizationId);
      return (
        plan.base_monthly_fee +
        seatsOverAllowance(plan, staff) * plan.price_per_extra_seat
      );
    };

    const mrr = liveSubs.reduce(
      (sum, s) => sum + monthlyFor(s.organization_id, s.plan_id),
      0,
    );

    const byStatus = (status: PlatformInvoiceStatus) =>
      invoices
        .filter((i) => i.status === status)
        .reduce((sum, i) => sum + i.total, 0);

    return {
      mrr,
      arr: mrr * 12,
      billed_to_date: billed.reduce((sum, i) => sum + i.total, 0),
      collections: {
        paid: byStatus(PlatformInvoiceStatus.PAID),
        issued: byStatus(PlatformInvoiceStatus.ISSUED),
        overdue: byStatus(PlatformInvoiceStatus.OVERDUE),
        draft: byStatus(PlatformInvoiceStatus.DRAFT),
      },
      by_organization: this.database.organizations.map((org) => {
        const own = billed.filter(
          (i) => i.organization_id === org.organization_id,
        );
        const sub = liveSubs.find(
          (s) => s.organization_id === org.organization_id,
        );
        const plan = this.database.subscriptionPlans.find(
          (p) => p.plan_id === sub?.plan_id,
        );
        const staff = this.billableStaff(org.organization_id);

        return {
          organization_id: org.organization_id,
          organization_name: org.name,
          status: org.status,
          plan_name: plan?.name ?? null,
          billable_staff: staff,
          included_seats: plan?.included_seats ?? null,
          seats_over_allowance: plan ? seatsOverAllowance(plan, staff) : 0,
          // Above 100% means they are paying an overage; near 100% is the
          // upsell prompt.
          seat_utilisation_pct:
            plan && plan.included_seats > 0
              ? Math.round((staff / plan.included_seats) * 100)
              : null,
          campuses_used: this.campusCount(org.organization_id),
          max_campuses: plan?.max_campuses ?? null,
          monthly: sub ? monthlyFor(org.organization_id, sub.plan_id) : 0,
          billed_to_date: own.reduce((sum, i) => sum + i.total, 0),
          outstanding: own
            .filter((i) => i.status !== PlatformInvoiceStatus.PAID)
            .reduce((sum, i) => sum + i.total, 0),
        };
      }),
      by_plan: this.database.subscriptionPlans.map((plan) => {
        const subs = liveSubs.filter((s) => s.plan_id === plan.plan_id);
        return {
          plan_id: plan.plan_id,
          plan_name: plan.name,
          subscribers: subs.length,
          mrr: subs.reduce(
            (sum, s) => sum + monthlyFor(s.organization_id, plan.plan_id),
            0,
          ),
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
