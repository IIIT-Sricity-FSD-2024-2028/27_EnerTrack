import { DatabaseService } from '../../core/database/database.service';
import { CreateFaultDto } from './dto/create-fault.dto';
import { UpdateFaultDto } from './dto/update-fault.dto';
export declare class FaultsService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateFaultDto): {
        alert_id?: string;
        assigned_to_id?: string;
        asset_name: string;
        fault_type: string;
        severity: import("../../core/database/database.service").FaultSeverity;
        status: import("../../core/database/database.service").FaultStatus;
        fault_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").Fault[];
    findOne(id: string): import("../../core/database/database.service").Fault;
    update(id: string, updateDto: UpdateFaultDto): import("../../core/database/database.service").Fault;
    remove(id: string): import("../../core/database/database.service").Fault;
    getWorkOrders(id: string): import("../../core/database/database.service").WorkOrder[];
}
