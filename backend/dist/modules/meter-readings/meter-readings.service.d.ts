import { DatabaseService } from '../../core/database/database.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';
export declare class MeterReadingsService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateMeterReadingDto): {
        timestamp: string;
        meter_id: string;
        value: number;
        unit: string;
        reading_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").MeterReading[];
    findOne(id: string): import("../../core/database/database.service").MeterReading;
    update(id: string, updateDto: UpdateMeterReadingDto): import("../../core/database/database.service").MeterReading;
    remove(id: string): import("../../core/database/database.service").MeterReading;
}
