import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  DatabaseService,
  SubscriptionStatus,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { PutSubscriptionDto } from "./dto/put-subscription.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";

/**
 * Contracts between EnerTrack and its clients.
 *
 * Reads go through scopeToTenant() unchanged, and that single call gives
 * both audiences the right answer for free: platform staff send no
 * x-org-id and see every contract, a client sends theirs and sees only its
 * own. Writes are restricted at the controller instead — the record is
 * EnerTrack's, about the client, so the client may read it but not edit it.
 */
@Injectable()
export class SubscriptionsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateSubscriptionDto) {
    const orgId = createDto.organization_id ?? currentOrgId();
    if (!orgId)
      throw new BadRequestException(
        "organization_id is required, either in the body or as the x-org-id header",
      );

    const org = this.database.organizations.find(
      (o) => o.organization_id === orgId,
    );
    if (!org)
      throw new NotFoundException(`Organization with ID ${orgId} not found`);

    const plan = this.database.subscriptionPlans.find(
      (p) => p.plan_id === createDto.plan_id,
    );
    if (!plan)
      throw new NotFoundException(
        `Subscription plan with ID ${createDto.plan_id} not found`,
      );

    // One live contract per tenant. Two would make "which plan is this
    // client on?" ambiguous, and the billing engine has to answer that
    // question for every invoice it generates.
    const live = this.database.subscriptions.find(
      (s) =>
        s.organization_id === orgId &&
        s.status !== SubscriptionStatus.CANCELLED,
    );
    if (live)
      throw new ConflictException(
        `Organization ${orgId} already has an active subscription (${live.subscription_id}). Cancel it before opening another.`,
      );

    const newRecord = {
      subscription_id: crypto.randomUUID(),
      cancelled_on: null,
      ...createDto,
      organization_id: orgId,
    };
    this.database.subscriptions.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.subscriptions);
  }

  findOne(id: string) {
    const record = assertTenantOwns(
      this.database.subscriptions.find((item) => item.subscription_id === id),
    );
    if (!record)
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    return record;
  }

  /** The live contract for one organisation, with its plan inlined. */
  findByOrganization(orgId: string) {
    const record = assertTenantOwns(
      this.database.subscriptions.find(
        (s) =>
          s.organization_id === orgId &&
          s.status !== SubscriptionStatus.CANCELLED,
      ),
    );
    if (!record)
      throw new NotFoundException(
        `No active subscription found for organization ${orgId}`,
      );

    return {
      ...record,
      plan:
        this.database.subscriptionPlans.find(
          (p) => p.plan_id === record.plan_id,
        ) ?? null,
    };
  }

  put(id: string, putDto: PutSubscriptionDto) {
    const index = this.indexOf(id);
    this.database.subscriptions[index] = {
      subscription_id: id,
      ...putDto,
      organization_id: this.database.subscriptions[index].organization_id,
    } as any;
    return this.database.subscriptions[index];
  }

  update(id: string, updateDto: UpdateSubscriptionDto) {
    const index = this.indexOf(id);
    this.database.subscriptions[index] = {
      ...this.database.subscriptions[index],
      ...updateDto,
      subscription_id: id,
      // The tenant of a contract is fixed at creation. Letting a PATCH move
      // it would silently transfer one client's billing history to another.
      organization_id: this.database.subscriptions[index].organization_id,
    };
    return this.database.subscriptions[index];
  }

  /** Moves a contract onto a different tier from the next invoice on. */
  changePlan(id: string, planId: string) {
    const index = this.indexOf(id);
    const plan = this.database.subscriptionPlans.find(
      (p) => p.plan_id === planId,
    );
    if (!plan)
      throw new NotFoundException(`Subscription plan with ID ${planId} not found`);
    if (!plan.is_active)
      throw new ConflictException(
        `Plan '${plan.name}' is retired and cannot be assigned to a contract`,
      );

    this.database.subscriptions[index].plan_id = planId;
    return this.database.subscriptions[index];
  }

  /** Extends the term by one year and clears any past-due flag. */
  renew(id: string, renewsOn?: string) {
    const index = this.indexOf(id);
    const current = this.database.subscriptions[index];

    const next =
      renewsOn ??
      (() => {
        const from = current.renews_on ? new Date(current.renews_on) : new Date();
        from.setFullYear(from.getFullYear() + 1);
        return from.toISOString().slice(0, 10);
      })();

    current.renews_on = next;
    current.status = SubscriptionStatus.ACTIVE;
    current.cancelled_on = null;
    return current;
  }

  cancel(id: string, cancelledOn?: string) {
    const index = this.indexOf(id);
    const current = this.database.subscriptions[index];
    current.status = SubscriptionStatus.CANCELLED;
    current.cancelled_on = cancelledOn ?? new Date().toISOString().slice(0, 10);
    return current;
  }

  remove(id: string) {
    const index = this.indexOf(id);
    const invoiceCount = this.database.platformInvoices.filter(
      (i) => i.subscription_id === id,
    ).length;
    if (invoiceCount > 0)
      throw new ConflictException(
        `Cannot delete subscription ${id}: ${invoiceCount} platform invoice(s) reference it. Cancel it instead.`,
      );
    return this.database.subscriptions.splice(index, 1)[0];
  }

  /** Platform invoices raised against this contract, newest period first. */
  getInvoices(id: string) {
    this.findOne(id);
    return this.database.platformInvoices
      .filter((i) => i.subscription_id === id)
      .sort((a, b) => b.period.localeCompare(a.period));
  }

  /** Shared lookup: resolves an id, or throws, respecting tenant scope. */
  private indexOf(id: string): number {
    const index = this.database.subscriptions.findIndex(
      (item) => item.subscription_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.subscriptions[index]))
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    return index;
  }
}
