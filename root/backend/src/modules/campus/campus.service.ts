import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateCampusDto } from './dto/create-campu.dto';
import { UpdateCampusDto } from './dto/update-campu.dto';

@Injectable()
export class CampusService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateCampusDto) {
    const generatedId = crypto.randomUUID();
    const newRecord = { campus_id: generatedId, ...createDto };
    this.database.campus.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.campus;
  }

  findOne(id: string) {
    const record = this.database.campus.find(item => item.campus_id === id);
    if (!record) throw new NotFoundException(`Campus with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateCampusDto) {
    const index = this.database.campus.findIndex(item => item.campus_id === id);
    if (index === -1) throw new NotFoundException(`Campus with ID ${id} not found`);
    this.database.campus[index] = { ...this.database.campus[index], ...updateDto };
    return this.database.campus[index];
  }

  remove(id: string) {
    const index = this.database.campus.findIndex(item => item.campus_id === id);
    if (index === -1) throw new NotFoundException(`Campus with ID ${id} not found`);
    const removed = this.database.campus.splice(index, 1);
    return removed[0];
  }

  getBuildings(id: string) {
    return this.database.buildings.filter(item => item.campus_id === id);
  }
}
