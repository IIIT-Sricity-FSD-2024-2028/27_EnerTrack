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
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { PutServiceRequestDto } from "./dto/put-service-request.dto";

import { UpdateServiceRequestDto } from "./dto/update-service-request.dto";

@Injectable()
export class ServiceRequestsService {
  constructor(private database: DatabaseService) {}

  /** A report can only be routed to the org's own Technician Administrator
   * (or its B2B equivalent, Facility Manager) or Sustainability Officer —
   * the two roles an end user's report can reach, never an arbitrary user. */
  private assertValidRecipient(
    assignedToId: string | undefined,
    organizationId: string | null,
  ) {
    if (!assignedToId) return;
    const recipient = this.database.users.find(
      (x) => x.user_id === assignedToId,
    );
    if (!recipient)
      throw new NotFoundException(
        `Target users with id '${assignedToId}' not found`,
      );
    if (organizationId && recipient.organization_id !== organizationId)
      throw new BadRequestException(
        `User ${assignedToId} belongs to a different organisation than this service request`,
      );
    const allowedRoles = [
      "Technician Administrator",
      "Facility Manager",
      "Sustainability Officer",
    ];
    if (!allowedRoles.includes(recipient.role))
      throw new BadRequestException(
        `Service requests can only be assigned to a Technician Administrator or Sustainability Officer`,
      );
  }

  create(createDto: CreateServiceRequestDto) {
    if (createDto.reporter_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.reporter_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.reporter_id}' not found`,
        );
    }
    const organizationId = currentOrgId() ?? createDto.organization_id ?? null;
    this.assertValidRecipient(createDto.assigned_to_id, organizationId);
    const generatedId = crypto.randomUUID();
    const newRecord = { service_request_id: generatedId, ...createDto, organization_id: organizationId };
    this.database.serviceRequests.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.serviceRequests);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.serviceRequests.find(
      (item) => item.service_request_id === id,
    ));
    if (!record)
      throw new NotFoundException(`ServiceRequest with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutServiceRequestDto) {
    const index = this.database.serviceRequests.findIndex(
      (item) => item.service_request_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.serviceRequests[index]))
      throw new NotFoundException(`Service Request with ID ${id} not found`);
    this.assertValidRecipient(
      putDto.assigned_to_id,
      this.database.serviceRequests[index].organization_id,
    );
    this.database.serviceRequests[index] = {
      service_request_id: id,
      ...putDto,
    } as any;
    return this.database.serviceRequests[index];
  }
  update(id: string, updateDto: UpdateServiceRequestDto) {
    const index = this.database.serviceRequests.findIndex(
      (item) => item.service_request_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.serviceRequests[index]))
      throw new NotFoundException(`ServiceRequest with ID ${id} not found`);
    this.assertValidRecipient(
      updateDto.assigned_to_id,
      this.database.serviceRequests[index].organization_id,
    );
    this.database.serviceRequests[index] = {
      ...this.database.serviceRequests[index],
      ...updateDto,
      organization_id: this.database.serviceRequests[index].organization_id,
    };
    return this.database.serviceRequests[index];
  }

  remove(id: string) {
    const index = this.database.serviceRequests.findIndex(
      (item) => item.service_request_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.serviceRequests[index]))
      throw new NotFoundException(`ServiceRequest with ID ${id} not found`);
    const removed = this.database.serviceRequests.splice(index, 1);
    return removed[0];
  }

  getWorkOrders(id: string) {
    return scopeToTenant(this.database.workOrders.filter(
      (item) => item.source_request_id === id,
    ));
  }
}
