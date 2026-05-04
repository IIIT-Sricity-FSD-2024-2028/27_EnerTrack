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
import { MetersService } from "./meters.service";
import { CreateMeterDto } from "./dto/create-meter.dto";
import { PutMeterDto } from "./dto/put-meter.dto";

import { UpdateMeterDto } from "./dto/update-meter.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("meters")
@Controller("meters")
export class MetersController {
  constructor(private readonly metersService: MetersService) {}

  @Post()
  @ApiOperation({ summary: "Create Meter", description: "Registers a new IoT meter/sensor in a building. Only the System Administrator can create meters by providing building_id, meter_code, meter_type (electricity, gas, water, emissions, food), zone, and status. Send a POST request with a CreateMeterDto JSON body." })
  @ApiResponse({ status: 201, description: "Meter created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  create(@Body() createDto: CreateMeterDto) {
    return this.metersService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Meters", description: "Retrieves all meter/sensor records across all buildings. The System Administrator, Technician, and Sustainability Officer can view the full inventory of meters. Send a GET request with no additional parameters." })
  @ApiResponse({ status: 200, description: "Array of all meter records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Technician", "Sustainability Officer", "Financial Analyst")
  findAll() {
    return this.metersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Meter by ID", description: "Retrieves a single meter record by its UUID including building_id, meter_code, meter_type, zone, and status. The System Administrator, Technician, and Sustainability Officer can look up a specific meter. Pass the meter_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Meter record returned." })
  @ApiResponse({ status: 404, description: "Meter with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Technician", "Sustainability Officer", "Financial Analyst")
  findOne(@Param("id") id: string) {
    return this.metersService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Meter", description: "Completely replaces an existing meter record with new data. Only the System Administrator can perform full meter replacements. Send a PUT request with the meter_id in the URL and a complete PutMeterDto JSON body." })
  @ApiResponse({ status: 200, description: "Meter record replaced successfully." })
  @ApiResponse({ status: 404, description: "Meter with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutMeterDto) {
    return this.metersService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update Meter", description: "Partially updates specific fields of an existing meter (e.g., status from active to faulty, or zone reassignment). Only the System Administrator can modify meter configuration. Send a PATCH request with the meter_id in the URL and an UpdateMeterDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "Meter record updated successfully." })
  @ApiResponse({ status: 404, description: "Meter with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateMeterDto) {
    return this.metersService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Meter", description: "Permanently removes a meter record from the system. Only the System Administrator can decommission and delete meters. Pass the meter_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Meter record deleted successfully." })
  @ApiResponse({ status: 404, description: "Meter with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.metersService.remove(id);
  }

  @Get(":id/readings")
  @ApiOperation({ summary: "Get Readings for Meter", description: "Retrieves all meter reading records captured by a specific meter (1:N relationship). The System Administrator, Technician, and Sustainability Officer can view historical readings. Pass the meter_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Array of meter reading records for the meter returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Technician", "Sustainability Officer", "Financial Analyst")
  getReadings(@Param("id") id: string) {
    return this.metersService.getReadings(id);
  }

  @Get(":id/alerts")
  @ApiOperation({ summary: "Get Alerts for Meter", description: "Retrieves all alert records triggered by a specific meter (1:N relationship). The System Administrator and Technician can view alerts associated with a meter. Pass the meter_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Array of alert records for the meter returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Technician")
  getAlerts(@Param("id") id: string) {
    return this.metersService.getAlerts(id);
  }
}
