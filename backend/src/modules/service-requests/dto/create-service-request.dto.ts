import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateServiceRequestDto {
  @IsUUID() reporter_id: string;
  @IsOptional() @IsUUID() assigned_to_id?: string;
  @IsString() category: string;
  @IsString() issue_type: string;
  @IsOptional() @IsString() status?: string;
}
