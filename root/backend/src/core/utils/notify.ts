import * as crypto from "crypto";
import {
  DatabaseService,
  NotificationTargetType,
} from "../database/database.service";

/**
 * Writes one in-app notification per recipient. These are what the
 * notification bell reads (GET /notifications/mine), so they reach the
 * person on any device, unlike the old localStorage notifications.
 */
export function pushNotifications(
  database: DatabaseService,
  opts: {
    organizationId: string | null;
    userIds: (string | null | undefined)[];
    targetType: NotificationTargetType;
    targetId: string;
    message: string;
  },
): number {
  const recipients = [...new Set(opts.userIds.filter((id): id is string => !!id))];
  const now = new Date().toISOString();
  for (const userId of recipients) {
    database.notifications.push({
      notification_id: crypto.randomUUID(),
      organization_id: opts.organizationId as string,
      user_id: userId,
      target_type: opts.targetType,
      target_id: opts.targetId,
      message: opts.message,
      is_read: false,
      created_at: now,
    });
  }
  return recipients.length;
}

/** user_ids of everyone in an organisation with one of the given roles. */
export function usersWithRole(
  database: DatabaseService,
  organizationId: string | null,
  roles: string[],
): string[] {
  return database.users
    .filter((u) => u.organization_id === organizationId && roles.includes(u.role))
    .map((u) => u.user_id);
}
