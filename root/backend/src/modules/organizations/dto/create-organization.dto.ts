import { IsString, IsOptional, IsNumber, IsEnum } from "class-validator";
import {
  OrganizationStatus,
  DataSourceTier,
} from "../../../core/database/database.service";

export class CreateOrganizationDto {
  @IsString() name: string;
  @IsString() type: string;
  @IsOptional() @IsString() location?: string;
  @IsEnum(OrganizationStatus) status: OrganizationStatus;
  @IsOptional() @IsEnum(DataSourceTier) data_source_tier?: DataSourceTier;
  @IsOptional() @IsNumber() floor_area_sqm?: number;
  @IsOptional() @IsNumber() tariff_rate?: number;
  @IsOptional() @IsString() contract_start?: string;
}
