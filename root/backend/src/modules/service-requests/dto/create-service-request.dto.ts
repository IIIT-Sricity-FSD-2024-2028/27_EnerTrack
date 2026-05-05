import { IsString, IsUUID, IsOptional } from "class-validator";

export class CreateServiceRequestDto {
  @IsUUID() reporter_id: string;
  @IsOptional() @IsUUID() assigned_to_id?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() issue_type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() status?: string;
}
