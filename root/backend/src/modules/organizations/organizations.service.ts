import * as crypto from "crypto";
import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { PutOrganizationDto } from "./dto/put-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";

@Injectable()
export class OrganizationsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateOrganizationDto) {
    const exists = this.database.organizations.find(
      (x) => x.name.toLowerCase() === createDto.name.toLowerCase(),
    );
    if (exists)
      throw new ConflictException(
        `An organization named '${createDto.name}' already exists`,
      );

    const generatedId = crypto.randomUUID();
    const newRecord = { organization_id: generatedId, ...createDto };
    this.database.organizations.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.organizations;
  }

  findOne(id: string) {
    const record = this.database.organizations.find(
      (item) => item.organization_id === id,
    );
    if (!record)
      throw new NotFoundException(`Organization with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutOrganizationDto) {
    const index = this.database.organizations.findIndex(
      (item) => item.organization_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Organization with ID ${id} not found`);
    this.database.organizations[index] = {
      organization_id: id,
      ...putDto,
    } as any;
    return this.database.organizations[index];
  }

  update(id: string, updateDto: UpdateOrganizationDto) {
    const index = this.database.organizations.findIndex(
      (item) => item.organization_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Organization with ID ${id} not found`);
    this.database.organizations[index] = {
      ...this.database.organizations[index],
      ...updateDto,
    };
    return this.database.organizations[index];
  }

  remove(id: string) {
    const index = this.database.organizations.findIndex(
      (item) => item.organization_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Organization with ID ${id} not found`);

    const campusCount = this.database.campus.filter(
      (c) => c.organization_id === id,
    ).length;
    if (campusCount > 0)
      throw new ConflictException(
        `Cannot delete organization ${id}: it still owns ${campusCount} campus record(s)`,
      );

    const removed = this.database.organizations.splice(index, 1);
    return removed[0];
  }

  /** Campuses belonging to this organization. */
  getCampuses(id: string) {
    return this.database.campus.filter((c) => c.organization_id === id);
  }

  /** User accounts belonging to this organization. */
  getUsers(id: string) {
    return this.database.users.filter((u) => u.organization_id === id);
  }
}
