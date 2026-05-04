import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    create(createDto: CreateNotificationDto): {
        user_id: string;
        target_type: import("../../core/database/database.service").NotificationTargetType;
        target_id: string;
        message: string;
        is_read?: boolean;
        notification_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").Notification[];
    findOne(id: string): import("../../core/database/database.service").Notification;
    update(id: string, updateDto: UpdateNotificationDto): import("../../core/database/database.service").Notification;
    remove(id: string): import("../../core/database/database.service").Notification;
    markRead(id: string): import("../../core/database/database.service").Notification;
}
