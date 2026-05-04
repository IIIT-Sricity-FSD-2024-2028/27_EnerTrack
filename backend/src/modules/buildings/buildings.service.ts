import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateBuildingDto) {
    if (createDto.campus_id) {
      const exists = this.database.campus.find(x => x.campus_id === createDto.campus_id);
      if (!exists) throw new NotFoundException(`Target campus with id '${createDto.campus_id}' not found`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { building_id: generatedId, ...createDto };
    this.database.buildings.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.buildings;
  }

  findOne(id: string) {
    const record = this.database.buildings.find(item => item.building_id === id);
    if (!record) throw new NotFoundException(`Building with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateBuildingDto) {
    const index = this.database.buildings.findIndex(item => item.building_id === id);
    if (index === -1) throw new NotFoundException(`Building with ID ${id} not found`);
    this.database.buildings[index] = { ...this.database.buildings[index], ...updateDto };
    return this.database.buildings[index];
  }

  remove(id: string) {
    const index = this.database.buildings.findIndex(item => item.building_id === id);
    if (index === -1) throw new NotFoundException(`Building with ID ${id} not found`);
    const removed = this.database.buildings.splice(index, 1);
    return removed[0];
  }

  getDepartments(id: string) {
    return this.database.departments.filter(item => item.building_id === id);
  }

  getMeters(id: string) {
    return this.database.meters.filter(item => item.building_id === id);
  }
}
