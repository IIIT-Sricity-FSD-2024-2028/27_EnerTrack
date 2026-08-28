import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
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
    if (createDto.assigned_to_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.assigned_to_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.assigned_to_id}' not found`,
        );
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { service_request_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null };
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
