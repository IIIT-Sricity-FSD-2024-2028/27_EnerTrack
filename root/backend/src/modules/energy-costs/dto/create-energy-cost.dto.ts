import { IsString, IsUUID, IsOptional, IsNumber, IsEnum } from "class-validator";
import { EnergyCostStatus } from "../../../core/database/database.service";

export class CreateEnergyCostDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsOptional() @IsUUID() building_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsString() period: string;
  @IsNumber() electricity: number;
  @IsNumber() gas: number;
  @IsNumber() water: number;
  @IsEnum(EnergyCostStatus) status: EnergyCostStatus;
  @IsOptional() @IsNumber() wastewater?: number;
  @IsOptional() @IsNumber() demand?: number;
  @IsOptional() @IsNumber() total?: number;
  @IsOptional() @IsNumber() budget?: number;
  @IsOptional() @IsNumber() variance?: number;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsString() scope_label?: string;
  @IsOptional() @IsString() scopeRef?: string;
  @IsOptional() @IsString() scopeLabel?: string;
}
