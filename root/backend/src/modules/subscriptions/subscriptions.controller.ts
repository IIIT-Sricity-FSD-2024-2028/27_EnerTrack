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
import { SubscriptionsService } from "./subscriptions.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { PutSubscriptionDto } from "./dto/put-subscription.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";
import { Roles } from "../../core/decorators/roles.decorator";

const ROLE_HEADER = {
  name: "x-role",
  description:
    "Caller role for RBAC. Super Admin | Account Officer for writes; a client's own roles may read.",
  required: false,
};

const ORG_HEADER = {
  name: "x-org-id",
  description:
    "Organisation the caller is acting within. Omitted by EnerTrack staff, who get the cross-tenant view.",
  required: false,
};

/** Everyone allowed to read a contract: platform staff plus the client's own. */
const READERS = [
  "Super Admin",
  "Account Officer",
  "Certified Energy Auditor",
  "System Administrator",
  "Financial Analyst",
  "Economic Buyer",
] as const;

@ApiTags("subscriptions")
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @ApiOperation({
    summary: "Create Subscription",
    description:
      "Opens a contract between EnerTrack and a client organisation. Refused if that organisation already has a live one.",
  })
  @ApiResponse({ status: 201, description: "Subscription created successfully." })
  @ApiResponse({ status: 404, description: "Organization or plan not found." })
  @ApiResponse({ status: 409, description: "Organization already has a live subscription." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles("Super Admin", "Account Officer")
  create(@Body() createDto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: "List Subscriptions",
    description:
      "Tenant-scoped by the backend: EnerTrack staff get every client's contract, a client gets only its own.",
  })
  @ApiResponse({ status: 200, description: "Array of subscription records." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  findAll() {
    return this.subscriptionsService.findAll();
  }

  /** Declared before @Get(":id") so the literal segment is not eaten by it. */
  @Get("by-organization/:orgId")
  @ApiOperation({
    summary: "Get Subscription by Organization",
    description:
      "The organisation's live (non-cancelled) contract with its plan inlined. This is what the client-side billing page loads first.",
  })
  @ApiResponse({ status: 200, description: "Subscription with plan returned." })
  @ApiResponse({ status: 404, description: "No active subscription for that organization." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  findByOrganization(@Param("orgId") orgId: string) {
    return this.subscriptionsService.findByOrganization(orgId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get Subscription by ID",
    description: "Retrieves a single contract by its subscription_id.",
  })
  @ApiResponse({ status: 200, description: "Subscription record returned." })
  @ApiResponse({ status: 404, description: "Subscription with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  findOne(@Param("id") id: string) {
    return this.subscriptionsService.findOne(id);
  }

  @Get(":id/invoices")
  @ApiOperation({
    summary: "Get Subscription Invoices",
    description:
      "Platform invoices raised against this contract, newest period first. These are EnerTrack's bills to the client, not the client's utility bills.",
  })
  @ApiResponse({ status: 200, description: "Array of platform invoice records." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  getInvoices(@Param("id") id: string) {
    return this.subscriptionsService.getInvoices(id);
  }

  @Put(":id")
  @ApiOperation({
    summary: "Replace Subscription",
    description: "Completely replaces a contract. Send a full body.",
  })
  @ApiResponse({ status: 200, description: "Subscription replaced successfully." })
  @ApiResponse({ status: 404, description: "Subscription with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  put(@Param("id") id: string, @Body() putDto: PutSubscriptionDto) {
    return this.subscriptionsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update Subscription",
    description:
      "Partially updates a contract, for example moving it from trial to active. organization_id cannot be changed.",
  })
  @ApiResponse({ status: 200, description: "Subscription updated successfully." })
  @ApiResponse({ status: 404, description: "Subscription with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin", "Account Officer")
  update(@Param("id") id: string, @Body() updateDto: UpdateSubscriptionDto) {
    return this.subscriptionsService.update(id, updateDto);
  }

  @Patch(":id/change-plan")
  @ApiOperation({
    summary: "Change Subscription Plan",
    description:
      "Moves a contract onto a different tier. Takes effect on the next invoice generated; invoices already raised are not restated.",
  })
  @ApiResponse({ status: 200, description: "Plan changed successfully." })
  @ApiResponse({ status: 404, description: "Subscription or plan not found." })
  @ApiResponse({ status: 409, description: "Target plan is retired." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin", "Account Officer")
  changePlan(@Param("id") id: string, @Body() body: { plan_id: string }) {
    return this.subscriptionsService.changePlan(id, body.plan_id);
  }

  @Patch(":id/renew")
  @ApiOperation({
    summary: "Renew Subscription",
    description:
      "Extends the term. Defaults to one year past the current renewal date and clears a past-due status.",
  })
  @ApiResponse({ status: 200, description: "Subscription renewed successfully." })
  @ApiResponse({ status: 404, description: "Subscription with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin", "Account Officer")
  renew(@Param("id") id: string, @Body() body: { renews_on?: string }) {
    return this.subscriptionsService.renew(id, body?.renews_on);
  }

  @Patch(":id/cancel")
  @ApiOperation({
    summary: "Cancel Subscription",
    description:
      "Marks a contract cancelled. Kept rather than deleted, so its invoice history stays intact and reportable.",
  })
  @ApiResponse({ status: 200, description: "Subscription cancelled successfully." })
  @ApiResponse({ status: 404, description: "Subscription with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin", "Account Officer")
  cancel(@Param("id") id: string, @Body() body: { cancelled_on?: string }) {
    return this.subscriptionsService.cancel(id, body?.cancelled_on);
  }

  @Patch(":id/waive-audit-fee")
  @ApiOperation({
    summary: "Waive Audit Fee",
    description:
      "Waives the one-time site audit fee on signature, which suppresses that line from the contract's first invoice.",
  })
  @ApiResponse({ status: 200, description: "Audit fee waived." })
  @ApiResponse({ status: 404, description: "Subscription with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin", "Account Officer")
  waiveAuditFee(@Param("id") id: string, @Body() body: { waived_on?: string }) {
    return this.subscriptionsService.waiveAuditFee(id, body?.waived_on);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete Subscription",
    description:
      "Permanently removes a contract. Refused once any platform invoice references it — cancel it instead.",
  })
  @ApiResponse({ status: 200, description: "Subscription deleted successfully." })
  @ApiResponse({ status: 404, description: "Subscription with the given ID not found." })
  @ApiResponse({ status: 409, description: "Invoices still reference this subscription." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  remove(@Param("id") id: string) {
    return this.subscriptionsService.remove(id);
  }
}
