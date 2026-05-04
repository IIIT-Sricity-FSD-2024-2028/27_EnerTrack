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
import { ActivityLogsService } from "./activity-logs.service";
import { CreateActivityLogDto } from "./dto/create-activity-log.dto";
import { PutActivityLogDto } from "./dto/put-activity-log.dto";

import { UpdateActivityLogDto } from "./dto/update-activity-log.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("activity-logs")
@Controller("activity-logs")
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Post()
  @ApiOperation({ summary: "Create Activity Log", description: "Records a new audit trail entry capturing a user action in the system. Only the System Administrator can manually create activity log entries by providing user_id, action_type, and title. Send a POST request with a CreateActivityLogDto JSON body." })
  @ApiResponse({ status: 201, description: "Activity log entry created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  create(@Body() createDto: CreateActivityLogDto) {
    return this.activityLogsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Activity Logs", description: "Retrieves all activity log entries for system-wide audit tracking. Only the System Administrator can view the complete audit trail. Send a GET request with no additional parameters." })
  @ApiResponse({ status: 200, description: "Array of all activity log entries returned." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  findAll() {
    return this.activityLogsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Activity Log by ID", description: "Retrieves a single activity log entry by its UUID including user_id, action_type, title, and timestamp. Only the System Administrator can look up specific log entries. Pass the activity_log_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Activity log entry returned." })
  @ApiResponse({ status: 404, description: "Activity log with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  findOne(@Param("id") id: string) {
    return this.activityLogsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Activity Log", description: "Completely replaces an existing activity log entry with new data. Only the System Administrator can perform full log replacements. Send a PUT request with the activity_log_id in the URL and a complete PutActivityLogDto JSON body." })
  @ApiResponse({ status: 200, description: "Activity log entry replaced successfully." })
  @ApiResponse({ status: 404, description: "Activity log with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutActivityLogDto) {
    return this.activityLogsService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update Activity Log", description: "Partially updates specific fields of an existing activity log entry. Only the System Administrator can modify log entries. Send a PATCH request with the activity_log_id in the URL and an UpdateActivityLogDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "Activity log entry updated successfully." })
  @ApiResponse({ status: 404, description: "Activity log with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateActivityLogDto) {
    return this.activityLogsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Activity Log", description: "Permanently removes an activity log entry from the system. Only the System Administrator can delete audit trail records. Pass the activity_log_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Activity log entry deleted successfully." })
  @ApiResponse({ status: 404, description: "Activity log with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.activityLogsService.remove(id);
  }
}
