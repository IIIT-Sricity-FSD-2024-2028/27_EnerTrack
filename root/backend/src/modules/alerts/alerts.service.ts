import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateAlertDto) {
    if (createDto.meter_id) {
      const exists = this.database.meters.find(x => x.meter_id === createDto.meter_id);
      if (!exists) throw new NotFoundException(`Target meters with id '${createDto.meter_id}' not found`);
    }
    if (createDto.triggering_reading_id) {
      const exists = this.database.meterReadings.find(x => x.reading_id === createDto.triggering_reading_id);
      if (!exists) throw new NotFoundException(`Target meterReadings with id '${createDto.triggering_reading_id}' not found`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { alert_id: generatedId, ...createDto };
    this.database.alerts.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.alerts;
  }

  findOne(id: string) {
    const record = this.database.alerts.find(item => item.alert_id === id);
    if (!record) throw new NotFoundException(`Alert with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateAlertDto) {
    const index = this.database.alerts.findIndex(item => item.alert_id === id);
    if (index === -1) throw new NotFoundException(`Alert with ID ${id} not found`);
    this.database.alerts[index] = { ...this.database.alerts[index], ...updateDto };
    return this.database.alerts[index];
  }

  remove(id: string) {
    const index = this.database.alerts.findIndex(item => item.alert_id === id);
    if (index === -1) throw new NotFoundException(`Alert with ID ${id} not found`);
    const removed = this.database.alerts.splice(index, 1);
    return removed[0];
  }

  getFaults(id: string) {
    return this.database.faults.filter(item => item.alert_id === id);
  }

    addMessage(id: string, message: any) {
    const index = this.database.alerts.findIndex(item => item.alert_id === id);
    if (index > -1) {
      if (!this.database.alerts[index].messages) {
        this.database.alerts[index].messages = [];
      }
      this.database.alerts[index].messages.push(message);
      return this.database.alerts[index];
    }
    return null;
  }
}
