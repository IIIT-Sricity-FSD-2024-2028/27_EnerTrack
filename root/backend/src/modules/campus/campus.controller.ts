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
import { CampusService } from "./campus.service";
import { CreateCampusDto } from "./dto/create-campu.dto";
import { PutCampusDto } from "./dto/put-campu.dto";

import { UpdateCampusDto } from "./dto/update-campu.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("campus")
@Controller("campus")
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Post()
  @ApiOperation({ summary: "Create Campus", description: "Registers a new campus location in the system with its name, location, and total_budget. Only the System Administrator can create campus records. Send a POST request with a CreateCampusDto JSON body." })
  @ApiResponse({ status: 201, description: "Campus created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  create(@Body() createDto: CreateCampusDto) {
    return this.campusService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Campuses", description: "Retrieves all campus records in the system. Any authenticated user can view the list of campuses and their budgets. Send a GET request with no additional parameters." })
  @ApiResponse({ status: 200, description: "Array of all campus records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findAll() {
    return this.campusService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Campus by ID", description: "Retrieves a single campus record by its UUID including name, location, and total_budget. Any authenticated user can look up a specific campus. Pass the campus_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Campus record returned." })
  @ApiResponse({ status: 404, description: "Campus with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findOne(@Param("id") id: string) {
    return this.campusService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Campus", description: "Completely replaces an existing campus record with new data. Only the System Administrator can perform full campus replacements. Send a PUT request with the campus_id in the URL and a complete PutCampusDto JSON body." })
  @ApiResponse({ status: 200, description: "Campus record replaced successfully." })
  @ApiResponse({ status: 404, description: "Campus with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutCampusDto) {
    return this.campusService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update Campus", description: "Partially updates specific fields of an existing campus record (e.g., total_budget or location). Only the System Administrator can modify campus details. Send a PATCH request with the campus_id in the URL and an UpdateCampusDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "Campus record updated successfully." })
  @ApiResponse({ status: 404, description: "Campus with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateCampusDto) {
    return this.campusService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Campus", description: "Permanently removes a campus record and its associated hierarchy from the system. Only the System Administrator can delete campus records. Pass the campus_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Campus record deleted successfully." })
  @ApiResponse({ status: 404, description: "Campus with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.campusService.remove(id);
  }

  @Get(":id/buildings")
  @ApiOperation({ summary: "Get Buildings for Campus", description: "Retrieves all building records that belong to a specific campus (1:N relationship). Any authenticated user can view buildings within a campus. Pass the campus_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Array of building records for the campus returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  getBuildings(@Param("id") id: string) {
    return this.campusService.getBuildings(id);
  }
}
