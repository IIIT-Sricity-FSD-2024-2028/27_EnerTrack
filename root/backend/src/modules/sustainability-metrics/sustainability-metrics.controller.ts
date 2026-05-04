import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from "@nestjs/common";
import { SustainabilityMetricsService } from "./sustainability-metrics.service";
import { CreateSustainabilityMetricDto } from "./dto/create-sustainability-metric.dto";
import { PutSustainabilityMetricDto } from "./dto/put-sustainability-metric.dto";
import { UpdateSustainabilityMetricDto } from "./dto/update-sustainability-metric.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("sustainability-metrics")
@Controller("sustainability-metrics")
export class SustainabilityMetricsController {
  constructor(private readonly sustainabilityMetricsService: SustainabilityMetricsService) {}

  @Post()
  @ApiOperation({ summary: "Create Sustainability Metric", description: "Records a new sustainability metric snapshot. Sustainability Officer and System Administrator can create." })
  @ApiResponse({ status: 201, description: "Created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  create(@Body() createDto: CreateSustainabilityMetricDto) {
    return this.sustainabilityMetricsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Sustainability Metrics", description: "Retrieves all sustainability metrics. Sustainability Officer and System Administrator can view KPIs." })
  @ApiResponse({ status: 200, description: "Array of records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  findAll() {
    return this.sustainabilityMetricsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Sustainability Metric by ID", description: "Retrieves a single metric by UUID. Sustainability Officer and System Administrator can look up." })
  @ApiResponse({ status: 200, description: "Record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  findOne(@Param("id") id: string) {
    return this.sustainabilityMetricsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Sustainability Metric", description: "Completely replaces a metric record. Only System Administrator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutSustainabilityMetricDto) {
    return this.sustainabilityMetricsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Sustainability Metric", description: "Partially updates a metric. Sustainability Officer and System Administrator can update." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateSustainabilityMetricDto) {
    return this.sustainabilityMetricsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Sustainability Metric", description: "Permanently removes a metric. Only System Administrator can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.sustainabilityMetricsService.remove(id);
  }
}
