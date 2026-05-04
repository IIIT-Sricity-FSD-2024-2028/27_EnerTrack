import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from "@nestjs/common";
import { InitiativesService } from "./initiatives.service";
import { CreateInitiativeDto } from "./dto/create-initiative.dto";
import { PutInitiativeDto } from "./dto/put-initiative.dto";
import { UpdateInitiativeDto } from "./dto/update-initiative.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("initiatives")
@Controller("initiatives")
export class InitiativesController {
  constructor(private readonly initiativesService: InitiativesService) {}

  @Post()
  @ApiOperation({ summary: "Create Initiative", description: "Proposes a new sustainability initiative. Sustainability Officer and System Administrator can create." })
  @ApiResponse({ status: 201, description: "Created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  create(@Body() createDto: CreateInitiativeDto) {
    return this.initiativesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Initiatives", description: "Retrieves all initiatives. Sustainability Officer and System Administrator can view." })
  @ApiResponse({ status: 200, description: "Array of records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  findAll() {
    return this.initiativesService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Initiative by ID", description: "Retrieves a single initiative by UUID. Sustainability Officer and System Administrator can look up." })
  @ApiResponse({ status: 200, description: "Record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  findOne(@Param("id") id: string) {
    return this.initiativesService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Initiative", description: "Completely replaces an initiative. Only System Administrator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutInitiativeDto) {
    return this.initiativesService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Initiative", description: "Partially updates an initiative (e.g., status, outcomes). Sustainability Officer and System Administrator can update." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateInitiativeDto) {
    return this.initiativesService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Initiative", description: "Permanently removes an initiative." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  remove(@Param("id") id: string) {
    return this.initiativesService.remove(id);
  }
}
