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
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { PutUserDto } from "./dto/put-user.dto";

import { UpdateUserDto } from "./dto/update-user.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  @Roles("System Administrator")
  create(@Body() createDto: CreateUserDto) {
    return this.usersService.create(createDto);
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
  @Roles("System Administrator")
  findAll() {
    return this.usersService.findAll();
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
  @Roles("System Administrator")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
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
  put(@Param("id") id: string, @Body() putDto: PutUserDto) {
    return this.usersService.put(id, putDto);
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
  @Roles("System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateUserDto) {
    return this.usersService.update(id, updateDto);
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
    return this.usersService.remove(id);
  }

  @Get(":id/notifications")
  @ApiOperation({ summary: "Retrieve record(s)" })
  @ApiResponse({ status: 200, description: "Successful response" })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({
    name: "x-role",
    description:
      "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor",
    required: false,
  })
  getNotifications(@Param("id") id: string) {
    return this.usersService.getNotifications(id);
  }
}
