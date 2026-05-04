import { IsString, IsUUID, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { NotificationTargetType } from '../../../core/database/database.service';

export class CreateNotificationDto {
  @IsUUID() user_id: string;
  @IsEnum(NotificationTargetType) target_type: NotificationTargetType;
  @IsString() target_id: string;
  @IsString() message: string;
  @IsOptional() @IsBoolean() is_read?: boolean;
}
