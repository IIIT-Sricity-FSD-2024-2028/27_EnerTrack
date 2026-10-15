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
import { ChangePasswordDto } from "./dto/change-password.dto";
import { SignupDto } from "./dto/signup.dto";
import { BulkCreateUsersDto } from "./dto/bulk-create-users.dto";
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

  @Post(':id/impersonate')
  @ApiOperation({
    summary: 'Act as Another User',
    description:
      "Returns another user's session so a Super Admin can see the product as they see it. Same shape as login, so the client can drop it straight into the session it already holds. Every call is written to the activity log naming both parties. This is a support tool, not a security boundary: authorisation here is a client-supplied x-role header with no token, so the capability already exists to anyone with devtools — this route makes it deliberate, logged and one click.",
  })
  @ApiResponse({ status: 200, description: 'Returns the target user record (without password).' })
  @ApiResponse({ status: 404, description: 'User with the given ID not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden – caller is not a Super Admin.' })
  @ApiHeader({
    name: 'x-role',
    description: 'Must be Super Admin.',
    required: false,
  })
  @Roles('Super Admin')
  impersonate(@Param('id') id: string, @Body() body: { actor?: string }) {
    return this.usersService.impersonate(id, body?.actor ?? null);
  }

  @Post('signup')
  @ApiOperation({
    summary: 'Campus Visitor Sign-up (public)',
    description:
      "Lets a student or faculty member create their own Campus Visitor account. The organisation is found from the email domain the organisation's administrator registered; role and organisation cannot be supplied. Returns the same shape as login so the client can start a session. No x-role header required.",
  })
  @ApiResponse({ status: 201, description: 'Account created. Returns the user record (without password).' })
  @ApiResponse({ status: 400, description: 'Email domain is not linked to an organisation, or a field is invalid.' })
  @ApiResponse({ status: 409, description: 'Email or phone already registered.' })
  signup(@Body() dto: SignupDto) {
    return this.usersService.signup(dto);
  }

  @Post('change-password')
  @ApiOperation({
    summary: 'Change Password',
    description:
      'Replaces a password after proving the current one. Used for the forced change on first sign-in after an administrator issued the credentials. No x-role header required.',
  })
  @ApiResponse({ status: 200, description: 'Password changed. Returns the user record (without password).' })
  @ApiResponse({ status: 401, description: 'Invalid email or current password.' })
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(dto.email, dto.current_password, dto.new_password);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk Create Users',
    description:
      "Creates up to 500 accounts in the caller's organisation with generated one-time passwords and returns the credentials per row. Only the Organization Admin can do this.",
  })
  @ApiResponse({ status: 201, description: 'Per-row results with the issued credentials.' })
  @ApiResponse({ status: 403, description: 'Forbidden – caller role is not Organization Admin.' })
  @Roles('Organization Admin')
  bulkCreate(@Body() dto: BulkCreateUsersDto) {
    return this.usersService.bulkCreate(dto.users);
  }

  @Post('generate-password')
  @ApiOperation({ summary: 'Generate Password', description: 'Returns a random one-time password that satisfies the password rule, for an administrator to issue.' })
  @Roles('Organization Admin', 'Super Admin')
  generatePassword() {
    return { password: this.usersService.generatePassword() };
  }

  @Post()
  @ApiOperation({ summary: "Create User", description: "Creates a new user account in the system. Only the Organization Admin can register new users by providing name, email, password, role, and optional phone/specialization fields. Send a POST request with a CreateUserDto JSON body containing all required user fields." })
  @ApiResponse({ status: 201, description: "User created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Organization Admin." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin")
  create(@Body() createDto: CreateUserDto) {
    return this.usersService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "List All Users", description: "Retrieves a list of all registered user accounts. Internal staff can view the complete user directory to resolve names for assignments." })
  @ApiResponse({ status: 200, description: "Array of all user records returned." })
  @ApiResponse({ status: 403, description: "Forbidden – caller lacks required role." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician Administrator | Technician | Sustainability Officer", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Technician Administrator", "Technician", "Sustainability Officer")
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get User by ID", description: "Retrieves a single user account by its UUID. Internal staff can look up individual user profiles. Pass the user_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "User record returned." })
  @ApiResponse({ status: 404, description: "User with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller lacks required role." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician Administrator | Technician | Sustainability Officer", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Technician Administrator", "Technician", "Sustainability Officer")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace User", description: "Completely replaces an existing user record with new data. Only the Organization Admin can perform full user replacements. Send a PUT request with the user_id in the URL and a complete PutUserDto JSON body containing all fields." })
  @ApiResponse({ status: 200, description: "User record replaced successfully." })
  @ApiResponse({ status: 404, description: "User with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Organization Admin." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin")
  put(@Param("id") id: string, @Body() putDto: PutUserDto) {
    return this.usersService.put(id, putDto);
  }
  @Patch(":id")
  @ApiOperation({ summary: "Update User", description: "Partially updates specific fields of an existing user record (e.g., role, specialization, contact info). Only the Organization Admin can modify user details. Send a PATCH request with the user_id in the URL and an UpdateUserDto JSON body containing only the fields to change." })
  @ApiResponse({ status: 200, description: "User record updated successfully." })
  @ApiResponse({ status: 404, description: "User with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Organization Admin." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin")
  update(@Param("id") id: string, @Body() updateDto: UpdateUserDto) {
    return this.usersService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete User", description: "Permanently removes a user account from the system. Only the Organization Admin can delete user records. Pass the user_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "User record deleted successfully." })
  @ApiResponse({ status: 404, description: "User with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden – caller role is not Organization Admin." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin")
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }

  @Get(":id/notifications")
  @ApiOperation({ summary: "Get User Notifications", description: "Retrieves all notifications belonging to a specific user. Any authenticated user can fetch notifications to view alerts, wastage report updates, and service request status changes. Pass the user_id as a URL path parameter." })
  @ApiResponse({ status: 200, description: "Array of notification records for the user returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC. Enum: Organization Admin | Financial Analyst | Technician | Sustainability Officer | Campus Visitor", required: false })
  @Roles("Organization Admin", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  getNotifications(@Param("id") id: string) {
    return this.usersService.getNotifications(id);
  }
}
