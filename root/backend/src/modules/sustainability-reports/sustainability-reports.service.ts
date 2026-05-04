import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateSustainabilityReportDto } from './dto/create-sustainability-report.dto';
import { UpdateSustainabilityReportDto } from './dto/update-sustainability-report.dto';

@Injectable()
export class SustainabilityReportsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateSustainabilityReportDto) {
    if (createDto.generated_by_id) {
      const exists = this.database.users.find(x => x.user_id === createDto.generated_by_id);
      if (!exists) throw new NotFoundException(`Target users with id '${createDto.generated_by_id}' not found`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { report_id: generatedId, ...createDto, generated_at: new Date().toISOString() };
    this.database.sustainabilityReports.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.sustainabilityReports;
  }

  findOne(id: string) {
    const record = this.database.sustainabilityReports.find(item => item.report_id === id);
    if (!record) throw new NotFoundException(`SustainabilityReport with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateSustainabilityReportDto) {
    const index = this.database.sustainabilityReports.findIndex(item => item.report_id === id);
    if (index === -1) throw new NotFoundException(`SustainabilityReport with ID ${id} not found`);
    this.database.sustainabilityReports[index] = { ...this.database.sustainabilityReports[index], ...updateDto };
    return this.database.sustainabilityReports[index];
  }

  remove(id: string) {
    const index = this.database.sustainabilityReports.findIndex(item => item.report_id === id);
    if (index === -1) throw new NotFoundException(`SustainabilityReport with ID ${id} not found`);
    const removed = this.database.sustainabilityReports.splice(index, 1);
    return removed[0];
  }
}
