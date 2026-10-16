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
import { CreateMeterReadingDto } from "./dto/create-meter-reading.dto";
import { PutMeterReadingDto } from "./dto/put-meter-reading.dto";

import { UpdateMeterReadingDto } from "./dto/update-meter-reading.dto";

@Injectable()
export class MeterReadingsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateMeterReadingDto) {
    let meterOrgId: string | null = null;
    if (createDto.meter_id) {
      const exists = this.database.meters.find(
        (x) => x.meter_id === createDto.meter_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target meters with id '${createDto.meter_id}' not found`,
        );
      meterOrgId = exists.organization_id ?? null;
    }
    const generatedId = crypto.randomUUID();
    const newRecord = {
      reading_id: generatedId,
      ...createDto,
      // A tenant's request carries its own organisation. A platform-side caller
      // (Super Admin, Certified Energy Auditor) has none, so fall back to the
      // organisation that owns the meter. Without this a bulk upload by EnerTrack
      // staff was saved with organization_id null and never appeared on any
      // organisation's dashboard.
      organization_id:
        currentOrgId() ?? createDto.organization_id ?? meterOrgId ?? null,
      // Honour a caller-supplied timestamp so historical data can be
      // back-filled; fall back to now for live sensor pushes.
      timestamp: createDto.timestamp ?? new Date().toISOString(),
    };
    this.database.meterReadings.push(newRecord as any);
    return newRecord;
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
