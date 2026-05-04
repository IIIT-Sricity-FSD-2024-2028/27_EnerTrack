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
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { PutDepartmentDto } from "./dto/put-department.dto";

import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("departments")
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @ApiOperation({ summary: "Create Department", description: "Creates a new department within a building. Only the System Administrator can add departments by providing building_id, name, and optional budget. Send a POST request with a CreateDepartmentDto JSON body." })
  @ApiResponse({ status: 201, description: "Department created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  create(@Body() createDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Departments", description: "Retrieves all department records across all buildings. Any authenticated user can view the complete department directory. Send a GET request with no additional parameters." })
  @ApiResponse({ status: 200, description: "Array of all department records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Department by ID", description: "Retrieves a single department record by its UUID including building_id, name, and budget. Any authenticated user can look up a specific department. Pass the department_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Department record returned." })
  @ApiResponse({ status: 404, description: "Department with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findOne(@Param("id") id: string) {
    return this.departmentsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Department", description: "Completely replaces an existing department record with new data. Only the System Administrator can perform full department replacements. Send a PUT request with the department_id in the URL and a complete PutDepartmentDto JSON body." })
  @ApiResponse({ status: 200, description: "Department record replaced successfully." })
  @ApiResponse({ status: 404, description: "Department with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutDepartmentDto) {
    return this.departmentsService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update Department", description: "Partially updates specific fields of an existing department (e.g., name or budget). Only the System Administrator can modify department details. Send a PATCH request with the department_id in the URL and an UpdateDepartmentDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "Department record updated successfully." })
  @ApiResponse({ status: 404, description: "Department with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Department", description: "Permanently removes a department record from the system. Only the System Administrator can delete departments. Pass the department_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Department record deleted successfully." })
  @ApiResponse({ status: 404, description: "Department with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.departmentsService.remove(id);
  }

  @Get(":id/invoices")
  @ApiOperation({ summary: "Get Invoices for Department", description: "Retrieves all invoice records linked to a specific department (1:N relationship). The System Administrator and Financial Analyst can view invoices for a department. Pass the department_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Array of invoice records for the department returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst")
  getInvoices(@Param("id") id: string) {
    return this.departmentsService.getInvoices(id);
  }
}
