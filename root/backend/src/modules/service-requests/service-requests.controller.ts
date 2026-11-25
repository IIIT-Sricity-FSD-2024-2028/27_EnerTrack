import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Headers, Query, Res, UploadedFile, UseFilters, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { photoUploadConfig } from "../../core/middleware/file-upload.middleware";
import { MulterExceptionFilter } from "../../core/filters/multer-exception.filter";
import { assertFileSignatures } from "../../core/utils/file-signature";
import { StillBrokenDto } from "./dto/still-broken.dto";
import { ServiceRequestsService } from "./service-requests.service";
import { IssueReportsService } from "./issue-reports.service";
import { CreateIssueReportDto } from "./dto/create-issue-report.dto";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { PutServiceRequestDto } from "./dto/put-service-request.dto";
import { UpdateServiceRequestDto } from "./dto/update-service-request.dto";
import { SetPriorityDto } from "./dto/set-priority.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("service-requests")
@Controller("service-requests")
export class ServiceRequestsController {
  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
    private readonly issueReports: IssueReportsService,
  ) {}

  // The routes below are declared before ":id" so they are not read as an id.

  @Get("catalogue")
  @ApiOperation({ summary: "Issue report question lists", description: "The lists the report form is built from. Labels and follow-up questions only: no priority, size, tags or team." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Operations Coordinator", "Technician", "Sustainability Officer", "Campus Visitor")
  catalogue() {
    return this.issueReports.catalogue();
  }

  @Post("reports")
  @ApiOperation({ summary: "Report an issue", description: "A student sends answers only. The server decides priority, size, team and duplicates, and takes the reporter from the login. Returns outcome created, joined, already_reported, or covered (answer 'Is this the same problem?' by resending with same_as)." })
  @ApiResponse({ status: 201, description: "Report recorded, or a covering ticket is offered." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Operations Coordinator", "Technician", "Sustainability Officer", "Campus Visitor")
  report(@Headers("x-user-id") userId: string, @Body() dto: CreateIssueReportDto) {
    return this.issueReports.submit(userId, dto);
  }

  @Get("campus-issues")
  @ApiOperation({ summary: "Open campus issues", description: "Every open issue in the organisation, filterable by building and floor. Status and place only: no names, priority or counts." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Operations Coordinator", "Technician", "Sustainability Officer", "Campus Visitor")
  campusIssues(
    @Headers("x-user-id") userId: string,
    @Query("building_id") buildingId?: string,
    @Query("floor") floor?: string,
  ) {
    return this.issueReports.campusIssues(userId, buildingId, floor);
  }

  @Get("mine")
  @ApiOperation({ summary: "My reports", description: "The caller's own reports and the ones they +1'd. Status only." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Operations Coordinator", "Technician", "Sustainability Officer", "Campus Visitor")
  mine(@Headers("x-user-id") userId: string) {
    return this.issueReports.mine(userId);
  }

  @Post(":id/plus-one")
  @ApiOperation({ summary: "+1 Same", description: "Counts the caller as affected by an open issue. One +1 per person; never changes priority except through the crowd raise." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Operations Coordinator", "Technician", "Sustainability Officer", "Campus Visitor")
  plusOne(@Headers("x-user-id") userId: string, @Param("id") id: string) {
    return this.issueReports.plusOne(userId, id);
  }

  @Post(":id/confirm-fixed")
  @ApiOperation({ summary: "Confirm the fix", description: "The reporter says the fix worked. Only on an issue fixed within the last week." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Operations Coordinator", "Technician", "Sustainability Officer", "Campus Visitor")
  confirmFixed(@Headers("x-user-id") userId: string, @Param("id") id: string) {
    return this.issueReports.respond(userId, id, true);
  }

  @Post(":id/still-broken")
  @ApiOperation({
    summary: "Still broken",
    description:
      "Files the same problem again as a new report linked to the fixed one, raised one level because it happened before. reason (what is still wrong) is required; a photo is optional (multipart field 'photo', JPEG or PNG, up to 5 MB). The new job is offered first to the technician who did the fix; if they cannot take it, it is ranked as usual and the coordinator is told.",
  })
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiBody({
    schema: {
      type: "object",
      required: ["reason"],
      properties: { reason: { type: "string", maxLength: 500 }, photo: { type: "string", format: "binary" } },
    },
  })
  @ApiResponse({ status: 400, description: "No reason, not yours, too late to reopen, or the photo is not a JPEG/PNG." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Operations Coordinator", "Technician", "Sustainability Officer", "Campus Visitor")
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor("photo", photoUploadConfig))
  stillBroken(
    @Headers("x-user-id") userId: string,
    @Param("id") id: string,
    @Body() dto: StillBrokenDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    // A photo must really be a JPEG or PNG, not just named like one.
    if (photo) assertFileSignatures([photo], "image");
    return this.issueReports.respond(userId, id, false, { reason: dto.reason, photo: photo?.path ?? null });
  }

  @Get(":id/reopen-photo")
  @ApiOperation({
    summary: "Photo sent with a 'still broken' report",
    description: "Streams the photo the reporter attached when they said the fix did not work. Staff in the organisation, and the reporter themselves.",
  })
  @ApiResponse({ status: 404, description: "No such report, or it has no photo." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Sustainability Officer", "Campus Visitor")
  reopenPhoto(
    @Headers("x-user-id") userId: string,
    @Headers("x-role") role: string,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    return res.sendFile(this.issueReports.reopenPhotoPath(userId, role, id));
  }

  @Post()
  @ApiOperation({ summary: "Create Service Request", description: "Staff-entered free-text service request. Students and visitors report through POST /service-requests/reports, where the server decides priority." })
  @ApiResponse({ status: 201, description: "Service request created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Operations Coordinator", "Technician", "Sustainability Officer")
  create(@Body() createDto: CreateServiceRequestDto) {
    return this.serviceRequestsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Service Requests", description: "Retrieves all service requests." })
  @ApiResponse({ status: 200, description: "Array of service request records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Financial Analyst", "Campus Visitor")
  findAll(@Headers("x-user-id") userId: string, @Headers("x-role") role: string) {
    return this.serviceRequestsService.findAll(userId, role);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Service Request by ID", description: "Retrieves a single service request by UUID." })
  @ApiResponse({ status: 200, description: "Service request record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Financial Analyst")
  findOne(@Param("id") id: string) {
    return this.serviceRequestsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Service Request", description: "Completely replaces a service request. Only Organization Admin can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin")
  put(@Param("id") id: string, @Body() putDto: PutServiceRequestDto) {
    return this.serviceRequestsService.put(id, putDto);
  }

  @Put(":id/priority")
  @ApiOperation({ summary: "Set an issue's priority", description: "The coordinator's override. Send {level: 'low'|'medium'|'high'|'immediate'}, or {level: null} to go back to the system's level." })
  @ApiResponse({ status: 200, description: "Priority updated." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator")
  setPriority(@Param("id") id: string, @Body() dto: SetPriorityDto) {
    return this.serviceRequestsService.setPriority(id, dto.level);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Service Request", description: "Partially updates a service request." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician", "Financial Analyst")
  update(@Param("id") id: string, @Body() updateDto: UpdateServiceRequestDto) {
    return this.serviceRequestsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Service Request", description: "Permanently removes a service request. Only Organization Admin can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin")
  remove(@Param("id") id: string) {
    return this.serviceRequestsService.remove(id);
  }

  @Get(":id/work-orders")
  @ApiOperation({ summary: "Get Work Orders for Service Request", description: "Retrieves all work orders from a service request. Organization Admin and Technician can view." })
  @ApiResponse({ status: 200, description: "Array of work order records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Operations Coordinator", "Technician")
  getWorkOrders(@Param("id") id: string) {
    return this.serviceRequestsService.getWorkOrders(id);
  }
}
