import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { UpdateActivityLogDto } from './dto/update-activity-log.dto';

@Injectable()
export class ActivityLogsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateActivityLogDto) {
    if (createDto.user_id) {
      const exists = this.database.users.find(x => x.user_id === createDto.user_id);
      if (!exists) throw new NotFoundException(`Target users with id '${createDto.user_id}' not found`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { activity_log_id: generatedId, ...createDto, timestamp: new Date().toISOString() };
    this.database.activityLogs.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.activityLogs;
  }

  findOne(id: string) {
    const record = this.database.activityLogs.find(item => item.activity_log_id === id);
    if (!record) throw new NotFoundException(`ActivityLog with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateActivityLogDto) {
    const index = this.database.activityLogs.findIndex(item => item.activity_log_id === id);
    if (index === -1) throw new NotFoundException(`ActivityLog with ID ${id} not found`);
    this.database.activityLogs[index] = { ...this.database.activityLogs[index], ...updateDto };
    return this.database.activityLogs[index];
  }

  remove(id: string) {
    const index = this.database.activityLogs.findIndex(item => item.activity_log_id === id);
    if (index === -1) throw new NotFoundException(`ActivityLog with ID ${id} not found`);
    const removed = this.database.activityLogs.splice(index, 1);
    return removed[0];
  }
}
