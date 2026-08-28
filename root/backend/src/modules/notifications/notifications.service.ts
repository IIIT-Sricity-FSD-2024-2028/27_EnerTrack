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

  findAll() {
    return scopeToTenant(this.database.notifications);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.notifications.find(
      (item) => item.notification_id === id,
    ));
    if (!record)
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
    } as any;
    return this.database.notifications[index];
  }
  update(id: string, updateDto: UpdateNotificationDto) {
    const index = this.database.notifications.findIndex(
      (item) => item.notification_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.notifications[index]))
      throw new NotFoundException(`Notification with ID ${id} not found`);
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

  markRead(id: string) {
    const index = this.database.notifications.findIndex(
      (item) => item.notification_id === id,
    );
    if (index > -1) {
      this.database.notifications[index].is_read = true;
      return this.database.notifications[index];
    }
    return null;
  }
}
