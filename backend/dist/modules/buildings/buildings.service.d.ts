import { DatabaseService } from '../../core/database/database.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
export declare class BuildingsService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateBuildingDto): {
        campus_id: string;
        name: string;
        budget?: number;
        building_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").Building[];
    findOne(id: string): import("../../core/database/database.service").Building;
    update(id: string, updateDto: UpdateBuildingDto): import("../../core/database/database.service").Building;
    remove(id: string): import("../../core/database/database.service").Building;
    getDepartments(id: string): import("../../core/database/database.service").Department[];
    getMeters(id: string): import("../../core/database/database.service").Meter[];
}
