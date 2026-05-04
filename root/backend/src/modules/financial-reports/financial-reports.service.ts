import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { CreateFinancialReportDto } from "./dto/create-financial-report.dto";
import { PutFinancialReportDto } from "./dto/put-financial-report.dto";

import { UpdateFinancialReportDto } from "./dto/update-financial-report.dto";

@Injectable()
export class FinancialReportsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateFinancialReportDto) {
    if (createDto.generated_by_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.generated_by_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.generated_by_id}' not found`,
        );
    }
    if (createDto.building_id) {
      const exists = this.database.buildings.find(
        (x) => x.building_id === createDto.building_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target buildings with id '${createDto.building_id}' not found`,
        );
    }
    if (createDto.department_id) {
      const exists = this.database.departments.find(
        (x) => x.department_id === createDto.department_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target departments with id '${createDto.department_id}' not found`,
        );
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { financial_report_id: generatedId, ...createDto };
    this.database.financialReports.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.financialReports;
  }

  findOne(id: string) {
    const record = this.database.financialReports.find(
      (item) => item.financial_report_id === id,
    );
    if (!record)
      throw new NotFoundException(`FinancialReport with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutFinancialReportDto) {
    const index = this.database.financialReports.findIndex(
      (item) => item.financial_report_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Financial Report with ID ${id} not found`);
    this.database.financialReports[index] = {
      financial_report_id: id,
      ...putDto,
    } as any;
    return this.database.financialReports[index];
  }
  update(id: string, updateDto: UpdateFinancialReportDto) {
    const index = this.database.financialReports.findIndex(
      (item) => item.financial_report_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`FinancialReport with ID ${id} not found`);
    this.database.financialReports[index] = {
      ...this.database.financialReports[index],
      ...updateDto,
    };
    return this.database.financialReports[index];
  }

  remove(id: string) {
    const index = this.database.financialReports.findIndex(
      (item) => item.financial_report_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`FinancialReport with ID ${id} not found`);
    const removed = this.database.financialReports.splice(index, 1);
    return removed[0];
  }
}
