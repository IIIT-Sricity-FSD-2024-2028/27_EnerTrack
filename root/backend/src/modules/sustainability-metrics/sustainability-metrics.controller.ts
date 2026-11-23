import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Query } from "@nestjs/common";
import { SustainabilityMetricsService } from "./sustainability-metrics.service";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("sustainability-metrics")
@Controller("sustainability-metrics")
export class SustainabilityMetricsController {
  constructor(private readonly sustainabilityMetricsService: SustainabilityMetricsService) {}

  @Get()
  @ApiOperation({ summary: "List All Sustainability Metrics", description: "Read-only list of stored sustainability metric snapshots, kept for the legacy front-end. The dashboards use GET /sustainability-metrics/summary, which is computed from meter readings; metric records can no longer be created, edited or deleted through the API." })
  @ApiResponse({ status: 200, description: "Array of records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  findAll() {
    return this.sustainabilityMetricsService.findAll();
  }

  @Get("summary")
  @ApiOperation({
    summary: "Get Sustainability Metrics Summary",
    description:
      "Tenant-scoped summary of energy, water, gas, emissions (Scope 1 gas + Scope 2 grid electricity), and food wastage across a period. Defaults to January of the current year through the last full month. granularity is month (default), quarter or year; readings are monthly totals, so week/day are rejected with 400. Includes time series, totals, deltas vs previous period, meter coverage, and silent_meters (active meters with no readings in the period). With groupBy=building, also by_building: per-building electricity, water, gas and emissions (they add up to the campus totals), electricity change vs the previous period and vs the same months last year, meters reporting, and silent or faulty meters.",
  })
  @ApiResponse({ status: 200, description: "Summary returned." })
  @ApiResponse({ status: 400, description: "Invalid date range or format." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @ApiHeader({ name: "x-org-id", description: "Tenant organization ID.", required: false })
  @Roles("Sustainability Officer", "Organization Admin")
  getSummary(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("granularity") granularity?: string,
    @Query("groupBy") groupBy?: string,
  ) {
    return this.sustainabilityMetricsService.getSummary({ from, to, granularity, groupBy });
  }
}
