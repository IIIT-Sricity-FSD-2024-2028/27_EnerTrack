import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { Roles } from "../../core/decorators/roles.decorator";
import { FoodWasteLogsService } from "./food-waste-logs.service";
import { CreateFoodWasteLogDto } from "./dto/create-food-waste-log.dto";

const STAFF = ["Organization Admin", "Sustainability Officer", "Operations Coordinator", "Technician"];

@ApiTags("food-waste-logs")
@Controller("food-waste-logs")
export class FoodWasteLogsController {
  constructor(private readonly service: FoodWasteLogsService) {}

  @Post()
  @ApiOperation({ summary: "Log food waste", description: "Records the kg of food cleared from a place's food-waste bins on a day. Technicians may log only if they are on the General Maintenance team. The date defaults to today and cannot be in the future." })
  @ApiResponse({ status: 201, description: "Logged." })
  @ApiResponse({ status: 403, description: "Forbidden (role, or a technician not on General Maintenance)." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles(...STAFF)
  create(@Body() dto: CreateFoodWasteLogDto, @Headers("x-user-id") userId?: string, @Headers("x-role") role?: string) {
    return this.service.create(dto, userId, role);
  }

  @Get("summary")
  @ApiOperation({ summary: "Food waste by place", description: "kg a day over the last 7 and 30 days for each place, and whether the last week is rising." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles(...STAFF)
  summary() {
    return this.service.summary();
  }

  @Get()
  @ApiOperation({ summary: "List food waste logs", description: "Newest first. Filter by place and date range (YYYY-MM-DD)." })
  @ApiQuery({ name: "location", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles(...STAFF)
  findAll(@Query("location") location?: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.service.findAll(location, from, to);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a food waste log", description: "Removes a mistaken entry." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Organization Admin", "Sustainability Officer")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
