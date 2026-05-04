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
} from "@nestjs/common";
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
  @ApiOperation({ summary: "Create Notification", description: "Creates a new notification record linked to a target entity (wastage report, alert, or service request). Only the System Administrator can manually create notifications. Send a POST request with a CreateNotificationDto JSON body containing user_id, target_type, target_id, and message." })
  @ApiResponse({ status: 201, description: "Notification created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  create(@Body() createDto: CreateNotificationDto) {
    return this.notificationsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Notifications", description: "Retrieves all notification records across the system. Any authenticated user can access this endpoint to view all notifications. Send a GET request with no additional parameters." })
  @ApiResponse({ status: 200, description: "Array of all notification records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Notification by ID", description: "Retrieves a single notification record by its UUID. Any authenticated user can look up a specific notification. Pass the notification_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Notification record returned." })
  @ApiResponse({ status: 404, description: "Notification with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findOne(@Param("id") id: string) {
    return this.notificationsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Notification", description: "Completely replaces an existing notification record with new data. Only the System Administrator can perform full notification replacements. Send a PUT request with the notification_id in the URL and a complete PutNotificationDto JSON body." })
  @ApiResponse({ status: 200, description: "Notification record replaced successfully." })
  @ApiResponse({ status: 404, description: "Notification with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutNotificationDto) {
    return this.notificationsService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update Notification", description: "Partially updates specific fields of an existing notification (e.g., message text or target references). Any authenticated user can update their own notification. Send a PATCH request with the notification_id in the URL and an UpdateNotificationDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "Notification record updated successfully." })
  @ApiResponse({ status: 404, description: "Notification with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  update(@Param("id") id: string, @Body() updateDto: UpdateNotificationDto) {
    return this.notificationsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Notification", description: "Permanently removes a notification record from the system. Only the System Administrator can delete notifications. Pass the notification_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Notification record deleted successfully." })
  @ApiResponse({ status: 404, description: "Notification with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.notificationsService.remove(id);
  }

  @Patch(":id/mark-read")
  @ApiOperation({ summary: "Mark Notification as Read", description: "Marks a specific notification as read by setting its is_read flag to true. Any authenticated user can mark their own notifications as read. Pass the notification_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Notification marked as read successfully." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  markRead(@Param("id") id: string) {
    return this.notificationsService.markRead(id);
  }
}
