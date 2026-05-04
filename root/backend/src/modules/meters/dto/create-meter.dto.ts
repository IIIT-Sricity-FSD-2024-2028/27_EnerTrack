import { IsString, IsUUID, IsOptional, IsEnum } from 'class-validator';
import { MeterType, MeterStatus } from '../../../core/database/database.service';

export class CreateMeterDto {
  @IsUUID() building_id: string;
  @IsString() meter_code: string;
  @IsEnum(MeterType) meter_type: MeterType;
  @IsOptional() @IsString() zone?: string;
  @IsEnum(MeterStatus) status: MeterStatus;
}
