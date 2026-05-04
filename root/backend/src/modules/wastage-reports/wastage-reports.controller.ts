import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from "@nestjs/common";
import { WastageReportsService } from "./wastage-reports.service";
import { CreateWastageReportDto } from "./dto/create-wastage-report.dto";
import { PutWastageReportDto } from "./dto/put-wastage-report.dto";
import { UpdateWastageReportDto } from "./dto/update-wastage-report.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("wastage-reports")
@Controller("wastage-reports")
export class WastageReportsController {
  constructor(private readonly wastageReportsService: WastageReportsService) {}

  @Post()
  @ApiOperation({ summary: "Create Wastage Report", description: "Submits a new wastage report. Any authenticated user (including Campus Visitor) can report wastage. Send a POST with a CreateWastageReportDto JSON body." })
  @ApiResponse({ status: 201, description: "Wastage report created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  create(@Body() createDto: CreateWastageReportDto) {
    return this.wastageReportsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Wastage Reports", description: "Retrieves all wastage reports. Only the System Administrator and Sustainability Officer can view them." })
  @ApiResponse({ status: 200, description: "Array of wastage report records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Sustainability Officer")
  findAll() {
    return this.wastageReportsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Wastage Report by ID", description: "Retrieves a single wastage report by UUID. Only the System Administrator and Sustainability Officer can look up reports." })
  @ApiResponse({ status: 200, description: "Wastage report record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Sustainability Officer")
  findOne(@Param("id") id: string) {
    return this.wastageReportsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Wastage Report", description: "Completely replaces an existing wastage report. Only the System Administrator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutWastageReportDto) {
    return this.wastageReportsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Wastage Report", description: "Partially updates a wastage report (e.g., status). The Sustainability Officer and System Administrator can update reports." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateWastageReportDto) {
    return this.wastageReportsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Wastage Report", description: "Permanently removes a wastage report. Only the System Administrator can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.wastageReportsService.remove(id);
  }
}
