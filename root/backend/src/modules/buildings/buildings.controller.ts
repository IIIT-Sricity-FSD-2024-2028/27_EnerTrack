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
import { BuildingsService } from "./buildings.service";
import { CreateBuildingDto } from "./dto/create-building.dto";
import { PutBuildingDto } from "./dto/put-building.dto";

import { UpdateBuildingDto } from "./dto/update-building.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("buildings")
@Controller("buildings")
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Post()
  @ApiOperation({ summary: "Create Building", description: "Creates a new building record under a campus. Only the System Administrator can add buildings by providing campus_id, name, and optional budget. Send a POST request with a CreateBuildingDto JSON body." })
  @ApiResponse({ status: 201, description: "Building created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  create(@Body() createDto: CreateBuildingDto) {
    return this.buildingsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Buildings", description: "Retrieves all building records in the system. Any authenticated user can view the complete list of buildings across all campuses. Send a GET request with no additional parameters." })
  @ApiResponse({ status: 200, description: "Array of all building records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findAll() {
    return this.buildingsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Building by ID", description: "Retrieves a single building record by its UUID including campus_id, name, and budget. Any authenticated user can look up a specific building. Pass the building_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Building record returned." })
  @ApiResponse({ status: 404, description: "Building with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findOne(@Param("id") id: string) {
    return this.buildingsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Building", description: "Completely replaces an existing building record with new data. Only the System Administrator can perform full building replacements. Send a PUT request with the building_id in the URL and a complete PutBuildingDto JSON body." })
  @ApiResponse({ status: 200, description: "Building record replaced successfully." })
  @ApiResponse({ status: 404, description: "Building with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutBuildingDto) {
    return this.buildingsService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update Building", description: "Partially updates specific fields of an existing building (e.g., name or budget). Only the System Administrator can modify building details. Send a PATCH request with the building_id in the URL and an UpdateBuildingDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "Building record updated successfully." })
  @ApiResponse({ status: 404, description: "Building with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateBuildingDto) {
    return this.buildingsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Building", description: "Permanently removes a building record from the system. Only the System Administrator can delete buildings. Pass the building_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Building record deleted successfully." })
  @ApiResponse({ status: 404, description: "Building with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.buildingsService.remove(id);
  }

  @Get(":id/departments")
  @ApiOperation({ summary: "Get Departments for Building", description: "Retrieves all department records that belong to a specific building (1:N relationship). Any authenticated user can view departments within a building. Pass the building_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Array of department records for the building returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  getDepartments(@Param("id") id: string) {
    return this.buildingsService.getDepartments(id);
  }

  @Get(":id/meters")
  @ApiOperation({ summary: "Get Meters for Building", description: "Retrieves all meter/IoT sensor records installed in a specific building (1:N relationship). Any authenticated user can view meters for a building. Pass the building_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Array of meter records for the building returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  getMeters(@Param("id") id: string) {
    return this.buildingsService.getMeters(id);
  }
}
