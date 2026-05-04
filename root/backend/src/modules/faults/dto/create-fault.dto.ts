import { IsString, IsUUID, IsOptional, IsEnum } from 'class-validator';
import { FaultSeverity, FaultStatus } from '../../../core/database/database.service';

export class CreateFaultDto {
  @IsOptional() @IsUUID() alert_id?: string;
  @IsOptional() @IsUUID() assigned_to_id?: string;
  @IsString() asset_name: string;
  @IsString() fault_type: string;
  @IsEnum(FaultSeverity) severity: FaultSeverity;
  @IsEnum(FaultStatus) status: FaultStatus;
}
