import { DatabaseService } from '../../core/database/database.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
export declare class WorkOrdersService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateWorkOrderDto): {
        assigned_to_id?: string;
        linked_fault_id?: string;
        source_request_id?: string;
        title: string;
        priority: import("../../core/database/database.service").WorkOrderPriority;
        status: import("../../core/database/database.service").WorkOrderStatus;
        work_order_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").WorkOrder[];
    findOne(id: string): import("../../core/database/database.service").WorkOrder;
    update(id: string, updateDto: UpdateWorkOrderDto): import("../../core/database/database.service").WorkOrder;
    remove(id: string): import("../../core/database/database.service").WorkOrder;
}
