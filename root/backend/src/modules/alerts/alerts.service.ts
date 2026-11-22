import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { AlertStatus, DatabaseService } from "../../core/database/database.service";
import { DecideAlertDto } from "./dto/decide-alert.dto";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateAlertDto } from "./dto/create-alert.dto";
import { PutAlertDto } from "./dto/put-alert.dto";

import { UpdateAlertDto } from "./dto/update-alert.dto";

@Injectable()
export class AlertsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateAlertDto) {
    if (createDto.meter_id) {
      const exists = this.database.meters.find(
        (x) => x.meter_id === createDto.meter_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target meters with id '${createDto.meter_id}' not found`,
        );
    }
    if (createDto.triggering_reading_id) {
      const exists = this.database.meterReadings.find(
        (x) => x.reading_id === createDto.triggering_reading_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target meterReadings with id '${createDto.triggering_reading_id}' not found`,
        );
    }
    const nextId = this.database.alerts.length + 1;
    const generatedId = `ALT-${nextId.toString().padStart(3, "0")}`;
    const newRecord = { alert_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null };
    this.database.alerts.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.alerts);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.alerts.find((item) => item.alert_id === id));
    if (!record) throw new NotFoundException(`Alert with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutAlertDto) {
    const index = this.database.alerts.findIndex(
      (item) => item.alert_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.alerts[index]))
      throw new NotFoundException(`Alert with ID ${id} not found`);
    this.database.alerts[index] = {
      alert_id: id,
      ...putDto,
      organization_id: this.database.alerts[index].organization_id,
    } as any;
    return this.database.alerts[index];
  }
  update(id: string, updateDto: UpdateAlertDto) {
    const index = this.database.alerts.findIndex(
      (item) => item.alert_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.alerts[index]))
      throw new NotFoundException(`Alert with ID ${id} not found`);
    this.database.alerts[index] = {
      ...this.database.alerts[index],
      ...updateDto,
      organization_id: this.database.alerts[index].organization_id,
    };
    return this.database.alerts[index];
  }

  remove(id: string) {
    const index = this.database.alerts.findIndex(
      (item) => item.alert_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.alerts[index]))
      throw new NotFoundException(`Alert with ID ${id} not found`);
    const removed = this.database.alerts.splice(index, 1);
    return removed[0];
  }

  getFaults(id: string) {
    return scopeToTenant(this.database.faults.filter((item) => item.alert_id === id));
  }

  addMessage(id: string, message: any) {
    const index = this.database.alerts.findIndex(
      (item) => item.alert_id === id,
    );
    if (index > -1) {
      if (!this.database.alerts[index].messages) {
        this.database.alerts[index].messages = [];
      }
      this.database.alerts[index].messages.push(message);
      return this.database.alerts[index];
    }
    return null;
  }

  /**
   * Decide an alert in one step: send it on as a fault, keep monitoring it,
   * or close it as a false alarm. The fault is made first, so if it is
   * refused the alert is left as it was. What was done is written to the
   * alert's log.
   */
  decide(id: string, dto: DecideAlertDto, callerId: string | undefined, role: string | undefined) {
    const alert = assertTenantOwns(this.database.alerts.find((a) => a.alert_id === id));
    if (!alert) throw new NotFoundException(`Alert with ID ${id} not found`);
    if (alert.status === AlertStatus.RESOLVED) throw new ConflictException("This alert is already resolved.");
    const withNotes = (label: string) => (dto.notes ? `${label} — ${dto.notes}` : label);

    let action: string;
    let fault: any = null;
    if (dto.decision === "fault") {
      if (!dto.asset || !dto.fault_type) throw new BadRequestException("Say which asset and what kind of fault.");
      fault = this.database.faults.find((f) => f.alert_id === id && f.status !== "resolved");
      if (!fault) {
        const highest = this.database.faults.reduce((max, f) => Math.max(max, Number(/^FLT-(\d+)$/.exec(f.fault_id)?.[1] ?? 0)), 0);
        const known = ["low", "moderate", "high", "critical"];
        fault = {
          fault_id: `FLT-${(highest + 1).toString().padStart(3, "0")}`,
          organization_id: alert.organization_id,
          alert_id: id,
          assigned_to_id: callerId ?? null,
          asset_name: dto.asset,
          fault_type: dto.fault_type,
          severity: known.includes(alert.severity) ? alert.severity : "moderate",
          status: "active",
          ...(dto.notes ? { prelim_notes: dto.notes } : {}),
        };
        this.database.faults.push(fault);
      }
      alert.status = AlertStatus.ACKNOWLEDGED;
      action = withNotes(`Sent to diagnostics as ${fault.fault_id}`);
    } else if (dto.decision === "monitor") {
      alert.status = AlertStatus.ACKNOWLEDGED;
      action = withNotes("Monitoring");
    } else {
      alert.status = AlertStatus.RESOLVED;
      action = withNotes("False alarm");
    }
    alert.messages ??= [];
    alert.messages.push({ sender_role: role ?? "", content: action, timestamp: new Date().toISOString() });
    return { alert, fault };
  }
}
