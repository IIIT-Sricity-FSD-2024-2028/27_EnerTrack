import { IsString, IsUUID, IsOptional, IsEnum } from "class-validator";
import {
  WorkOrderPriority,
  WorkOrderStatus,
} from "../../../core/database/database.service";

export class CreateWorkOrderDto {
  @IsOptional() @IsUUID() assigned_to_id?: string;
  @IsOptional() @IsUUID() linked_fault_id?: string;
  @IsOptional() @IsUUID() source_request_id?: string;
  @IsString() title: string;
  @IsEnum(WorkOrderPriority) priority: WorkOrderPriority;
  @IsEnum(WorkOrderStatus) status: WorkOrderStatus;
}
