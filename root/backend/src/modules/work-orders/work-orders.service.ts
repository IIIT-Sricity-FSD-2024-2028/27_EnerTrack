import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  DatabaseService,
  ExpenseBillStatus,
  WorkOrderStatus,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { PutWorkOrderDto } from "./dto/put-work-order.dto";

import { UpdateWorkOrderDto } from "./dto/update-work-order.dto";
import { DispatchService } from "../dispatch/dispatch.service";

const DISPATCH_VISIBLE_ROLES = new Set([
  "Organization Admin",
  "Operations Coordinator",
  "Facility Manager",
  "Technician",
  "Financial Analyst",
  "Super Admin",
]);

@Injectable()
export class WorkOrdersService {
  constructor(
    private database: DatabaseService,
    private dispatch: DispatchService,
  ) {}

  create(createDto: CreateWorkOrderDto, role?: string) {
    // Jobs are pushed by the system; a technician cannot create one for themselves.
    if (role === "Technician") throw new ForbiddenException("Work orders are assigned by the system.");
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
      // One open job per issue: the system may already have assigned this one.
      const open = this.database.workOrders.find(
        (w) => w.source_request_id === createDto.source_request_id && w.status !== "closed",
      );
      if (open)
        throw new ConflictException("This issue already has an open work order.");
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { work_order_id: generatedId, ...createDto, organization_id: organizationId };
    this.database.workOrders.push(newRecord as any);
    return newRecord;
  }

  /**
   * Dispatch history names staff and their declines, so only these roles get
   * it. An allowlist: a role not listed (or none) gets the list without it.
   * The role comes from the verified token (AuthMiddleware), not the client.
   */
  findAll(role?: string) {
    const all = scopeToTenant(this.database.workOrders);
    if (role && DISPATCH_VISIBLE_ROLES.has(role)) return all;
    return all.map(({ dispatch: _dispatch, ...rest }) => rest);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.workOrders.find(
      (item) => item.work_order_id === id,
    ));
    if (!record)
      throw new NotFoundException(`WorkOrder with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutWorkOrderDto, role?: string, userId?: string) {
    const index = this.database.workOrders.findIndex(
      (item) => item.work_order_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.workOrders[index]))
      throw new NotFoundException(`Work Order with ID ${id} not found`);
    const before = this.database.workOrders[index];
    this.assertAssigneeInOrg(putDto.assigned_to_id, before.organization_id);
    // A replace must not wipe the dispatch record, and must not be a back door
    // around the assignment rules: reassigning goes through dispatch.
    const safe = this.dispatch.guardUpdate(before, { ...putDto }, role, userId) as any;
    this.assertBillsSettledBeforeClose(id, safe.status, before.status);
    this.database.workOrders[index] = {
      work_order_id: id,
      ...safe,
      assigned_to_id: before.dispatch ? before.assigned_to_id : safe.assigned_to_id,
      organization_id: before.organization_id,
      ...(before.dispatch ? { dispatch: before.dispatch } : {}),
    } as any;
    this.dispatch.onStatusChange(this.database.workOrders[index]);
    this.dispatch.estimateNotices(before.status, this.database.workOrders[index]);
    return this.database.workOrders[index];
  }
  update(id: string, updateDto: UpdateWorkOrderDto, role?: string, userId?: string) {
    const index = this.database.workOrders.findIndex(
      (item) => item.work_order_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.workOrders[index]))
      throw new NotFoundException(`WorkOrder with ID ${id} not found`);
    this.assertAssigneeInOrg(
      updateDto.assigned_to_id,
      this.database.workOrders[index].organization_id,
    );
    // Dispatched jobs: who may change what is decided in one place.
    const previous = this.database.workOrders[index].status;
    const safe = this.dispatch.guardUpdate(this.database.workOrders[index], { ...updateDto }, role, userId);
    this.assertBillsSettledBeforeClose(id, safe.status ?? previous, previous);
    this.database.workOrders[index] = {
      ...this.database.workOrders[index],
      ...safe,
      organization_id: this.database.workOrders[index].organization_id,
    };
    this.dispatch.onStatusChange(this.database.workOrders[index]);
    this.dispatch.estimateNotices(previous, this.database.workOrders[index]);
    return this.database.workOrders[index];
  }

  private assertBillsSettledBeforeClose(workOrderId: string, nextStatus: string, prevStatus: string) {
    if (nextStatus !== WorkOrderStatus.CLOSED || prevStatus === WorkOrderStatus.CLOSED) return;
    const unsettled = this.database.expenseBills.filter(
      (b) => b.work_order_id === workOrderId && b.status !== ExpenseBillStatus.APPROVED,
    );
    if (unsettled.length > 0) {
      throw new BadRequestException(
        `Cannot close this work order while ${unsettled.length} expense bill(s) are still pending Finance sign-off or revision.`,
      );
    }
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
