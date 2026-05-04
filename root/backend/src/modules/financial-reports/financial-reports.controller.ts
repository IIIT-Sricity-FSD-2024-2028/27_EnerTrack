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
  @ApiOperation({ summary: "Create Financial Report", description: "Generates a new financial report for a building or department. The Financial Analyst and System Administrator can create reports by providing generated_by_id, building_id, department_id, title, period, roi, and npv. Send a POST request with a CreateFinancialReportDto JSON body." })
  @ApiResponse({ status: 201, description: "Financial report created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Financial Analyst or System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Financial Analyst", "System Administrator")
  create(@Body() createDto: CreateFinancialReportDto) {
    return this.financialReportsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Financial Reports", description: "Retrieves all financial report records. The Financial Analyst and System Administrator can view the complete archive of financial reports. Send a GET request with no additional parameters." })
  @ApiResponse({ status: 200, description: "Array of all financial report records returned." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Financial Analyst or System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Financial Analyst", "System Administrator")
  findAll() {
    return this.financialReportsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Financial Report by ID", description: "Retrieves a single financial report by its UUID including generated_by_id, building/department scope, title, period, roi, and npv. The Financial Analyst and System Administrator can look up a specific report. Pass the financial_report_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Financial report record returned." })
  @ApiResponse({ status: 404, description: "Financial report with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Financial Analyst or System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Financial Analyst", "System Administrator")
  findOne(@Param("id") id: string) {
    return this.financialReportsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Financial Report", description: "Completely replaces an existing financial report record with new data. Only the System Administrator can perform full report replacements. Send a PUT request with the financial_report_id in the URL and a complete PutFinancialReportDto JSON body." })
  @ApiResponse({ status: 200, description: "Financial report record replaced successfully." })
  @ApiResponse({ status: 404, description: "Financial report with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutFinancialReportDto) {
    return this.financialReportsService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update Financial Report", description: "Partially updates specific fields of an existing financial report (e.g., updating roi or npv values). The Financial Analyst and System Administrator can modify reports. Send a PATCH request with the financial_report_id in the URL and an UpdateFinancialReportDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "Financial report record updated successfully." })
  @ApiResponse({ status: 404, description: "Financial report with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Financial Analyst or System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Financial Analyst", "System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateFinancialReportDto) {
    return this.financialReportsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Financial Report", description: "Permanently removes a financial report record from the system. Only the System Administrator can delete financial reports. Pass the financial_report_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Financial report record deleted successfully." })
  @ApiResponse({ status: 404, description: "Financial report with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.financialReportsService.remove(id);
  }
}
