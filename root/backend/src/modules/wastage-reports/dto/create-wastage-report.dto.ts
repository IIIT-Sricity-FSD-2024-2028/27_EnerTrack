import { IsString, IsOptional, IsEnum, IsObject, IsArray, ArrayMaxSize } from "class-validator";
import { WastageType } from "../../../core/database/database.service";

export class CreateWastageReportDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsOptional() @IsString() reporter_id?: string;
  @IsEnum(WastageType) type: WastageType;
  @IsOptional() @IsString() status?: string;
  @IsObject() details: Record<string, any>;
  @IsOptional() @IsString() sensor_reading_id?: string;
  /** The issue reports behind this case (a hotspot of waste incidents). */
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) source_request_ids?: string[];
}
