import { IsString, IsUUID, IsOptional } from "class-validator";

export class CreateActivityLogDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsOptional() @IsUUID() user_id?: string;
  @IsString() action_type: string;
  @IsString() title: string;
  @IsString() timestamp: string;
}
