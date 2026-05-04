import { WastageType } from '../../../core/database/database.service';
export declare class CreateWastageReportDto {
    reporter_id: string;
    type: WastageType;
    status?: string;
    details: Record<string, any>;
    sensor_reading_id?: string;
}
