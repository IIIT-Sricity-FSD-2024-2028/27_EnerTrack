import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
} from "@nestjs/common";
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
  @ApiOperation({ summary: "Create record" })
  @ApiResponse({ status: 201, description: "Successful response" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  @Roles("Sustainability Officer", "System Administrator")
  create(@Body() createDto: CreateInitiativeDto) {
    return this.initiativesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Retrieve record(s)" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  findAll() {
    return this.initiativesService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Retrieve record(s)" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 404, description: "Not Found" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  findOne(@Param("id") id: string) {
    return this.initiativesService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace record completely" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 404, description: "Not Found" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutInitiativeDto) {
    return this.initiativesService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update record" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 404, description: "Not Found" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  @Roles("Sustainability Officer", "System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateInitiativeDto) {
    return this.initiativesService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete record" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 404, description: "Not Found" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.initiativesService.remove(id);
  }
}
