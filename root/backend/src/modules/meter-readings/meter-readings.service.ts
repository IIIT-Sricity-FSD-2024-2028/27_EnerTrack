import * as crypto from "crypto";
import * as fs from "fs";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
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
      organization_id: currentOrgId() ?? createDto.organization_id ?? null,
      // Honour a caller-supplied timestamp so historical data can be
      // back-filled; fall back to now for live sensor pushes.
      timestamp: createDto.timestamp ?? new Date().toISOString(),
    };
    this.database.meterReadings.push(newRecord as any);
    return newRecord;
  }

  /**
   * Imports a CSV of meter readings.
   *
   * Validates every row BEFORE inserting any of them. The previous version
   * inserted as it parsed, so one bad meter_id halfway down the file left the
   * database holding a partial import with no way to tell what had landed.
   * Now the file is either fully accepted or fully rejected, and the caller
   * gets told exactly which rows were wrong.
   *
   * Expected header row: meter_id,value,unit[,timestamp]
   */
  importFromCsv(file: Express.Multer.File) {
    try {
      const raw = fs.readFileSync(file.path, "utf-8");
      const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

      if (lines.length < 2) {
        throw new BadRequestException("CSV file has no data rows");
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const required = ["meter_id", "value", "unit"];
      const missing = required.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        throw new BadRequestException(
          `CSV is missing required column(s): ${missing.join(", ")}. ` +
            `Expected header row: meter_id,value,unit[,timestamp]`,
        );
      }

      // ── Pass 1: parse and validate every row, collecting errors ──
      const parsed: CreateMeterReadingDto[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const rowNumber = i + 1; // 1-based, counting the header
        const values = lines[i].split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx];
        });

        if (!row.meter_id) {
          errors.push(`Row ${rowNumber}: meter_id is empty`);
          continue;
        }

        const meterExists = this.database.meters.some(
          (m) => m.meter_id === row.meter_id,
        );
        if (!meterExists) {
          errors.push(`Row ${rowNumber}: no meter with id '${row.meter_id}'`);
          continue;
        }

        const value = parseFloat(row.value);
        if (Number.isNaN(value)) {
          errors.push(
            `Row ${rowNumber}: value '${row.value ?? ""}' is not a number`,
          );
          continue;
        }

        if (!row.unit) {
          errors.push(`Row ${rowNumber}: unit is empty`);
          continue;
        }

        parsed.push({
          meter_id: row.meter_id,
          value,
          unit: row.unit,
          // Optional column — falls back to now inside create()
          timestamp: row.timestamp || undefined,
        } as CreateMeterReadingDto);
      }

      if (errors.length > 0) {
        throw new BadRequestException({
          message: `CSV rejected — ${errors.length} invalid row(s), nothing was imported`,
          errors,
        });
      }

      // ── Pass 2: every row is known good, so insert them all ──
      const created = parsed.map((dto) => this.create(dto));

      return {
        imported: created.length,
        sourceFile: file.originalname,
        records: created,
      };
    } finally {
      // The CSV has been read into memory and is of no further use. Leaving
      // it behind would grow uploads/ without bound. Runs on the error path
      // too, which is exactly when a rejected file should not be kept.
      try {
        fs.unlinkSync(file.path);
      } catch {
        // Already gone, or locked — not worth failing the request over.
      }
    }
  }

  findAll() {
    return scopeToTenant(this.database.meterReadings);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.meterReadings.find(
      (item) => item.reading_id === id,
    ));
    if (!record)
      throw new NotFoundException(`MeterReading with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutMeterReadingDto) {
    const index = this.database.meterReadings.findIndex(
      (item) => item.reading_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.meterReadings[index]))
      throw new NotFoundException(`Meter Reading with ID ${id} not found`);
    this.database.meterReadings[index] = {
      reading_id: id,
      ...putDto,
      organization_id: this.database.meterReadings[index].organization_id,
    } as any;
    return this.database.meterReadings[index];
  }
  update(id: string, updateDto: UpdateMeterReadingDto) {
    const index = this.database.meterReadings.findIndex(
      (item) => item.reading_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.meterReadings[index]))
      throw new NotFoundException(`MeterReading with ID ${id} not found`);
    this.database.meterReadings[index] = {
      ...this.database.meterReadings[index],
      ...updateDto,
      organization_id: this.database.meterReadings[index].organization_id,
    };
    return this.database.meterReadings[index];
  }

  remove(id: string) {
    const index = this.database.meterReadings.findIndex(
      (item) => item.reading_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.meterReadings[index]))
      throw new NotFoundException(`MeterReading with ID ${id} not found`);
    const removed = this.database.meterReadings.splice(index, 1);
    return removed[0];
  }
}
