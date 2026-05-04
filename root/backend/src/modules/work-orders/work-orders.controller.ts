import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from "@nestjs/common";
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
  @ApiOperation({ summary: "Create Work Order", description: "Creates a new work order linked to a fault or service request. System Administrator and Technician can create work orders." })
  @ApiResponse({ status: 201, description: "Work order created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician")
  create(@Body() createDto: CreateWorkOrderDto) {
    return this.workOrdersService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Work Orders", description: "Retrieves all work orders. System Administrator and Technician can view work orders." })
  @ApiResponse({ status: 200, description: "Array of work order records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician")
  findAll() {
    return this.workOrdersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Work Order by ID", description: "Retrieves a single work order by UUID. System Administrator and Technician can look up work orders." })
  @ApiResponse({ status: 200, description: "Work order record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician")
  findOne(@Param("id") id: string) {
    return this.workOrdersService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Work Order", description: "Completely replaces a work order record. Only System Administrator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutWorkOrderDto) {
    return this.workOrdersService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Work Order", description: "Partially updates a work order (e.g., status, priority). System Administrator and Technician can update." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician")
  update(@Param("id") id: string, @Body() updateDto: UpdateWorkOrderDto) {
    return this.workOrdersService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Work Order", description: "Permanently removes a work order. Only System Administrator can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.workOrdersService.remove(id);
  }
}
