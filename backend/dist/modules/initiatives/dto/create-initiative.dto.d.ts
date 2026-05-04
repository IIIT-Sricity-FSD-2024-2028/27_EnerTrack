import { InitiativeStatus } from '../../../core/database/database.service';
export declare class CreateInitiativeDto {
    created_by_id: string;
    title: string;
    status: InitiativeStatus;
    feasible: boolean;
    target_reduction: string;
    outcomes?: string[];
}
