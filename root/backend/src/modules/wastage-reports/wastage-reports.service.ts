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
import { CreateWastageReportDto } from "./dto/create-wastage-report.dto";
import { PutWastageReportDto } from "./dto/put-wastage-report.dto";

import { UpdateWastageReportDto } from "./dto/update-wastage-report.dto";

@Injectable()
export class WastageReportsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateWastageReportDto) {
    if (createDto.reporter_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.reporter_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.reporter_id}' not found`,
        );
    }
    if (createDto.sensor_reading_id) {
      const exists = this.database.meterReadings.find(
        (x) => x.reading_id === createDto.sensor_reading_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target meterReadings with id '${createDto.sensor_reading_id}' not found`,
        );
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { wastage_report_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null };
    this.database.wastageReports.push(newRecord as any);
    return newRecord;
  }
  attachPhotos(id: string, files: Express.Multer.File[]) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`Wastage Report with ID ${id} not found`);

    const photoPaths = files.map((f) => f.path);
    const currentDetails = this.database.wastageReports[index].details;
    const existingDetails =
      currentDetails && typeof currentDetails === "object" && !Array.isArray(currentDetails)
        ? currentDetails
        : {};

    this.database.wastageReports[index] = {
      ...this.database.wastageReports[index],
      details: {
        ...existingDetails,
        photos: [...(existingDetails.photos ?? []), ...photoPaths],
      },
    } as any;
    return this.database.wastageReports[index];
  }
  findAll() {
    return scopeToTenant(this.database.wastageReports);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.wastageReports.find(
      (item) => item.wastage_report_id === id,
    ));
    if (!record)
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutWastageReportDto) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`Wastage Report with ID ${id} not found`);
    this.database.wastageReports[index] = {
      wastage_report_id: id,
      ...putDto,
    } as any;
    return this.database.wastageReports[index];
  }
  update(id: string, updateDto: UpdateWastageReportDto) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    this.database.wastageReports[index] = {
      ...this.database.wastageReports[index],
      ...updateDto,
      organization_id: this.database.wastageReports[index].organization_id,
    };
    return this.database.wastageReports[index];
  }

  remove(id: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    const removed = this.database.wastageReports.splice(index, 1);
    return removed[0];
  }
}
