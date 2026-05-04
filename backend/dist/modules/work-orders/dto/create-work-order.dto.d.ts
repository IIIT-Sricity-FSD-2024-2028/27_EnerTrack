import { WorkOrderPriority, WorkOrderStatus } from '../../../core/database/database.service';
export declare class CreateWorkOrderDto {
    assigned_to_id?: string;
    linked_fault_id?: string;
    source_request_id?: string;
    title: string;
    priority: WorkOrderPriority;
    status: WorkOrderStatus;
}
