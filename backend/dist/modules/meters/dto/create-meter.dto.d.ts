import { MeterType, MeterStatus } from '../../../core/database/database.service';
export declare class CreateMeterDto {
    building_id: string;
    meter_code: string;
    meter_type: MeterType;
    zone?: string;
    status: MeterStatus;
}
