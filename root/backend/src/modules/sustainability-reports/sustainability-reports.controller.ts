import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from "@nestjs/common";
import { SustainabilityReportsService } from "./sustainability-reports.service";
import { CreateSustainabilityReportDto } from "./dto/create-sustainability-report.dto";
import { GenerateSustainabilityReportDto } from "./dto/generate-sustainability-report.dto";
import { PutSustainabilityReportDto } from "./dto/put-sustainability-report.dto";
import { UpdateSustainabilityReportDto } from "./dto/update-sustainability-report.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("sustainability-reports")
@Controller("sustainability-reports")
export class SustainabilityReportsController {
  constructor(private readonly sustainabilityReportsService: SustainabilityReportsService) {}

  @Post("generate")
  @ApiOperation({
    summary: "Generate Sustainability Report Preview",
    description:
      "Validates period bounds, computes metrics and deltas from real sensor data, and detects data gaps without saving.",
  })
  @ApiResponse({ status: 200, description: "Preview generated." })
  @ApiResponse({ status: 400, description: "Invalid period format or bounds." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @ApiHeader({ name: "x-org-id", description: "Tenant organization ID.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  generate(@Body() generateDto: GenerateSustainabilityReportDto) {
    return this.sustainabilityReportsService.generate(generateDto);
  }

  @Post()
  @ApiOperation({ summary: "Create Sustainability Report", description: "Archives a new sustainability report with KPI metrics. Sustainability Officer and Organization Admin can create." })
  @ApiResponse({ status: 201, description: "Created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  create(@Body() createDto: CreateSustainabilityReportDto) {
    return this.sustainabilityReportsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Sustainability Reports", description: "Retrieves all archived sustainability reports. Sustainability Officer and Organization Admin can view." })
  @ApiResponse({ status: 200, description: "Array of records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  findAll() {
    return this.sustainabilityReportsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Sustainability Report by ID", description: "Retrieves a single report by UUID. Sustainability Officer and Organization Admin can look up." })
  @ApiResponse({ status: 200, description: "Record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  findOne(@Param("id") id: string) {
    return this.sustainabilityReportsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Sustainability Report", description: "Completely replaces a report. Only Organization Admin can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin")
  put(@Param("id") id: string, @Body() putDto: PutSustainabilityReportDto) {
    return this.sustainabilityReportsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Sustainability Report", description: "Partially updates a report. Sustainability Officer and Organization Admin can update." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  update(@Param("id") id: string, @Body() updateDto: UpdateSustainabilityReportDto) {
    return this.sustainabilityReportsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Sustainability Report", description: "Permanently removes a report. Organization Admin and Sustainability Officer can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Sustainability Officer")
  remove(@Param("id") id: string) {
    return this.sustainabilityReportsService.remove(id);
  }
}
