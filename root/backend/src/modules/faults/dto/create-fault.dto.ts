import { IsString, IsUUID, IsOptional, IsEnum } from "class-validator";
import {
  FaultSeverity,
  FaultStatus,
} from "../../../core/database/database.service";

export class CreateFaultDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsOptional() @IsString() alert_id?: string;
  @IsOptional() @IsUUID() assigned_to_id?: string;
  @IsString() asset_name: string;
  @IsString() fault_type: string;
  @IsEnum(FaultSeverity) severity: FaultSeverity;
  @IsEnum(FaultStatus) status: FaultStatus;
  @IsOptional() @IsString() prelim_notes?: string;
  @IsOptional() @IsString() quickfix_notes?: string;
}
