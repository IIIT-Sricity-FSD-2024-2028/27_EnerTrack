import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import {
  DatabaseService,
  AuditStatus,
  UserRole,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
  getTenantContext,
} from "../../core/tenancy/tenant-context";
import { CreateBuildingDto } from "./dto/create-building.dto";
import { PutBuildingDto } from "./dto/put-building.dto";

import { UpdateBuildingDto } from "./dto/update-building.dto";

@Injectable()
export class BuildingsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateBuildingDto) {
    if (createDto.campus_id) {
      const exists = this.database.campus.find(
        (x) => x.campus_id === createDto.campus_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target campus with id '${createDto.campus_id}' not found`,
        );
    }
    const orgId = currentOrgId() ?? createDto.organization_id ?? null;
    this.assertAuditorHasOpenEngagement(orgId);
    const generatedId = crypto.randomUUID();
    const newRecord = { building_id: generatedId, ...createDto, organization_id: orgId };
    this.database.buildings.push(newRecord as any);
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

  findAll() {
    return scopeToTenant(this.database.buildings);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.buildings.find(
      (item) => item.building_id === id,
    ));
    if (!record)
      throw new NotFoundException(`Building with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutBuildingDto) {
    const index = this.database.buildings.findIndex(
      (item) => item.building_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.buildings[index]))
      throw new NotFoundException(`Building with ID ${id} not found`);
    this.assertAuditorHasOpenEngagement(this.database.buildings[index].organization_id);
    this.database.buildings[index] = {
      building_id: id,
      ...putDto,
      organization_id: this.database.buildings[index].organization_id,
    } as any;
    return this.database.buildings[index];
  }
  update(id: string, updateDto: UpdateBuildingDto) {
    const index = this.database.buildings.findIndex(
      (item) => item.building_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.buildings[index]))
      throw new NotFoundException(`Building with ID ${id} not found`);
    this.assertAuditorHasOpenEngagement(this.database.buildings[index].organization_id);
    this.database.buildings[index] = {
      ...this.database.buildings[index],
      ...updateDto,
      organization_id: this.database.buildings[index].organization_id,
    };
    return this.database.buildings[index];
  }

  remove(id: string) {
    const index = this.database.buildings.findIndex(
      (item) => item.building_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.buildings[index]))
      throw new NotFoundException(`Building with ID ${id} not found`);
    this.assertAuditorHasOpenEngagement(this.database.buildings[index].organization_id);
    const removed = this.database.buildings.splice(index, 1);
    return removed[0];
  }

  getDepartments(id: string) {
    return scopeToTenant(this.database.departments.filter((item) => item.building_id === id));
  }

  getMeters(id: string) {
    return scopeToTenant(this.database.meters.filter((item) => item.building_id === id));
  }
}
