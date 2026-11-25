import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Headers } from "@nestjs/common";
import { InitiativesService } from "./initiatives.service";
import { CreateInitiativeDto } from "./dto/create-initiative.dto";
import { PutInitiativeDto } from "./dto/put-initiative.dto";
import { UpdateInitiativeDto } from "./dto/update-initiative.dto";
import { ReworkRequestDto } from "./dto/rework-request.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("initiatives")
@Controller("initiatives")
export class InitiativesController {
  constructor(private readonly initiativesService: InitiativesService) {}

  @Post()
  @ApiOperation({ summary: "Create Initiative", description: "Proposes a new sustainability initiative. Sustainability Officer and Organization Admin can create. created_by_id is set to the signed-in user; it cannot be supplied. Optional capex, start_date and target_date (YYYY-MM-DD) are stored." })
  @ApiResponse({ status: 201, description: "Created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  create(
    @Body() createDto: CreateInitiativeDto,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.initiativesService.create(createDto, userId);
  }

  @Get()
  @ApiOperation({ summary: "List All Initiatives", description: "Retrieves all initiatives, each with its jobs, spend (money.spent from approved expense bills) and payback. Sustainability Officer, Organization Admin and Financial Analyst can view." })
  @ApiResponse({ status: 200, description: "Array of records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin", "Financial Analyst")
  findAll() {
    return this.initiativesService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Initiative by ID", description: "Retrieves a single initiative by UUID. Sustainability Officer and Organization Admin can look up." })
  @ApiResponse({ status: 200, description: "Record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin", "Financial Analyst")
  findOne(@Param("id") id: string) {
    return this.initiativesService.findOne(id);
  }

  @Get(":id/performance")
  @ApiOperation({
    summary: "Initiative performance",
    description:
      "Measured saving since start_date: each month against the same month a year earlier on the initiative's meters (meter_ids, else its metric's meters in building_ids, else the whole organisation), counting only months with readings on both sides. Returns months_compared, actual_saving_to_date, expected_to_date (expected_saving pro rata), on_track and a green/amber/red rating. measurable=false without a metric or start date.",
  })
  @Roles("Sustainability Officer", "Organization Admin", "Financial Analyst")
  performance(@Param("id") id: string) {
    return this.initiativesService.performance(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Initiative", description: "Completely replaces an initiative. Only Organization Admin can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin")
  put(
    @Param("id") id: string,
    @Body() putDto: PutInitiativeDto,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.initiativesService.put(id, putDto, role, userId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Initiative", description: "Partially updates an initiative. Status changes follow the approval gate: only the Organization Admin moves proposed→approved|rejected (optional decision_note, sent to the proposer); the Sustainability Officer (or Admin) moves approved→in-progress→completed. Anything else is 403. With onsite_work: approved→in-progress sends one job per technician type in teams into dispatch, all at once, each due on the target date (400 if that date has passed); in-progress→completed is refused (409) while any of its jobs is open." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  update(
    @Param("id") id: string,
    @Body() updateDto: UpdateInitiativeDto,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.initiativesService.update(id, updateDto, role, userId);
  }

  @Post(":id/jobs/:workOrderId/rework-request")
  @ApiOperation({
    summary: "Ask for rework on an initiative job",
    description:
      "For an in-progress initiative with on-site work: one of its closed jobs was not done as required. Records a rework request with the reason and notifies the coordinators, who decide who redoes it and by when, or decline (POST /dispatch/rework-requests/:ticketId). One open request per job; the initiative cannot be completed while it is pending. 400 if the job is still open or the reason is under 3 characters; 409 if already requested or redone.",
  })
  @ApiResponse({ status: 201, description: "Request recorded; returns the initiative with its jobs." })
  @Roles("Sustainability Officer", "Organization Admin")
  requestRework(
    @Param("id") id: string,
    @Param("workOrderId") workOrderId: string,
    @Body() dto: ReworkRequestDto,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.initiativesService.requestRework(id, workOrderId, dto.reason, userId);
  }

  @Patch(":id/archive")
  @ApiOperation({ summary: "Archive Initiative", description: "Moves a completed or rejected initiative into Archives without deleting it. Any other status returns 400. Archiving again keeps the original archived_at." })
  @ApiResponse({ status: 200, description: "Archived." })
  @ApiResponse({ status: 400, description: "Initiative is not completed or rejected." })
  @ApiResponse({ status: 404, description: "Not found." })
  @Roles("Sustainability Officer", "Organization Admin")
  archive(@Param("id") id: string) {
    return this.initiativesService.archive(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Initiative", description: "Permanently removes an initiative. The Sustainability Officer can only withdraw a proposed or rejected one (409 otherwise); the Organization Admin can remove any." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  remove(@Param("id") id: string, @Headers("x-role") role?: string) {
    return this.initiativesService.remove(id, role);
  }
}
