import { IsString, IsUUID, IsOptional, IsEnum, IsArray } from "class-validator";
import { AlertStatus } from "../../../core/database/database.service";

export class CreateAlertDto {
  @IsUUID() meter_id: string;
  @IsOptional() @IsUUID() triggering_reading_id?: string;
  @IsString() title: string;
  @IsString() severity: string;
  @IsEnum(AlertStatus) status: AlertStatus;
  @IsOptional() @IsArray() messages?: any[];
}
