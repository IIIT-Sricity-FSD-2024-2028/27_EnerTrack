import { DatabaseService } from '../../core/database/database.service';
import { CreateCampusDto } from './dto/create-campu.dto';
import { UpdateCampusDto } from './dto/update-campu.dto';
export declare class CampusService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateCampusDto): {
        campus_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").Campus[];
    findOne(id: string): import("../../core/database/database.service").Campus;
    update(id: string, updateDto: UpdateCampusDto): import("../../core/database/database.service").Campus;
    remove(id: string): import("../../core/database/database.service").Campus;
    getBuildings(id: string): import("../../core/database/database.service").Building[];
}
