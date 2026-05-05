import { IsString, IsUUID, IsOptional, IsEnum, IsObject } from "class-validator";
import {
  WorkOrderPriority,
  WorkOrderStatus,
} from "../../../core/database/database.service";

export class CreateWorkOrderDto {
  @IsOptional() @IsString() assigned_to_id?: string;
  @IsOptional() @IsString() linked_fault_id?: string;
  @IsOptional() @IsString() source_request_id?: string;
  @IsString() title: string;
  @IsEnum(WorkOrderPriority) priority: WorkOrderPriority;
  @IsEnum(WorkOrderStatus) status: WorkOrderStatus;
  @IsOptional() @IsObject() details?: Record<string, any>;
}
