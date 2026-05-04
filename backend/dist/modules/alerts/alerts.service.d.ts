import { DatabaseService } from '../../core/database/database.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
export declare class AlertsService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateAlertDto): {
        meter_id: string;
        triggering_reading_id?: string;
        title: string;
        severity: string;
        status: import("../../core/database/database.service").AlertStatus;
        messages?: any[];
        alert_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").Alert[];
    findOne(id: string): import("../../core/database/database.service").Alert;
    update(id: string, updateDto: UpdateAlertDto): import("../../core/database/database.service").Alert;
    remove(id: string): import("../../core/database/database.service").Alert;
    getFaults(id: string): import("../../core/database/database.service").Fault[];
    addMessage(id: string, message: any): import("../../core/database/database.service").Alert;
}
