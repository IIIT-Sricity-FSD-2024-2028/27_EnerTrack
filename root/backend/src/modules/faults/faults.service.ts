import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { CreateFaultDto } from "./dto/create-fault.dto";
import { PutFaultDto } from "./dto/put-fault.dto";

import { UpdateFaultDto } from "./dto/update-fault.dto";

@Injectable()
export class FaultsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateFaultDto) {
    if (createDto.alert_id) {
      const exists = this.database.alerts.find(
        (x) => x.alert_id === createDto.alert_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target alerts with id '${createDto.alert_id}' not found`,
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
    const nextId = this.database.faults.length + 1;
    const generatedId = `FLT-${nextId.toString().padStart(3, "0")}`;
    const newRecord = { fault_id: generatedId, ...createDto };
    this.database.faults.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.faults;
  }

  findOne(id: string) {
    const record = this.database.faults.find((item) => item.fault_id === id);
    if (!record) throw new NotFoundException(`Fault with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutFaultDto) {
    const index = this.database.faults.findIndex(
      (item) => item.fault_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Fault with ID ${id} not found`);
    this.database.faults[index] = { fault_id: id, ...putDto } as any;
    return this.database.faults[index];
  }
  update(id: string, updateDto: UpdateFaultDto) {
    const index = this.database.faults.findIndex(
      (item) => item.fault_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Fault with ID ${id} not found`);
    this.database.faults[index] = {
      ...this.database.faults[index],
      ...updateDto,
    };
    return this.database.faults[index];
  }

  remove(id: string) {
    const index = this.database.faults.findIndex(
      (item) => item.fault_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Fault with ID ${id} not found`);
    const removed = this.database.faults.splice(index, 1);
    return removed[0];
  }

  getWorkOrders(id: string) {
    return this.database.workOrders.filter(
      (item) => item.linked_fault_id === id,
    );
  }
}
