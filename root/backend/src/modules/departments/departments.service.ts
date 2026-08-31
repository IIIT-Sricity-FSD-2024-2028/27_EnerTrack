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
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { PutDepartmentDto } from "./dto/put-department.dto";

import { UpdateDepartmentDto } from "./dto/update-department.dto";

@Injectable()
export class DepartmentsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateDepartmentDto) {
    if (createDto.building_id) {
      const exists = this.database.buildings.find(
        (x) => x.building_id === createDto.building_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target buildings with id '${createDto.building_id}' not found`,
        );
    }
    const orgId = currentOrgId() ?? createDto.organization_id ?? null;
    this.assertAuditorHasOpenEngagement(orgId);
    const generatedId = crypto.randomUUID();
    const newRecord = { department_id: generatedId, ...createDto, organization_id: orgId };
    this.database.departments.push(newRecord as any);
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
    return scopeToTenant(this.database.departments);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.departments.find(
      (item) => item.department_id === id,
    ));
    if (!record)
      throw new NotFoundException(`Department with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutDepartmentDto) {
    const index = this.database.departments.findIndex(
      (item) => item.department_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.departments[index]))
      throw new NotFoundException(`Department with ID ${id} not found`);
    this.assertAuditorHasOpenEngagement(this.database.departments[index].organization_id);
    this.database.departments[index] = {
      department_id: id,
      ...putDto,
      organization_id: this.database.departments[index].organization_id,
    } as any;
    return this.database.departments[index];
  }
  update(id: string, updateDto: UpdateDepartmentDto) {
    const index = this.database.departments.findIndex(
      (item) => item.department_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.departments[index]))
      throw new NotFoundException(`Department with ID ${id} not found`);
    this.assertAuditorHasOpenEngagement(this.database.departments[index].organization_id);
    this.database.departments[index] = {
      ...this.database.departments[index],
      ...updateDto,
      organization_id: this.database.departments[index].organization_id,
    };
    return this.database.departments[index];
  }

  remove(id: string) {
    const index = this.database.departments.findIndex(
      (item) => item.department_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.departments[index]))
      throw new NotFoundException(`Department with ID ${id} not found`);
    this.assertAuditorHasOpenEngagement(this.database.departments[index].organization_id);
    const removed = this.database.departments.splice(index, 1);
    return removed[0];
  }

  getInvoices(id: string) {
    return scopeToTenant(this.database.invoices.filter((item) => item.department_id === id));
  }
}
