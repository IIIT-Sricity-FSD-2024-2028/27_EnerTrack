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
import { WorkOrdersService } from "./work-orders.service";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { PutWorkOrderDto } from "./dto/put-work-order.dto";

import { UpdateWorkOrderDto } from "./dto/update-work-order.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("work-orders")
@Controller("work-orders")
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

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
  @Roles("System Administrator", "Technician")
  create(@Body() createDto: CreateWorkOrderDto) {
    return this.workOrdersService.create(createDto);
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
    return this.workOrdersService.findAll();
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
    return this.workOrdersService.findOne(id);
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
  put(@Param("id") id: string, @Body() putDto: PutWorkOrderDto) {
    return this.workOrdersService.put(id, putDto);
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
  @Roles("System Administrator", "Technician")
  update(@Param("id") id: string, @Body() updateDto: UpdateWorkOrderDto) {
    return this.workOrdersService.update(id, updateDto);
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
    return this.workOrdersService.remove(id);
  }
}
