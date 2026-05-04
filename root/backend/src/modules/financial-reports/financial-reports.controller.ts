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
import { FinancialReportsService } from "./financial-reports.service";
import { CreateFinancialReportDto } from "./dto/create-financial-report.dto";
import { PutFinancialReportDto } from "./dto/put-financial-report.dto";

import { UpdateFinancialReportDto } from "./dto/update-financial-report.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("financial-reports")
@Controller("financial-reports")
export class FinancialReportsController {
  constructor(
    private readonly financialReportsService: FinancialReportsService,
  ) {}

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
  @Roles("Financial Analyst", "System Administrator")
  create(@Body() createDto: CreateFinancialReportDto) {
    return this.financialReportsService.create(createDto);
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
  @Roles("Financial Analyst", "System Administrator")
  findAll() {
    return this.financialReportsService.findAll();
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
  @Roles("Financial Analyst", "System Administrator")
  findOne(@Param("id") id: string) {
    return this.financialReportsService.findOne(id);
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
  put(@Param("id") id: string, @Body() putDto: PutFinancialReportDto) {
    return this.financialReportsService.put(id, putDto);
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
  @Roles("Financial Analyst", "System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateFinancialReportDto) {
    return this.financialReportsService.update(id, updateDto);
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
    return this.financialReportsService.remove(id);
  }
}
