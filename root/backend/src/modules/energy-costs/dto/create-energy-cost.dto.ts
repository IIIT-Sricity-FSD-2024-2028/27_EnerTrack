import { IsString, IsUUID, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { EnergyCostStatus } from '../../../core/database/database.service';

export class CreateEnergyCostDto {
  @IsOptional() @IsUUID() building_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsString() period: string;
  @IsNumber() electricity: number;
  @IsNumber() gas: number;
  @IsNumber() water: number;
  @IsEnum(EnergyCostStatus) status: EnergyCostStatus;
}
