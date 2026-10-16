import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
} from "@nestjs/swagger";
import { Controller, Get, Post, Patch, Body, Param, Query, Headers } from "@nestjs/common";
import { AuditRequestsService } from "./audit-requests.service";
import { RegisterOrganizationDto } from "../organizations/dto/register-organization.dto";
import { DecideAuditRequestDto } from "./dto/decide-audit-request.dto";
import { Roles } from "../../core/decorators/roles.decorator";

const ROLE_HEADER = {
  name: "x-role",
  description: "Caller role for RBAC. Super Admin only",
  required: false,
};

@ApiTags("audit-requests")
@Controller("audit-requests")
export class AuditRequestsController {
  constructor(private readonly auditRequestsService: AuditRequestsService) {}

  /**
   * Public on purpose: it carries no @Roles, so RolesGuard lets it through
   * unauthenticated, because the person asking has no account yet. It only
   * records a request. Nothing real is created until a Super Admin approves it.
   */
  @Post()
  @ApiOperation({
    summary: "Register an organisation (public)",
    description:
      "An organisation asking to be taken on. Records a pending request and creates nothing else: no organisation, no account, no session. A Super Admin approves or rejects it, and only approval creates the organisation and its administrator. Refused if the organisation name, the email or the mail domain is already taken, by a real record or by another pending request.",
  })
  @ApiResponse({ status: 201, description: "Request recorded and awaiting approval." })
  @ApiResponse({ status: 409, description: "Name, email or domain already taken or already awaiting approval." })
  submit(@Body() dto: RegisterOrganizationDto) {
    return this.auditRequestsService.submit(dto);
  }

  @Get()
  @ApiOperation({
    summary: "List audit requests",
    description:
      "Every request, newest first. Filter with ?status=pending|approved|denied. The requester's password is never included.",
  })
  @ApiQuery({ name: "status", required: false, enum: ["pending", "approved", "denied"] })
  @ApiResponse({ status: 200, description: "Array of audit requests." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  findAll(@Query("status") status?: string) {
    return this.auditRequestsService.findAll(status);
  }

  @Patch(":id/approve")
  @ApiOperation({
    summary: "Approve an audit request",
    description:
      "Creates the organisation (as a prospect) and its first user as Organization Admin, using the details and password from the request, and marks the request approved. From then on the person can sign in.",
  })
  @ApiResponse({ status: 200, description: "Organisation and administrator created." })
  @ApiResponse({ status: 404, description: "Request not found." })
  @ApiResponse({ status: 409, description: "Already decided, or the name, email or domain was taken in the meantime." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  approve(
    @Param("id") id: string,
    @Body() dto: DecideAuditRequestDto,
    @Headers("x-user-id") callerId?: string,
  ) {
    // Who decided is the signed-in caller (set by AuthMiddleware from the
    // token), never a decided_by the client sends.
    return this.auditRequestsService.approve(id, { ...dto, decided_by: callerId });
  }

  @Patch(":id/deny")
  @ApiOperation({
    summary: "Deny an audit request",
    description:
      "Marks the request denied and creates nothing. The optional note is what the person sees if they try to sign in.",
  })
  @ApiResponse({ status: 200, description: "Request denied." })
  @ApiResponse({ status: 404, description: "Request not found." })
  @ApiResponse({ status: 409, description: "Already decided." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  deny(
    @Param("id") id: string,
    @Body() dto: DecideAuditRequestDto,
    @Headers("x-user-id") callerId?: string,
  ) {
    // Who decided is the signed-in caller (set by AuthMiddleware from the
    // token), never a decided_by the client sends.
    return this.auditRequestsService.deny(id, { ...dto, decided_by: callerId });
  }
}
