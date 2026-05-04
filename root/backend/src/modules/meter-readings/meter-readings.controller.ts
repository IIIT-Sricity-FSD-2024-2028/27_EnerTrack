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
import { MeterReadingsService } from "./meter-readings.service";
import { CreateMeterReadingDto } from "./dto/create-meter-reading.dto";
import { PutMeterReadingDto } from "./dto/put-meter-reading.dto";

import { UpdateMeterReadingDto } from "./dto/update-meter-reading.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("meter-readings")
@Controller("meter-readings")
export class MeterReadingsController {
  constructor(private readonly meterReadingsService: MeterReadingsService) {}

  @Post()
  @ApiOperation({ summary: "Create Meter Reading", description: "Records a new meter reading from an IoT sensor. The System Administrator and Technician can submit readings by providing meter_id, value, and unit. Send a POST request with a CreateMeterReadingDto JSON body." })
  @ApiResponse({ status: 201, description: "Meter reading created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator or Technician." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Technician")
  create(@Body() createDto: CreateMeterReadingDto) {
    return this.meterReadingsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Meter Readings", description: "Retrieves all meter reading records across the system. The System Administrator, Technician, Financial Analyst, and Sustainability Officer can view the full history of sensor readings. Send a GET request with no additional parameters." })
  @ApiResponse({ status: 200, description: "Array of all meter reading records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Technician", "Financial Analyst", "Sustainability Officer")
  findAll() {
    return this.meterReadingsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Meter Reading by ID", description: "Retrieves a single meter reading record by its UUID including meter_id, value, unit, and timestamp. The System Administrator, Technician, Financial Analyst, and Sustainability Officer can look up a specific reading. Pass the reading_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Meter reading record returned." })
  @ApiResponse({ status: 404, description: "Meter reading with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Technician", "Financial Analyst", "Sustainability Officer")
  findOne(@Param("id") id: string) {
    return this.meterReadingsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Meter Reading", description: "Completely replaces an existing meter reading record with new data. Only the System Administrator can perform full reading replacements. Send a PUT request with the reading_id in the URL and a complete PutMeterReadingDto JSON body." })
  @ApiResponse({ status: 200, description: "Meter reading record replaced successfully." })
  @ApiResponse({ status: 404, description: "Meter reading with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutMeterReadingDto) {
    return this.meterReadingsService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update Meter Reading", description: "Partially updates specific fields of an existing meter reading (e.g., correcting a value or unit). Only the System Administrator can modify readings. Send a PATCH request with the reading_id in the URL and an UpdateMeterReadingDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "Meter reading record updated successfully." })
  @ApiResponse({ status: 404, description: "Meter reading with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateMeterReadingDto) {
    return this.meterReadingsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Meter Reading", description: "Permanently removes a meter reading record from the system. Only the System Administrator can delete readings. Pass the reading_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Meter reading record deleted successfully." })
  @ApiResponse({ status: 404, description: "Meter reading with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.meterReadingsService.remove(id);
  }
}
