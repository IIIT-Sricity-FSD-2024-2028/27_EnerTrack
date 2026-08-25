import { IsString, IsUUID, IsEnum, IsBoolean, IsOptional } from "class-validator";
import { NotificationTargetType } from "../../../core/database/database.service";

export class CreateNotificationDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsUUID() user_id: string;
  @IsEnum(NotificationTargetType) target_type: NotificationTargetType;
  @IsString() target_id: string;
  @IsString() message: string;
  @IsOptional() @IsBoolean() is_read?: boolean;
}
