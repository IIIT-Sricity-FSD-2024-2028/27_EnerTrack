import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { UserRole } from "../../core/database/database.service";
import { NotificationsService } from "./notifications.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { PutNotificationDto } from "./dto/put-notification.dto";

import { UpdateNotificationDto } from "./dto/update-notification.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: "Create Notification", description: "Creates a new notification record linked to a target entity (wastage report, alert, or service request). Only the Organization Admin can manually create notifications. Send a POST request with a CreateNotificationDto JSON body containing user_id, target_type, target_id, and message." })
  @ApiResponse({ status: 201, description: "Notification created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Organization Admin." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin")
  create(@Body() createDto: CreateNotificationDto) {
    return this.notificationsService.create(createDto);
  }

  /** Declared before ":id" routes so "mine" is not read as an id. */
  @Get("mine")
  @ApiOperation({ summary: "My Notifications", description: "The signed-in user's own notifications, newest first. This is what the notification bell shows. Any signed-in role." })
  @ApiResponse({ status: 200, description: "The caller's notifications." })
  @ApiResponse({ status: 401, description: "Not signed in." })
  @Roles(...Object.values(UserRole))
  findMine(@Headers("x-user-id") userId?: string) {
    if (!userId) throw new UnauthorizedException("Sign in to see your notifications.");
    return this.notificationsService.findMine(userId);
  }

  @Patch("mine/read")
  @ApiOperation({ summary: "Mark My Notifications Read", description: "Marks all of the signed-in user's notifications as read. Returns how many changed." })
  @ApiResponse({ status: 200, description: "{ updated: number }" })
  @ApiResponse({ status: 401, description: "Not signed in." })
  @Roles(...Object.values(UserRole))
  markAllMine(@Headers("x-user-id") userId?: string) {
    if (!userId) throw new UnauthorizedException("Sign in to update your notifications.");
    return this.notificationsService.markAllMine(userId);
  }

  @Get()
  @ApiOperation({ summary: "List All Notifications", description: "Every notification in the organisation, for administration. Only the Organization Admin; other users read their own through GET /notifications/mine." })
  @ApiResponse({ status: 200, description: "Array of all notification records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findAll(@Headers("x-user-id") userId?: string, @Headers("x-role") role?: string) {
    return this.notificationsService.findAll(userId, role);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Notification by ID", description: "Retrieves a single notification record by its UUID. Any authenticated user can look up a specific notification. Pass the notification_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Notification record returned." })
  @ApiResponse({ status: 404, description: "Notification with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findOne(@Param("id") id: string, @Headers("x-user-id") userId?: string, @Headers("x-role") role?: string) {
    return this.notificationsService.findOne(id, userId, role);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Notification", description: "Completely replaces an existing notification record with new data. Only the Organization Admin can perform full notification replacements. Send a PUT request with the notification_id in the URL and a complete PutNotificationDto JSON body." })
  @ApiResponse({ status: 200, description: "Notification record replaced successfully." })
  @ApiResponse({ status: 404, description: "Notification with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Organization Admin." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin")
  put(@Param("id") id: string, @Body() putDto: PutNotificationDto) {
    return this.notificationsService.put(id, putDto);
  }
  @Patch("read-all")
  @ApiOperation({ summary: "Mark all my notifications as read", description: "Marks every notification addressed to the caller as read." })
  @ApiResponse({ status: 200, description: "Number of notifications updated." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  markAllRead(@Headers("x-user-id") userId?: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Notification", description: "Partially updates specific fields of an existing notification (e.g., message text or target references). Any authenticated user can update their own notification. Send a PATCH request with the notification_id in the URL and an UpdateNotificationDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "Notification record updated successfully." })
  @ApiResponse({ status: 404, description: "Notification with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  update(
    @Param("id") id: string,
    @Body() updateDto: UpdateNotificationDto,
    @Headers("x-user-id") userId?: string,
    @Headers("x-role") role?: string,
  ) {
    return this.notificationsService.update(id, updateDto, userId, role);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Notification", description: "Permanently removes a notification record from the system. Only the Organization Admin can delete notifications. Pass the notification_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Notification record deleted successfully." })
  @ApiResponse({ status: 404, description: "Notification with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Organization Admin." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin")
  remove(@Param("id") id: string) {
    return this.notificationsService.remove(id);
  }

  @Patch(":id/mark-read")
  @ApiOperation({ summary: "Mark Notification as Read", description: "Marks a specific notification as read by setting its is_read flag to true. Any authenticated user can mark their own notifications as read. Pass the notification_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Notification marked as read successfully." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  markRead(@Param("id") id: string, @Headers("x-user-id") userId?: string, @Headers("x-role") role?: string) {
    return this.notificationsService.markRead(id, userId, role);
  }
}
