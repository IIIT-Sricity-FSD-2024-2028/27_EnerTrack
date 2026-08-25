import { IsString, IsUUID, IsOptional } from "class-validator";

export class CreateServiceRequestDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsUUID() reporter_id: string;
  @IsOptional() @IsUUID() assigned_to_id?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() issue_type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() status?: string;
}
