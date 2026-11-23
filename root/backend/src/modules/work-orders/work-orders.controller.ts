import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Headers } from "@nestjs/common";
import { WorkOrdersService } from "./work-orders.service";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { PutWorkOrderDto } from "./dto/put-work-order.dto";
import { UpdateWorkOrderDto } from "./dto/update-work-order.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("work-orders")
@Controller("work-orders")
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  @ApiOperation({ summary: "Create Work Order", description: "Creates a new work order linked to a fault or service request. Organization Admin, Operations Coordinator and Technician can create work orders." })
  @ApiResponse({ status: 201, description: "Work order created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician")
  create(@Body() createDto: CreateWorkOrderDto, @Headers("x-role") role?: string) {
    return this.workOrdersService.create(createDto, role);
  }

  @Get()
  @ApiOperation({ summary: "List All Work Orders", description: "Retrieves all work orders." })
  @ApiResponse({ status: 200, description: "Array of work order records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Financial Analyst")
  findAll(@Headers("x-role") role?: string) {
    return this.workOrdersService.findAll(role);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Work Order by ID", description: "Retrieves a single work order by UUID." })
  @ApiResponse({ status: 200, description: "Work order record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Financial Analyst")
  findOne(@Param("id") id: string) {
    return this.workOrdersService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Work Order", description: "Completely replaces a work order record. Organization Admin and Operations Coordinator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator")
  put(@Param("id") id: string, @Body() putDto: PutWorkOrderDto, @Headers("x-role") role?: string, @Headers("x-user-id") userId?: string) {
    return this.workOrdersService.put(id, putDto, role, userId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Work Order", description: "Partially updates a work order (e.g., status, priority). Organization Admin, Operations Coordinator, Technician, and Financial Analyst can update." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Financial Analyst")
  update(@Param("id") id: string, @Body() updateDto: UpdateWorkOrderDto, @Headers("x-role") role?: string, @Headers("x-user-id") userId?: string) {
    return this.workOrdersService.update(id, updateDto, role, userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Work Order", description: "Permanently removes a work order. Organization Admin and Operations Coordinator can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator")
  remove(@Param("id") id: string) {
    return this.workOrdersService.remove(id);
  }
}

