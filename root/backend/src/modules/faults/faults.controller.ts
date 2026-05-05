import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from "@nestjs/common";
import { FaultsService } from "./faults.service";
import { CreateFaultDto } from "./dto/create-fault.dto";
import { PutFaultDto } from "./dto/put-fault.dto";
import { UpdateFaultDto } from "./dto/update-fault.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("faults")
@Controller("faults")
export class FaultsController {
  constructor(private readonly faultsService: FaultsService) {}

  @Post()
  @ApiOperation({ summary: "Create Fault", description: "Logs a new equipment fault, optionally linked to an alert. System Administrator and Technician can create faults." })
  @ApiResponse({ status: 201, description: "Fault created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician Administrator", "Technician")
  create(@Body() createDto: CreateFaultDto) {
    return this.faultsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Faults", description: "Retrieves all fault records. System Administrator and Technician can view faults." })
  @ApiResponse({ status: 200, description: "Array of fault records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician Administrator", "Technician")
  findAll() {
    return this.faultsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Fault by ID", description: "Retrieves a single fault by UUID. System Administrator and Technician can look up faults." })
  @ApiResponse({ status: 200, description: "Fault record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician Administrator", "Technician")
  findOne(@Param("id") id: string) {
    return this.faultsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Fault", description: "Completely replaces an existing fault record. Only System Administrator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutFaultDto) {
    return this.faultsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Fault", description: "Partially updates a fault (e.g., status, reassigning Technician). System Administrator and Technician can update." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician Administrator", "Technician")
  update(@Param("id") id: string, @Body() updateDto: UpdateFaultDto) {
    return this.faultsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Fault", description: "Permanently removes a fault record. Only the System Administrator can delete faults." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.faultsService.remove(id);
  }

  @Get(":id/work-orders")
  @ApiOperation({ summary: "Get Work Orders for Fault", description: "Retrieves all work orders linked to a fault. System Administrator and Technician can view." })
  @ApiResponse({ status: 200, description: "Array of work order records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician Administrator", "Technician")
  getWorkOrders(@Param("id") id: string) {
    return this.faultsService.getWorkOrders(id);
  }
}
