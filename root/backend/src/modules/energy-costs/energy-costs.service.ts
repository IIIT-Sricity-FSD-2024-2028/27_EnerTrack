import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService, EnergyCostStatus } from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateEnergyCostDto } from "./dto/create-energy-cost.dto";
import { PutEnergyCostDto } from "./dto/put-energy-cost.dto";

import { UpdateEnergyCostDto } from "./dto/update-energy-cost.dto";

@Injectable()
export class EnergyCostsService {
  constructor(private database: DatabaseService) {}

  /**
   * Total, variance and status are worked out here from the amounts, never
   * taken from the client. With no budget there is no variance to report, so
   * the record says so instead of reading as "on budget".
   */
  private finalise<T extends Record<string, any>>(rec: T): T {
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const total = n(rec.electricity) + n(rec.gas) + n(rec.water) + n(rec.wastewater) + n(rec.demand);
    const budget = n(rec.budget) > 0 ? n(rec.budget) : 0;
    const variance = budget > 0 ? budget - total : 0;
    const status =
      budget === 0
        ? EnergyCostStatus.NO_BUDGET
        : variance > 0
          ? EnergyCostStatus.UNDER_BUDGET
          : variance === 0
            ? EnergyCostStatus.ON_BUDGET
            : EnergyCostStatus.OVER_BUDGET;
    return { ...rec, total, budget, variance, status };
  }

  create(createDto: CreateEnergyCostDto) {
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
    const newRecord = this.finalise({ energy_cost_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null });
    this.database.energyCosts.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.energyCosts);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.energyCosts.find(
      (item) => item.energy_cost_id === id,
    ));
    if (!record)
      throw new NotFoundException(`EnergyCost with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutEnergyCostDto) {
    const index = this.database.energyCosts.findIndex(
      (item) => item.energy_cost_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.energyCosts[index]))
      throw new NotFoundException(`Energy Cost with ID ${id} not found`);
    this.database.energyCosts[index] = this.finalise({
      energy_cost_id: id,
      ...putDto,
      organization_id: this.database.energyCosts[index].organization_id,
    }) as any;
    return this.database.energyCosts[index];
  }
  update(id: string, updateDto: UpdateEnergyCostDto) {
    const index = this.database.energyCosts.findIndex(
      (item) => item.energy_cost_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.energyCosts[index]))
      throw new NotFoundException(`EnergyCost with ID ${id} not found`);
    this.database.energyCosts[index] = this.finalise({
      ...this.database.energyCosts[index],
      ...updateDto,
      organization_id: this.database.energyCosts[index].organization_id,
    });
    return this.database.energyCosts[index];
  }

  remove(id: string) {
    const index = this.database.energyCosts.findIndex(
      (item) => item.energy_cost_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.energyCosts[index]))
      throw new NotFoundException(`EnergyCost with ID ${id} not found`);
    const removed = this.database.energyCosts.splice(index, 1);
    return removed[0];
  }

  getByPeriod(period: string) {
    return scopeToTenant(
      this.database.energyCosts.filter((item) => item.period === period),
    );
  }
}
