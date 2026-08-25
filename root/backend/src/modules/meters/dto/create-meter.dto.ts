import { IsString, IsOptional, IsEnum } from "class-validator";
import {
  MeterType,
  MeterStatus,
} from "../../../core/database/database.service";

export class CreateMeterDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() building_id: string;
  @IsString() meter_code: string;
  @IsEnum(MeterType) meter_type: MeterType;
  @IsOptional() @IsString() zone?: string;
  @IsEnum(MeterStatus) status: MeterStatus;
}
