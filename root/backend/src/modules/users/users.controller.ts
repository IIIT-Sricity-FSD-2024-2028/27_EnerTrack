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
import { LoginDto } from "./dto/login.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { Roles } from "../../core/decorators/roles.decorator";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login',
    description:
      'Authenticates a user by email and password. No x-role header required. Returns user info (without password) on success. Store the returned object in localStorage as the active session.',
  })
  @ApiResponse({ status: 200, description: 'Login successful. Returns user record (without password).' })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  loginUser(@Body() loginDto: LoginDto) {
    return this.usersService.login(loginDto.email, loginDto.password);
  }

  @Post('register')
  @ApiOperation({
    summary: 'Public User Registration',
    description: 'Registers a new user account without requiring any authorization headers. Intended for the public sign-up page.',
  })
  @ApiResponse({ status: 201, description: 'User created successfully.' })
  register(@Body() createDto: CreateUserDto) {
    return this.usersService.create(createDto);
  }

  @Post()
  @ApiOperation({ summary: "Create User", description: "Creates a new user account in the system. Only the System Administrator can register new users by providing name, email, password, role, and optional phone/specialization fields. Send a POST request with a CreateUserDto JSON body containing all required user fields." })
  @ApiResponse({ status: 201, description: "User created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  create(@Body() createDto: CreateUserDto) {
    return this.usersService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Users", description: "Retrieves a list of all registered user accounts. Internal staff can view the complete user directory to resolve names for assignments." })
  @ApiResponse({ status: 200, description: "Array of all user records returned." })
  @ApiResponse({ status: 403, description: "Forbidden – caller lacks required role." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician Administrator | Technician | Sustainability Officer", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician Administrator", "Technician", "Sustainability Officer")
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get User by ID", description: "Retrieves a single user account by its UUID. Internal staff can look up individual user profiles. Pass the user_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "User record returned." })
  @ApiResponse({ status: 404, description: "User with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller lacks required role." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician Administrator | Technician | Sustainability Officer", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician Administrator", "Technician", "Sustainability Officer")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace User", description: "Completely replaces an existing user record with new data. Only the System Administrator can perform full user replacements. Send a PUT request with the user_id in the URL and a complete PutUserDto JSON body containing all fields." })
  @ApiResponse({ status: 200, description: "User record replaced successfully." })
  @ApiResponse({ status: 404, description: "User with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutUserDto) {
    return this.usersService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update User", description: "Partially updates specific fields of an existing user record (e.g., role, specialization, contact info). Only the System Administrator can modify user details. Send a PATCH request with the user_id in the URL and an UpdateUserDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "User record updated successfully." })
  @ApiResponse({ status: 404, description: "User with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateUserDto) {
    return this.usersService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete User", description: "Permanently removes a user account from the system. Only the System Administrator can delete user records. Pass the user_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "User record deleted successfully." })
  @ApiResponse({ status: 404, description: "User with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not System Administrator." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }

  @Get(":id/notifications")
  @ApiOperation({ summary: "Get User Notifications", description: "Retrieves all notifications belonging to a specific user. Any authenticated user can fetch notifications to view alerts, wastage report updates, and service request status changes. Pass the user_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Array of notification records for the user returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  getNotifications(@Param("id") id: string) {
    return this.usersService.getNotifications(id);
  }
}
