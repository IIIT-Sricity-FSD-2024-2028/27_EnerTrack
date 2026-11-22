import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Headers } from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { CreateAlertDto } from "./dto/create-alert.dto";
import { PutAlertDto } from "./dto/put-alert.dto";
import { UpdateAlertDto } from "./dto/update-alert.dto";
import { Roles } from "../../core/decorators/roles.decorator";
import { AddMessageDto } from "./dto/add-message.dto";
import { DecideAlertDto } from "./dto/decide-alert.dto";

@ApiTags("alerts")
@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: "Create Alert", description: "Creates a new alert triggered by a meter anomaly. The Organization Admin, Operations Coordinator and Technician can raise alerts." })
  @ApiResponse({ status: 201, description: "Alert created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Sustainability Officer")
  create(@Body() createDto: CreateAlertDto) {
    return this.alertsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Alerts", description: "Retrieves all alert records. The Organization Admin, Operations Coordinator and Technician can view alerts and their statuses." })
  @ApiResponse({ status: 200, description: "Array of alert records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Sustainability Officer")
  findAll() {
    return this.alertsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Alert by ID", description: "Retrieves a single alert by UUID including messages chat thread. The Organization Admin, Operations Coordinator and Technician can look up alerts." })
  @ApiResponse({ status: 200, description: "Alert record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Sustainability Officer")
  findOne(@Param("id") id: string) {
    return this.alertsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Alert", description: "Completely replaces an existing alert record. Only the Organization Admin and Operations Coordinator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator")
  put(@Param("id") id: string, @Body() putDto: PutAlertDto) {
    return this.alertsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Alert", description: "Partially updates an alert (e.g., status from open to acknowledged/resolved). Organization Admin, Operations Coordinator and Technician can update." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician")
  update(@Param("id") id: string, @Body() updateDto: UpdateAlertDto) {
    return this.alertsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Alert", description: "Permanently removes an alert record. Only the Organization Admin and Operations Coordinator can delete alerts." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator")
  remove(@Param("id") id: string) {
    return this.alertsService.remove(id);
  }

  @Post(":id/decide")
  @ApiOperation({ summary: "Decide an alert", description: "One step: send it on as a fault (asset and fault_type required), keep monitoring, or close as a false alarm. Records what was done in the alert log." })
  @ApiResponse({ status: 201, description: "Decision recorded; the fault is returned when one was raised." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator")
  decide(@Param("id") id: string, @Body() dto: DecideAlertDto, @Headers("x-user-id") userId?: string, @Headers("x-role") role?: string) {
    return this.alertsService.decide(id, dto, userId, role);
  }

  @Post(":id/messages")
  @ApiOperation({ summary: "Add Message to Alert Thread", description: "Appends a message to the alert JSONB messages thread. Organization Admin, Operations Coordinator and Technician can post messages." })
  @ApiResponse({ status: 201, description: "Message added successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Sustainability Officer")
  addMessage(@Param("id") id: string, @Body() messageDto: AddMessageDto) {
    // implemented logic for adding message
    return this.alertsService.addMessage(id, messageDto);
  }

  @Get(":id/faults")
  @ApiOperation({ summary: "Get Faults for Alert", description: "Retrieves all fault records linked to a specific alert. Organization Admin, Operations Coordinator and Technician can view faults from an alert." })
  @ApiResponse({ status: 200, description: "Array of fault records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician")
  getFaults(@Param("id") id: string) {
    return this.alertsService.getFaults(id);
  }
}

