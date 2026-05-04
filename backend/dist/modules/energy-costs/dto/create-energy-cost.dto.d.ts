import { EnergyCostStatus } from '../../../core/database/database.service';
export declare class CreateEnergyCostDto {
    building_id?: string;
    department_id?: string;
    period: string;
    electricity: number;
    gas: number;
    water: number;
    status: EnergyCostStatus;
}
