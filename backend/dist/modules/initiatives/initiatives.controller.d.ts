import { InitiativesService } from './initiatives.service';
import { CreateInitiativeDto } from './dto/create-initiative.dto';
import { UpdateInitiativeDto } from './dto/update-initiative.dto';
export declare class InitiativesController {
    private readonly initiativesService;
    constructor(initiativesService: InitiativesService);
    create(createDto: CreateInitiativeDto): {
        created_by_id: string;
        title: string;
        status: import("../../core/database/database.service").InitiativeStatus;
        feasible: boolean;
        target_reduction: string;
        outcomes?: string[];
        initiative_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").Initiative[];
    findOne(id: string): import("../../core/database/database.service").Initiative;
    update(id: string, updateDto: UpdateInitiativeDto): import("../../core/database/database.service").Initiative;
    remove(id: string): import("../../core/database/database.service").Initiative;
}
