import { DatabaseService } from '../../core/database/database.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
export declare class MetersService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateMeterDto): {
        building_id: string;
        meter_code: string;
        meter_type: import("../../core/database/database.service").MeterType;
        zone?: string;
        status: import("../../core/database/database.service").MeterStatus;
        meter_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").Meter[];
    findOne(id: string): import("../../core/database/database.service").Meter;
    update(id: string, updateDto: UpdateMeterDto): import("../../core/database/database.service").Meter;
    remove(id: string): import("../../core/database/database.service").Meter;
    getReadings(id: string): import("../../core/database/database.service").MeterReading[];
    getAlerts(id: string): import("../../core/database/database.service").Alert[];
}
