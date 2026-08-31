import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { PutWorkOrderDto } from "./dto/put-work-order.dto";

import { UpdateWorkOrderDto } from "./dto/update-work-order.dto";

@Injectable()
export class WorkOrdersService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateWorkOrderDto) {
    const organizationId = currentOrgId() ?? createDto.organization_id ?? null;
    this.assertAssigneeInOrg(createDto.assigned_to_id, organizationId);
    if (createDto.linked_fault_id) {
      const exists = this.database.faults.find(
        (x) => x.fault_id === createDto.linked_fault_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target faults with id '${createDto.linked_fault_id}' not found`,
        );
    }
    if (createDto.source_request_id) {
      const exists = this.database.serviceRequests.find(
        (x) => x.service_request_id === createDto.source_request_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target serviceRequests with id '${createDto.source_request_id}' not found`,
        );
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { work_order_id: generatedId, ...createDto, organization_id: organizationId };
    this.database.workOrders.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.workOrders);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.workOrders.find(
      (item) => item.work_order_id === id,
    ));
    if (!record)
      throw new NotFoundException(`WorkOrder with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutWorkOrderDto) {
    const index = this.database.workOrders.findIndex(
      (item) => item.work_order_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.workOrders[index]))
      throw new NotFoundException(`Work Order with ID ${id} not found`);
    this.assertAssigneeInOrg(
      putDto.assigned_to_id,
      this.database.workOrders[index].organization_id,
    );
    this.database.workOrders[index] = {
      work_order_id: id,
      ...putDto,
      organization_id: this.database.workOrders[index].organization_id,
    } as any;
    return this.database.workOrders[index];
  }
  update(id: string, updateDto: UpdateWorkOrderDto) {
    const index = this.database.workOrders.findIndex(
      (item) => item.work_order_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.workOrders[index]))
      throw new NotFoundException(`WorkOrder with ID ${id} not found`);
    this.assertAssigneeInOrg(
      updateDto.assigned_to_id,
      this.database.workOrders[index].organization_id,
    );
    this.database.workOrders[index] = {
      ...this.database.workOrders[index],
      ...updateDto,
      organization_id: this.database.workOrders[index].organization_id,
    };
    return this.database.workOrders[index];
  }

  /** A technician can only be assigned to a work order in their own organisation. */
  private assertAssigneeInOrg(
    assignedToId: string | undefined,
    organizationId: string | null,
  ) {
    if (!assignedToId) return;
    const assignee = this.database.users.find(
      (x) => x.user_id === assignedToId,
    );
    if (!assignee)
      throw new NotFoundException(
        `Target users with id '${assignedToId}' not found`,
      );
    if (organizationId && assignee.organization_id !== organizationId)
      throw new BadRequestException(
        `Technician ${assignedToId} belongs to a different organisation than this work order`,
      );
  }

  remove(id: string) {
    const index = this.database.workOrders.findIndex(
      (item) => item.work_order_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.workOrders[index]))
      throw new NotFoundException(`WorkOrder with ID ${id} not found`);
    const removed = this.database.workOrders.splice(index, 1);
    return removed[0];
  }
}
