import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { CreateSubscriptionPlanDto } from "./dto/create-subscription-plan.dto";
import { PutSubscriptionPlanDto } from "./dto/put-subscription-plan.dto";
import { UpdateSubscriptionPlanDto } from "./dto/update-subscription-plan.dto";

/**
 * The price catalogue.
 *
 * The one service in the codebase that deliberately does NOT call
 * scopeToTenant(). A plan has no organization_id: it is EnerTrack's own
 * catalogue, the same list for every client, so tenant-scoping it would
 * filter every row away for a client and break the sign-up page. The same
 * exception OrganizationsService.listPublic() already makes.
 *
 * That also means the write routes carry the whole burden of protecting
 * it, which is why they are @Roles("Super Admin") and nothing wider.
 */
@Injectable()
export class SubscriptionPlansService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateSubscriptionPlanDto) {
    const exists = this.database.subscriptionPlans.find(
      (p) => p.name.toLowerCase() === createDto.name.toLowerCase(),
    );
    if (exists)
      throw new ConflictException(
        `A subscription plan named '${createDto.name}' already exists`,
      );

    const newRecord = {
      plan_id: crypto.randomUUID(),
      is_active: true,
      ...createDto,
    };
    this.database.subscriptionPlans.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.subscriptionPlans;
  }

  /**
   * The public catalogue, for the landing page's pricing section.
   *
   * A projection rather than the whole row: it drops is_active, which is
   * internal state the filter above has already applied. Everything a
   * visitor needs to compare tiers is here, which is the point — the
   * marketing page and the billing engine read the same catalogue, so the
   * published price and the charged price cannot drift apart.
   */
  listPublic() {
    return this.database.subscriptionPlans
      .filter((p) => p.is_active)
      .map((p) => ({
        plan_id: p.plan_id,
        name: p.name,
        tagline: p.tagline,
        base_monthly_fee: p.base_monthly_fee,
        included_seats: p.included_seats,
        price_per_extra_seat: p.price_per_extra_seat,
        max_campuses: p.max_campuses,
        features: p.features,
      }));
  }

  findOne(id: string) {
    const record = this.database.subscriptionPlans.find(
      (item) => item.plan_id === id,
    );
    if (!record)
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutSubscriptionPlanDto) {
    const index = this.database.subscriptionPlans.findIndex(
      (item) => item.plan_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    this.database.subscriptionPlans[index] = {
      plan_id: id,
      is_active: true,
      ...putDto,
    } as any;
    return this.database.subscriptionPlans[index];
  }

  update(id: string, updateDto: UpdateSubscriptionPlanDto) {
    const index = this.database.subscriptionPlans.findIndex(
      (item) => item.plan_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    this.database.subscriptionPlans[index] = {
      ...this.database.subscriptionPlans[index],
      ...updateDto,
      plan_id: id,
    };
    return this.database.subscriptionPlans[index];
  }

  /**
   * Refused while any subscription still points at the plan.
   *
   * Without this the billing engine would look up a plan_id that no longer
   * resolves and every invoice for that client would fail. Deactivating
   * (PATCH is_active: false) is the way to retire a tier: existing
   * contracts keep billing, and it stops appearing in the public list.
   */
  remove(id: string) {
    const index = this.database.subscriptionPlans.findIndex(
      (item) => item.plan_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);

    const inUse = this.database.subscriptions.filter(
      (s) => s.plan_id === id,
    ).length;
    if (inUse > 0)
      throw new ConflictException(
        `Cannot delete plan ${id}: ${inUse} subscription(s) still use it. ` +
          `Set is_active to false to retire it instead.`,
      );

    return this.database.subscriptionPlans.splice(index, 1)[0];
  }

  /** Organisations currently on this plan. */
  getSubscribers(id: string) {
    this.findOne(id);
    return this.database.subscriptions
      .filter((s) => s.plan_id === id)
      .map((s) => ({
        subscription_id: s.subscription_id,
        organization_id: s.organization_id,
        organization_name:
          this.database.organizations.find(
            (o) => o.organization_id === s.organization_id,
          )?.name ?? null,
        status: s.status,
        billing_cycle: s.billing_cycle,
        renews_on: s.renews_on,
      }));
  }
}
