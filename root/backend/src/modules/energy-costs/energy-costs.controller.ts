import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from "@nestjs/common";
import { EnergyCostsService } from "./energy-costs.service";
import { CreateEnergyCostDto } from "./dto/create-energy-cost.dto";
import { PutEnergyCostDto } from "./dto/put-energy-cost.dto";
import { UpdateEnergyCostDto } from "./dto/update-energy-cost.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("energy-costs")
@Controller("energy-costs")
export class EnergyCostsController {
  constructor(private readonly energyCostsService: EnergyCostsService) {}

  @Post()
  @ApiOperation({ summary: "Create Energy Cost", description: "Records a new energy cost entry for a building/department for a given period. Financial Analyst and System Administrator can create." })
  @ApiResponse({ status: 201, description: "Energy cost created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  create(@Body() createDto: CreateEnergyCostDto) {
    return this.energyCostsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Energy Costs", description: "Retrieves all energy cost records. Financial Analyst and System Administrator can view energy cost data." })
  @ApiResponse({ status: 200, description: "Array of energy cost records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  findAll() {
    return this.energyCostsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Energy Cost by ID", description: "Retrieves a single energy cost record by UUID. Financial Analyst and System Administrator can look up records." })
  @ApiResponse({ status: 200, description: "Energy cost record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  findOne(@Param("id") id: string) {
    return this.energyCostsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Energy Cost", description: "Completely replaces an energy cost record. Only System Administrator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutEnergyCostDto) {
    return this.energyCostsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Energy Cost", description: "Partially updates an energy cost record (e.g., adjusting costs or budget status). Financial Analyst and System Administrator can update." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateEnergyCostDto) {
    return this.energyCostsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Energy Cost", description: "Permanently removes an energy cost record. Only System Administrator can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.energyCostsService.remove(id);
  }

  @Get("by-period/:period")
  @ApiOperation({ summary: "Get Energy Costs by Period", description: "Retrieves energy costs for a specific billing period (e.g., '2025-03'). Financial Analyst and System Administrator can filter by period." })
  @ApiResponse({ status: 200, description: "Array of energy cost records for the period returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  getByPeriod(@Param("period") period: string) {
    return this.energyCostsService.getByPeriod(period);
  }
}
