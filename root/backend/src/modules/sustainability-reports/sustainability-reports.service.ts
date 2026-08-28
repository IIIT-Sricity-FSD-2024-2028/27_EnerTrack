import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateSustainabilityReportDto } from "./dto/create-sustainability-report.dto";
import { PutSustainabilityReportDto } from "./dto/put-sustainability-report.dto";

import { UpdateSustainabilityReportDto } from "./dto/update-sustainability-report.dto";

@Injectable()
export class SustainabilityReportsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateSustainabilityReportDto) {
    if (createDto.generated_by_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.generated_by_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.generated_by_id}' not found`,
        );
    }
    const generatedId = crypto.randomUUID();
    const newRecord = {
      report_id: generatedId,
      ...createDto,
      organization_id: currentOrgId() ?? createDto.organization_id ?? null,
      generated_at: new Date().toISOString(),
    };
    this.database.sustainabilityReports.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.sustainabilityReports);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.sustainabilityReports.find(
      (item) => item.report_id === id,
    ));
    if (!record)
      throw new NotFoundException(
        `SustainabilityReport with ID ${id} not found`,
      );
    return record;
  }

  put(id: string, putDto: PutSustainabilityReportDto) {
    const index = this.database.sustainabilityReports.findIndex(
      (item) => item.report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.sustainabilityReports[index]))
      throw new NotFoundException(
        `Sustainability Report with ID ${id} not found`,
      );
    this.database.sustainabilityReports[index] = {
      report_id: id,
      ...putDto,
    } as any;
    return this.database.sustainabilityReports[index];
  }
  update(id: string, updateDto: UpdateSustainabilityReportDto) {
    const index = this.database.sustainabilityReports.findIndex(
      (item) => item.report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.sustainabilityReports[index]))
      throw new NotFoundException(
        `SustainabilityReport with ID ${id} not found`,
      );
    this.database.sustainabilityReports[index] = {
      ...this.database.sustainabilityReports[index],
      ...updateDto,
      organization_id: this.database.sustainabilityReports[index].organization_id,
    };
    return this.database.sustainabilityReports[index];
  }

  remove(id: string) {
    const index = this.database.sustainabilityReports.findIndex(
      (item) => item.report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.sustainabilityReports[index]))
      throw new NotFoundException(
        `SustainabilityReport with ID ${id} not found`,
      );
    const removed = this.database.sustainabilityReports.splice(index, 1);
    return removed[0];
  }
}
