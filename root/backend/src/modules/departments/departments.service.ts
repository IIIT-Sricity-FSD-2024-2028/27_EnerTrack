import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateDepartmentDto) {
    if (createDto.building_id) {
      const exists = this.database.buildings.find(x => x.building_id === createDto.building_id);
      if (!exists) throw new NotFoundException(`Target buildings with id '${createDto.building_id}' not found`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { department_id: generatedId, ...createDto };
    this.database.departments.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.departments;
  }

  findOne(id: string) {
    const record = this.database.departments.find(item => item.department_id === id);
    if (!record) throw new NotFoundException(`Department with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateDepartmentDto) {
    const index = this.database.departments.findIndex(item => item.department_id === id);
    if (index === -1) throw new NotFoundException(`Department with ID ${id} not found`);
    this.database.departments[index] = { ...this.database.departments[index], ...updateDto };
    return this.database.departments[index];
  }

  remove(id: string) {
    const index = this.database.departments.findIndex(item => item.department_id === id);
    if (index === -1) throw new NotFoundException(`Department with ID ${id} not found`);
    const removed = this.database.departments.splice(index, 1);
    return removed[0];
  }

  getInvoices(id: string) {
    return this.database.invoices.filter(item => item.department_id === id);
  }
}
