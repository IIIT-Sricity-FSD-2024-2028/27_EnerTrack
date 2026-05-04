import { NotificationTargetType } from '../../../core/database/database.service';
export declare class CreateNotificationDto {
    user_id: string;
    target_type: NotificationTargetType;
    target_id: string;
    message: string;
    is_read?: boolean;
}
