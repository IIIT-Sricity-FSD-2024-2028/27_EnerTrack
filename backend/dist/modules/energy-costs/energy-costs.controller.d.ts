import { EnergyCostsService } from './energy-costs.service';
import { CreateEnergyCostDto } from './dto/create-energy-cost.dto';
import { UpdateEnergyCostDto } from './dto/update-energy-cost.dto';
export declare class EnergyCostsController {
    private readonly energyCostsService;
    constructor(energyCostsService: EnergyCostsService);
    create(createDto: CreateEnergyCostDto): {
        building_id?: string;
        department_id?: string;
        period: string;
        electricity: number;
        gas: number;
        water: number;
        status: import("../../core/database/database.service").EnergyCostStatus;
        energy_cost_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").EnergyCost[];
    findOne(id: string): import("../../core/database/database.service").EnergyCost;
    update(id: string, updateDto: UpdateEnergyCostDto): import("../../core/database/database.service").EnergyCost;
    remove(id: string): import("../../core/database/database.service").EnergyCost;
    getByPeriod(period: string): import("../../core/database/database.service").EnergyCost[];
}
