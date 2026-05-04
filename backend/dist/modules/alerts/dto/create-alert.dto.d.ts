import { AlertStatus } from '../../../core/database/database.service';
export declare class CreateAlertDto {
    meter_id: string;
    triggering_reading_id?: string;
    title: string;
    severity: string;
    status: AlertStatus;
    messages?: any[];
}
