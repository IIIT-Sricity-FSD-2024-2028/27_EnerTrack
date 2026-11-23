import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Headers } from "@nestjs/common";
import { SustainabilityReportsService } from "./sustainability-reports.service";
import { CreateSustainabilityReportDto } from "./dto/create-sustainability-report.dto";
import { GenerateSustainabilityReportDto } from "./dto/generate-sustainability-report.dto";
import { PutSustainabilityReportDto } from "./dto/put-sustainability-report.dto";
import { UpdateSustainabilityReportDto } from "./dto/update-sustainability-report.dto";
import { UpdateReportStatusDto } from "./dto/update-report-status.dto";
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
  @ApiOperation({ summary: "Create Sustainability Report", description: "Saves a sustainability report for a period. The server generates the whole snapshot (totals, deltas, metrics, meter coverage, data gaps) from meter readings, exactly as POST /generate previews it, and records the signed-in user as generated_by_id. Only period, from, to and title are accepted; client-supplied metrics are rejected. New reports start as status draft." })
  @ApiResponse({ status: 201, description: "Created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  create(
    @Body() createDto: CreateSustainabilityReportDto,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.sustainabilityReportsService.create(createDto, userId);
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
  @ApiOperation({ summary: "Replace Sustainability Report", description: "Regenerates a saved report for the given period from current meter readings, keeping its id, author and status. Only Organization Admin." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin")
  put(@Param("id") id: string, @Body() putDto: PutSustainabilityReportDto) {
    return this.sustainabilityReportsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Sustainability Report", description: "Renames a draft report. Only the title of a draft can change (409 once submitted); the figures are a snapshot of the readings." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  update(@Param("id") id: string, @Body() updateDto: UpdateSustainabilityReportDto) {
    return this.sustainabilityReportsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Sustainability Report", description: "Deletes a draft report: the Sustainability Officer their own drafts, the Organization Admin any draft. Submitted, approved and published reports cannot be deleted (409)." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Sustainability Officer")
  remove(
    @Param("id") id: string,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.sustainabilityReportsService.remove(id, role, userId);
  }

  @Patch(":id/status")
  @ApiOperation({
    summary: "Move a report through sign-off",
    description:
      "draft→submitted (Sustainability Officer or Organization Admin); submitted→approved or back to draft with a note, approved→published (Organization Admin only). Anything else is 403. The people concerned are notified.",
  })
  @ApiResponse({ status: 403, description: "Not allowed for this role, or not a legal move." })
  @Roles("Sustainability Officer", "Organization Admin")
  setStatus(
    @Param("id") id: string,
    @Body() dto: UpdateReportStatusDto,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.sustainabilityReportsService.setStatus(id, dto, role, userId);
  }

  @Post(":id/restate")
  @ApiOperation({
    summary: "Restate a published report",
    description:
      "Creates a new draft for the same period from current readings, linked to the original (supersedes / superseded_by). The published report itself never changes. 409 unless published and not already restated.",
  })
  @ApiResponse({ status: 409, description: "Not published, or already restated." })
  @Roles("Sustainability Officer", "Organization Admin")
  restate(@Param("id") id: string, @Headers("x-user-id") userId?: string) {
    return this.sustainabilityReportsService.restate(id, userId);
  }
}
