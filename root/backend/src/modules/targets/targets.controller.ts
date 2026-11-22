import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { Roles } from "../../core/decorators/roles.decorator";
import { TargetsService } from "./targets.service";
import { CreateTargetDto } from "./dto/create-target.dto";
import { UpdateTargetStatusDto } from "./dto/update-target-status.dto";

@ApiTags("targets")
@Controller("targets")
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Post()
  @ApiOperation({
    summary: "Propose a sustainability target",
    description:
      "Cut a metric (energy_kwh, water_kl, gas_m3, emissions_kg) by reduction_pct against a finished baseline period by a future deadline month, for the organisation or some buildings. Always starts as proposed; the Organization Admins are notified. One open (proposed or active) target per metric and scope.",
  })
  @ApiResponse({ status: 201, description: "Proposed. Returned with summary and progress." })
  @ApiResponse({ status: 400, description: "Invalid months, unknown building, or deadline already passed." })
  @ApiResponse({ status: 409, description: "An open target already covers this metric and scope." })
  @Roles("Sustainability Officer", "Organization Admin")
  create(@Body() dto: CreateTargetDto, @Headers("x-user-id") userId?: string) {
    return this.targetsService.create(dto, userId);
  }

  @Get()
  @ApiOperation({
    summary: "List targets with progress",
    description:
      "Every target in the organisation, newest first, each with a plain-language summary and its progress. Active targets whose deadline month has finished are closed as met or missed first.",
  })
  @Roles("Sustainability Officer", "Organization Admin")
  findAll() {
    return this.targetsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a target with progress" })
  @ApiResponse({ status: 404, description: "Not found." })
  @Roles("Sustainability Officer", "Organization Admin")
  findOne(@Param("id") id: string) {
    return this.targetsService.findOne(id);
  }

  @Get(":id/progress")
  @ApiOperation({
    summary: "Target progress",
    description:
      "Compares each month after the baseline with the same calendar month in the baseline, counting only months with readings on both sides. Returns baseline_value, current_value, target_value, achieved_reduction_pct, required_reduction_pct (straight line from approval to deadline), on_track and months_compared.",
  })
  @Roles("Sustainability Officer", "Organization Admin")
  progress(@Param("id") id: string) {
    return this.targetsService.progress(id);
  }

  @Patch(":id/status")
  @ApiOperation({
    summary: "Approve, reject or close a target",
    description:
      "Organization Admin only: proposed→active|rejected, active→met|missed. Anyone else gets 403. The proposer is notified.",
  })
  @ApiResponse({ status: 403, description: "Not the Organization Admin, or a move that is not allowed." })
  @Roles("Sustainability Officer", "Organization Admin")
  setStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTargetStatusDto,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.targetsService.setStatus(id, dto, role, userId);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Withdraw a proposed target",
    description: "Only while proposed, by whoever proposed it or the Organization Admin. 409 once approved or closed.",
  })
  @ApiResponse({ status: 409, description: "Not proposed any more." })
  @Roles("Sustainability Officer", "Organization Admin")
  remove(
    @Param("id") id: string,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.targetsService.remove(id, role, userId);
  }
}
