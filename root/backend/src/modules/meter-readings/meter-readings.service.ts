import * as crypto from "crypto";
import * as fs from "fs";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { scopeToTenant, currentOrgId } from "../../core/tenancy/tenant-context";
import { CreateMeterReadingDto } from "./dto/create-meter-reading.dto";
import { PutMeterReadingDto } from "./dto/put-meter-reading.dto";

import { UpdateMeterReadingDto } from "./dto/update-meter-reading.dto";

@Injectable()
export class MeterReadingsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateMeterReadingDto) {
    if (createDto.meter_id) {
      const exists = this.database.meters.find(
        (x) => x.meter_id === createDto.meter_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target meters with id '${createDto.meter_id}' not found`,
        );
    }
    const generatedId = crypto.randomUUID();
    const newRecord = {
      reading_id: generatedId,
      ...createDto,
      organization_id: createDto.organization_id ?? currentOrgId(),
      timestamp: new Date().toISOString(),
    };
    this.database.meterReadings.push(newRecord as any);
    return newRecord;
     }

  importFromCsv(file: Express.Multer.File) {
    const raw = fs.readFileSync(file.path, "utf-8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException("CSV file has no data rows");
    }

    const headers = lines[0].split(",").map((h) => h.trim());
    const created: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      const dto: CreateMeterReadingDto = {
        meter_id: row.meter_id,
        value: parseFloat(row.value),
        unit: row.unit,
      } as CreateMeterReadingDto;

      created.push(this.create(dto));
    }

    return { imported: created.length, records: created };
  }

  findAll() {
    return scopeToTenant(this.database.meterReadings);
  }

  findOne(id: string) {
    const record = this.database.meterReadings.find(
      (item) => item.reading_id === id,
    );
    if (!record)
      throw new NotFoundException(`MeterReading with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutMeterReadingDto) {
    const index = this.database.meterReadings.findIndex(
      (item) => item.reading_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Meter Reading with ID ${id} not found`);
    this.database.meterReadings[index] = { reading_id: id, ...putDto } as any;
    return this.database.meterReadings[index];
  }
  update(id: string, updateDto: UpdateMeterReadingDto) {
    const index = this.database.meterReadings.findIndex(
      (item) => item.reading_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`MeterReading with ID ${id} not found`);
    this.database.meterReadings[index] = {
      ...this.database.meterReadings[index],
      ...updateDto,
    };
    return this.database.meterReadings[index];
  }

  remove(id: string) {
    const index = this.database.meterReadings.findIndex(
      (item) => item.reading_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`MeterReading with ID ${id} not found`);
    const removed = this.database.meterReadings.splice(index, 1);
    return removed[0];
  }
}
