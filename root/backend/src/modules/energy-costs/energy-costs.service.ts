import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { CreateEnergyCostDto } from "./dto/create-energy-cost.dto";
import { PutEnergyCostDto } from "./dto/put-energy-cost.dto";

import { UpdateEnergyCostDto } from "./dto/update-energy-cost.dto";

@Injectable()
export class EnergyCostsService {
  constructor(private database: DatabaseService) {}

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
    const newRecord = { energy_cost_id: generatedId, ...createDto };
    this.database.energyCosts.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.energyCosts;
  }

  findOne(id: string) {
    const record = this.database.energyCosts.find(
      (item) => item.energy_cost_id === id,
    );
    if (!record)
      throw new NotFoundException(`EnergyCost with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutEnergyCostDto) {
    const index = this.database.energyCosts.findIndex(
      (item) => item.energy_cost_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Energy Cost with ID ${id} not found`);
    this.database.energyCosts[index] = { energy_cost_id: id, ...putDto } as any;
    return this.database.energyCosts[index];
  }
  update(id: string, updateDto: UpdateEnergyCostDto) {
    const index = this.database.energyCosts.findIndex(
      (item) => item.energy_cost_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`EnergyCost with ID ${id} not found`);
    this.database.energyCosts[index] = {
      ...this.database.energyCosts[index],
      ...updateDto,
    };
    return this.database.energyCosts[index];
  }

  remove(id: string) {
    const index = this.database.energyCosts.findIndex(
      (item) => item.energy_cost_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`EnergyCost with ID ${id} not found`);
    const removed = this.database.energyCosts.splice(index, 1);
    return removed[0];
  }

  getByPeriod(period: string) {
    return this.database.energyCosts.filter((item) => item.period === period);
  }
}
