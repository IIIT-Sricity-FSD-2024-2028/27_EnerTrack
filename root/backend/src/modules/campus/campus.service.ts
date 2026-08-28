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
import { CreateCampusDto } from "./dto/create-campus.dto";
import { PutCampusDto } from "./dto/put-campus.dto";

import { UpdateCampusDto } from "./dto/update-campus.dto";

@Injectable()
export class CampusService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateCampusDto) {
    const generatedId = crypto.randomUUID();
    const newRecord = { campus_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null };
    this.database.campus.push(newRecord as any);
    return newRecord;
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
    const removed = this.database.campus.splice(index, 1);
    return removed[0];
  }

  getBuildings(id: string) {
    return scopeToTenant(this.database.buildings.filter((item) => item.campus_id === id));
  }
}
