import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { PutNotificationDto } from "./dto/put-notification.dto";

import { UpdateNotificationDto } from "./dto/update-notification.dto";

@Injectable()
export class NotificationsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateNotificationDto) {
    if (createDto.user_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.user_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.user_id}' not found`,
        );
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { notification_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null };
    this.database.notifications.push(newRecord as any);
    return newRecord;
  }

  /**
   * Everyone sees their own messages; only an Organization Admin sees the
   * organisation's. (Messages name people and jobs, so they are not shared.)
   */
  findAll(userId?: string, role?: string) {
    const all = scopeToTenant(this.database.notifications);
    return role === "Organization Admin" ? all : all.filter((n) => !!userId && n.user_id === userId);
  }

  findOne(id: string, userId?: string, role?: string) {
    const record = assertTenantOwns(this.database.notifications.find(
      (item) => item.notification_id === id,
    ));
    if (!record || (role !== "Organization Admin" && record.user_id !== userId))
      throw new NotFoundException(`Notification with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutNotificationDto) {
    const index = this.database.notifications.findIndex(
      (item) => item.notification_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.notifications[index]))
      throw new NotFoundException(`Notification with ID ${id} not found`);
    this.database.notifications[index] = {
      notification_id: id,
      ...putDto,
      organization_id: this.database.notifications[index].organization_id,
    } as any;
    return this.database.notifications[index];
  }
  update(id: string, updateDto: UpdateNotificationDto, userId?: string, role?: string) {
    const index = this.database.notifications.findIndex(
      (item) => item.notification_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.notifications[index]))
      throw new NotFoundException(`Notification with ID ${id} not found`);
    this.assertOwner(this.database.notifications[index], id, userId, role);
    this.database.notifications[index] = {
      ...this.database.notifications[index],
      ...updateDto,
      organization_id: this.database.notifications[index].organization_id,
    };
    return this.database.notifications[index];
  }

  remove(id: string) {
    const index = this.database.notifications.findIndex(
      (item) => item.notification_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.notifications[index]))
      throw new NotFoundException(`Notification with ID ${id} not found`);
    const removed = this.database.notifications.splice(index, 1);
    return removed[0];
  }

  /** A message can be read or changed by its owner (an Organization Admin may act on any in the organisation). */
  private assertOwner(record: { user_id?: string | null }, id: string, userId?: string, role?: string) {
    if (role !== "Organization Admin" && record.user_id !== userId)
      throw new NotFoundException(`Notification with ID ${id} not found`);
  }

  /** Marks one of the caller's own messages as read. */
  markRead(id: string, userId?: string, role?: string) {
    const record = assertTenantOwns(
      this.database.notifications.find((item) => item.notification_id === id),
    );
    if (!record) throw new NotFoundException(`Notification with ID ${id} not found`);
    this.assertOwner(record, id, userId, role);
    record.is_read = true;
    return record;
  }

  /** Marks all of the caller's messages as read. */
  markAllRead(userId?: string) {
    let changed = 0;
    for (const n of scopeToTenant(this.database.notifications)) {
      if (userId && n.user_id === userId && !n.is_read) {
        n.is_read = true;
        changed++;
      }
    }
    return { updated: changed };
  }
}
