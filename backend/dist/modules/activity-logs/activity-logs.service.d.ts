import { DatabaseService } from '../../core/database/database.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { UpdateActivityLogDto } from './dto/update-activity-log.dto';
export declare class ActivityLogsService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateActivityLogDto): {
        timestamp: string;
        user_id?: string;
        action_type: string;
        title: string;
        activity_log_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").ActivityLog[];
    findOne(id: string): import("../../core/database/database.service").ActivityLog;
    update(id: string, updateDto: UpdateActivityLogDto): import("../../core/database/database.service").ActivityLog;
    remove(id: string): import("../../core/database/database.service").ActivityLog;
}
