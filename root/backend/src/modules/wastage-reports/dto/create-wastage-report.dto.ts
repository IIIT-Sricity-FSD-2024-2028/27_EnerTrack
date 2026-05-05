import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsObject,
} from "class-validator";
import { WastageType } from "../../../core/database/database.service";

export class CreateWastageReportDto {
  @IsOptional() @IsString() reporter_id?: string;
  @IsEnum(WastageType) type: WastageType;
  @IsOptional() @IsString() status?: string;
  @IsObject() details: Record<string, any>;
  @IsOptional() @IsString() sensor_reading_id?: string;
}
