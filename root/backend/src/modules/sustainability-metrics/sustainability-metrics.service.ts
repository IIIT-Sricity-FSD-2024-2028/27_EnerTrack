import * as crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CreateSustainabilityMetricDto } from './dto/create-sustainability-metric.dto';
import { UpdateSustainabilityMetricDto } from './dto/update-sustainability-metric.dto';

@Injectable()
export class SustainabilityMetricsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateSustainabilityMetricDto) {
    const generatedId = crypto.randomUUID();
    const newRecord = { sustainability_metric_id: generatedId, ...createDto };
    this.database.sustainabilityMetrics.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.sustainabilityMetrics;
  }

  findOne(id: string) {
    const record = this.database.sustainabilityMetrics.find(item => item.sustainability_metric_id === id);
    if (!record) throw new NotFoundException(`SustainabilityMetric with ID ${id} not found`);
    return record;
  }

  update(id: string, updateDto: UpdateSustainabilityMetricDto) {
    const index = this.database.sustainabilityMetrics.findIndex(item => item.sustainability_metric_id === id);
    if (index === -1) throw new NotFoundException(`SustainabilityMetric with ID ${id} not found`);
    this.database.sustainabilityMetrics[index] = { ...this.database.sustainabilityMetrics[index], ...updateDto };
    return this.database.sustainabilityMetrics[index];
  }

  remove(id: string) {
    const index = this.database.sustainabilityMetrics.findIndex(item => item.sustainability_metric_id === id);
    if (index === -1) throw new NotFoundException(`SustainabilityMetric with ID ${id} not found`);
    const removed = this.database.sustainabilityMetrics.splice(index, 1);
    return removed[0];
  }
}
