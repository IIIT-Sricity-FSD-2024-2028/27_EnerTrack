import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';

@Injectable()
export class WorkOrdersService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateWorkOrderDto) {
    if (createDto.assigned_to_id) {
      const exists = this.database.users.find(x => x.user_id === createDto.assigned_to_id);
      if (!exists) throw new NotFoundException(`Target users with id '${createDto.assigned_to_id}' not found`);
    }
    if (createDto.linked_fault_id) {
      const exists = this.database.faults.find(x => x.fault_id === createDto.linked_fault_id);
      if (!exists) throw new NotFoundException(`Target faults with id '${createDto.linked_fault_id}' not found`);
    }
    if (createDto.source_request_id) {
      const exists = this.database.serviceRequests.find(x => x.service_request_id === createDto.source_request_id);
      if (!exists) throw new NotFoundException(`Target serviceRequests with id '${createDto.source_request_id}' not found`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { work_order_id: generatedId, ...createDto };
    this.database.workOrders.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.workOrders;
  }

  findOne(id: string) {
    const record = this.database.workOrders.find(item => item.work_order_id === id);
    if (!record) throw new NotFoundException(`WorkOrder with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateWorkOrderDto) {
    const index = this.database.workOrders.findIndex(item => item.work_order_id === id);
    if (index === -1) throw new NotFoundException(`WorkOrder with ID ${id} not found`);
    this.database.workOrders[index] = { ...this.database.workOrders[index], ...updateDto };
    return this.database.workOrders[index];
  }

  remove(id: string) {
    const index = this.database.workOrders.findIndex(item => item.work_order_id === id);
    if (index === -1) throw new NotFoundException(`WorkOrder with ID ${id} not found`);
    const removed = this.database.workOrders.splice(index, 1);
    return removed[0];
  }
}
