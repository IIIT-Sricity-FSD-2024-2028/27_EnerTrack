import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from "@nestjs/common";
import { ServiceRequestsService } from "./service-requests.service";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { PutServiceRequestDto } from "./dto/put-service-request.dto";
import { UpdateServiceRequestDto } from "./dto/update-service-request.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("service-requests")
@Controller("service-requests")
export class ServiceRequestsController {
  constructor(private readonly serviceRequestsService: ServiceRequestsService) {}

  @Post()
  @ApiOperation({ summary: "Create Service Request", description: "Submits a new service request. Any authenticated user (including Campus Visitor) can create service requests." })
  @ApiResponse({ status: 201, description: "Service request created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  create(@Body() createDto: CreateServiceRequestDto) {
    return this.serviceRequestsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Service Requests", description: "Retrieves all service requests." })
  @ApiResponse({ status: 200, description: "Array of service request records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician", "Financial Analyst")
  findAll() {
    return this.serviceRequestsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Service Request by ID", description: "Retrieves a single service request by UUID." })
  @ApiResponse({ status: 200, description: "Service request record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician", "Financial Analyst")
  findOne(@Param("id") id: string) {
    return this.serviceRequestsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Service Request", description: "Completely replaces a service request. Only System Administrator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutServiceRequestDto) {
    return this.serviceRequestsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Service Request", description: "Partially updates a service request." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician", "Financial Analyst")
  update(@Param("id") id: string, @Body() updateDto: UpdateServiceRequestDto) {
    return this.serviceRequestsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Service Request", description: "Permanently removes a service request. Only System Administrator can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.serviceRequestsService.remove(id);
  }

  @Get(":id/work-orders")
  @ApiOperation({ summary: "Get Work Orders for Service Request", description: "Retrieves all work orders from a service request. System Administrator and Technician can view." })
  @ApiResponse({ status: 200, description: "Array of work order records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Technician")
  getWorkOrders(@Param("id") id: string) {
    return this.serviceRequestsService.getWorkOrders(id);
  }
}
