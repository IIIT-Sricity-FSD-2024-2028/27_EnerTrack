import { IsString, IsUUID, IsOptional, IsNumber, IsEnum, Min } from "class-validator";
import { EnergyCostStatus } from "../../../core/database/database.service";

export class CreateEnergyCostDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsOptional() @IsUUID() building_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsString() period: string;
  /** Amounts cannot be negative. The server adds them up; it ignores a total, variance or status sent by the client. */
  @IsNumber() @Min(0) electricity: number;
  @IsNumber() @Min(0) gas: number;
  @IsNumber() @Min(0) water: number;
  @IsOptional() @IsEnum(EnergyCostStatus) status?: EnergyCostStatus;
  @IsOptional() @IsNumber() @Min(0) wastewater?: number;
  @IsOptional() @IsNumber() @Min(0) demand?: number;
  @IsOptional() @IsNumber() total?: number;
  /** Leave out (or 0) when there is no budget for this record. */
  @IsOptional() @IsNumber() @Min(0) budget?: number;
  @IsOptional() @IsNumber() variance?: number;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsString() scope_label?: string;
  @IsOptional() @IsString() scopeRef?: string;
  @IsOptional() @IsString() scopeLabel?: string;
}
