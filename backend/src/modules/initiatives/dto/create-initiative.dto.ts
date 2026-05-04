import { IsString, IsUUID, IsOptional, IsEnum, IsBoolean, IsArray } from 'class-validator';
import { InitiativeStatus } from '../../../core/database/database.service';

export class CreateInitiativeDto {
  @IsUUID() created_by_id: string;
  @IsString() title: string;
  @IsEnum(InitiativeStatus) status: InitiativeStatus;
  @IsBoolean() feasible: boolean;
  @IsString() target_reduction: string;
  @IsOptional() @IsArray() outcomes?: string[];
}
