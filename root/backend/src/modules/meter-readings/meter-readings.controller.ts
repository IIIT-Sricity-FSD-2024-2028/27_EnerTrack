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
  @ApiOperation({ summary: "Create record" })
  @ApiResponse({ status: 201, description: "Successful response" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  @Roles("System Administrator", "Technician")
  create(@Body() createDto: CreateMeterReadingDto) {
    return this.meterReadingsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Retrieve record(s)" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  findAll() {
    return this.meterReadingsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Retrieve record(s)" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 404, description: "Not Found" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  findOne(@Param("id") id: string) {
    return this.meterReadingsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace record completely" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 404, description: "Not Found" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutMeterReadingDto) {
    return this.meterReadingsService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update record" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 404, description: "Not Found" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  @Roles("System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateMeterReadingDto) {
    return this.meterReadingsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete record" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 404, description: "Not Found" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.meterReadingsService.remove(id);
  }
}
