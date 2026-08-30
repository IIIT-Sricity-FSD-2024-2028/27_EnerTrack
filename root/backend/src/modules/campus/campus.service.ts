import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import {
  DatabaseService,
  SubscriptionStatus,
  AuditStatus,
  UserRole,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
  getTenantContext,
} from "../../core/tenancy/tenant-context";
import { CreateCampusDto } from "./dto/create-campus.dto";
import { PutCampusDto } from "./dto/put-campus.dto";

import { UpdateCampusDto } from "./dto/update-campus.dto";

@Injectable()
export class CampusService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateCampusDto) {
    const orgId = currentOrgId() ?? createDto.organization_id ?? null;
    this.assertAuditorHasOpenEngagement(orgId);
    if (orgId) this.assertCampusAllowanceNotExceeded(orgId);

    const generatedId = crypto.randomUUID();
    const newRecord = { campus_id: generatedId, ...createDto, organization_id: orgId };
    this.database.campus.push(newRecord as any);
    return newRecord;
  }

  /**
   * A Certified Energy Auditor is platform-side, with no tenant of their
   * own, so nothing else stops them writing to any organisation's
   * infrastructure. The one real constraint: they may only do it while
   * that organisation has an audit still open. This isn't identity-checked
   * — there's no per-caller id in this system's headers to check against,
   * the same reason impersonate() is documented as not a real security
   * boundary — but it does mean the access self-expires the moment the
   * audit is accepted or declined, for free, since that's a state
   * transition the system already makes.
   */
  private assertAuditorHasOpenEngagement(organizationId: string | null) {
    if (getTenantContext()?.role !== UserRole.CERTIFIED_ENERGY_AUDITOR) return;

    const open = this.database.energyAudits.some(
      (a) =>
        a.organization_id === organizationId &&
        a.status !== AuditStatus.ACCEPTED &&
        a.status !== AuditStatus.DECLINED,
    );
    if (!open)
      throw new ForbiddenException(
        "No open audit for this organisation — infrastructure can only be edited while a survey is in progress.",
      );
  }

  /**
   * The one hard limit in the subscription model.
   *
   * Seats are metered — going over the allowance bills an overage rather
   * than blocking a hire, because refusing to let a client add staff would
   * be hostile. Campuses are different: a campus is the top of the whole
   * data hierarchy, so an extra one is a step change in what the platform
   * is being asked to manage, and the tier is what that step is priced by.
   *
   * An organisation with no subscription is not blocked. Onboarding sets
   * up infrastructure before the contract exists, and failing there would
   * make a prospect impossible to demo.
   */
  private assertCampusAllowanceNotExceeded(organizationId: string) {
    const subscription = this.database.subscriptions.find(
      (s) =>
        s.organization_id === organizationId &&
        s.status !== SubscriptionStatus.CANCELLED,
    );
    if (!subscription) return;

    const plan = this.database.subscriptionPlans.find(
      (p) => p.plan_id === subscription.plan_id,
    );
    // null max_campuses means unlimited, which is what Enterprise buys.
    if (!plan || plan.max_campuses === null) return;

    const existing = this.database.campus.filter(
      (c) => c.organization_id === organizationId,
    ).length;

    if (existing >= plan.max_campuses)
      throw new ConflictException(
        `The ${plan.name} plan covers ${plan.max_campuses} campus${plan.max_campuses === 1 ? "" : "es"} ` +
          `and this organisation already has ${existing}. Upgrade the plan to add another.`,
      );
  }

  findAll() {
    return scopeToTenant(this.database.campus);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.campus.find((item) => item.campus_id === id));
    if (!record) throw new NotFoundException(`Campus with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutCampusDto) {
    const index = this.database.campus.findIndex(
      (item) => item.campus_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.campus[index]))
      throw new NotFoundException(`Campus with ID ${id} not found`);
    this.assertAuditorHasOpenEngagement(this.database.campus[index].organization_id);
    this.database.campus[index] = {
      campus_id: id,
      ...putDto,
      organization_id: this.database.campus[index].organization_id,
    } as any;
    return this.database.campus[index];
  }
  update(id: string, updateDto: UpdateCampusDto) {
    const index = this.database.campus.findIndex(
      (item) => item.campus_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.campus[index]))
      throw new NotFoundException(`Campus with ID ${id} not found`);
    this.assertAuditorHasOpenEngagement(this.database.campus[index].organization_id);
    this.database.campus[index] = {
      ...this.database.campus[index],
      ...updateDto,
      organization_id: this.database.campus[index].organization_id,
    };
    return this.database.campus[index];
  }

  remove(id: string) {
    const index = this.database.campus.findIndex(
      (item) => item.campus_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.campus[index]))
      throw new NotFoundException(`Campus with ID ${id} not found`);
    this.assertAuditorHasOpenEngagement(this.database.campus[index].organization_id);
    const removed = this.database.campus.splice(index, 1);
    return removed[0];
  }

  getBuildings(id: string) {
    return scopeToTenant(this.database.buildings.filter((item) => item.campus_id === id));
  }
}
