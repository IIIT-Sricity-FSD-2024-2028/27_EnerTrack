import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { CreateInitiativeDto } from "./dto/create-initiative.dto";
import { PutInitiativeDto } from "./dto/put-initiative.dto";

import { UpdateInitiativeDto } from "./dto/update-initiative.dto";

@Injectable()
export class InitiativesService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateInitiativeDto) {
    if (createDto.created_by_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.created_by_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.created_by_id}' not found`,
        );
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { initiative_id: generatedId, ...createDto };
    this.database.initiatives.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.initiatives;
  }

  findOne(id: string) {
    const record = this.database.initiatives.find(
      (item) => item.initiative_id === id,
    );
    if (!record)
      throw new NotFoundException(`Initiative with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutInitiativeDto) {
    const index = this.database.initiatives.findIndex(
      (item) => item.initiative_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Initiative with ID ${id} not found`);
    this.database.initiatives[index] = { initiative_id: id, ...putDto } as any;
    return this.database.initiatives[index];
  }
  update(id: string, updateDto: UpdateInitiativeDto) {
    const index = this.database.initiatives.findIndex(
      (item) => item.initiative_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Initiative with ID ${id} not found`);
    this.database.initiatives[index] = {
      ...this.database.initiatives[index],
      ...updateDto,
    };
    return this.database.initiatives[index];
  }

  remove(id: string) {
    const index = this.database.initiatives.findIndex(
      (item) => item.initiative_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Initiative with ID ${id} not found`);
    const removed = this.database.initiatives.splice(index, 1);
    return removed[0];
  }
}
