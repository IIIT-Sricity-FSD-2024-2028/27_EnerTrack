import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';

@Injectable()
export class MetersService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateMeterDto) {
    if (createDto.meter_code) {
      const exists = this.database.meters.find(x => x.meter_code === createDto.meter_code);
      if (exists) throw new ConflictException(`Duplicate meter_code '${createDto.meter_code}'`);
    }
    if (createDto.building_id) {
      const exists = this.database.buildings.find(x => x.building_id === createDto.building_id);
      if (!exists) throw new NotFoundException(`Target buildings with id '${createDto.building_id}' not found`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { meter_id: generatedId, ...createDto };
    this.database.meters.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.meters;
  }

  findOne(id: string) {
    const record = this.database.meters.find(item => item.meter_id === id);
    if (!record) throw new NotFoundException(`Meter with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateMeterDto) {
    const index = this.database.meters.findIndex(item => item.meter_id === id);
    if (index === -1) throw new NotFoundException(`Meter with ID ${id} not found`);
    this.database.meters[index] = { ...this.database.meters[index], ...updateDto };
    return this.database.meters[index];
  }

  remove(id: string) {
    const index = this.database.meters.findIndex(item => item.meter_id === id);
    if (index === -1) throw new NotFoundException(`Meter with ID ${id} not found`);
    const removed = this.database.meters.splice(index, 1);
    return removed[0];
  }

  getReadings(id: string) {
    return this.database.meterReadings.filter(item => item.meter_id === id);
  }

  getAlerts(id: string) {
    return this.database.alerts.filter(item => item.meter_id === id);
  }
}
