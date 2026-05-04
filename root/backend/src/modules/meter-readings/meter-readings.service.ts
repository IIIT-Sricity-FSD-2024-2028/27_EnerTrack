import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';

@Injectable()
export class MeterReadingsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateMeterReadingDto) {
    if (createDto.meter_id) {
      const exists = this.database.meters.find(x => x.meter_id === createDto.meter_id);
      if (!exists) throw new NotFoundException(`Target meters with id '${createDto.meter_id}' not found`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { reading_id: generatedId, ...createDto, timestamp: new Date().toISOString() };
    this.database.meterReadings.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.meterReadings;
  }

  findOne(id: string) {
    const record = this.database.meterReadings.find(item => item.reading_id === id);
    if (!record) throw new NotFoundException(`MeterReading with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateMeterReadingDto) {
    const index = this.database.meterReadings.findIndex(item => item.reading_id === id);
    if (index === -1) throw new NotFoundException(`MeterReading with ID ${id} not found`);
    this.database.meterReadings[index] = { ...this.database.meterReadings[index], ...updateDto };
    return this.database.meterReadings[index];
  }

  remove(id: string) {
    const index = this.database.meterReadings.findIndex(item => item.reading_id === id);
    if (index === -1) throw new NotFoundException(`MeterReading with ID ${id} not found`);
    const removed = this.database.meterReadings.splice(index, 1);
    return removed[0];
  }
}
