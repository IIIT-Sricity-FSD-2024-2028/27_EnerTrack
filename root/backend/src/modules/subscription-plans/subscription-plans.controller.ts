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
import { SubscriptionPlansService } from "./subscription-plans.service";
import { CreateSubscriptionPlanDto } from "./dto/create-subscription-plan.dto";
import { PutSubscriptionPlanDto } from "./dto/put-subscription-plan.dto";
import { UpdateSubscriptionPlanDto } from "./dto/update-subscription-plan.dto";
import { Roles } from "../../core/decorators/roles.decorator";

const ROLE_HEADER = {
  name: "x-role",
  description: "Caller role for RBAC. Super Admin for any write.",
  required: false,
};

@ApiTags("subscription-plans")
@Controller("subscription-plans")
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  @Post()
  @ApiOperation({
    summary: "Create Subscription Plan",
    description:
      "Adds a price tier to EnerTrack's catalogue. Adding a tier is a data change, not a code change: the billing engine reads every pricing knob off this row.",
  })
  @ApiResponse({ status: 201, description: "Plan created successfully." })
  @ApiResponse({ status: 409, description: "A plan with that name already exists." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  create(@Body() createDto: CreateSubscriptionPlanDto) {
    return this.plansService.create(createDto);
  }

  /**
   * Declared BEFORE @Get(":id"). Nest matches in declaration order, so if
   * this sat lower "/subscription-plans/public" would be swallowed by the
   * :id route and arrive as findOne("public").
   */
  @Get("public")
  @ApiOperation({
    summary: "Public Pricing Catalogue",
    description:
      "Active tiers with their fee, seat allowance, extra-seat price, campus limit and features, for the landing page pricing section. No authorization required — the landing page and the billing engine read the same catalogue, so the published price cannot drift from the charged one.",
  })
  @ApiResponse({ status: 200, description: "Array of public plan summaries." })
  listPublic() {
    return this.plansService.listPublic();
  }

  @Get()
  @ApiOperation({
    summary: "List All Subscription Plans",
    description:
      "The full catalogue including inactive tiers and every pricing knob. Not tenant-scoped: the catalogue is global, so a client sees the same list EnerTrack staff do.",
  })
  @ApiResponse({ status: 200, description: "Array of all plan records." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles(
    "Super Admin",
    "Certified Energy Auditor",
    "Organization Admin",
    "Financial Analyst",
    "Economic Buyer",
  )
  findAll() {
    return this.plansService.findAll();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get Subscription Plan by ID",
    description: "Retrieves a single price tier by its plan_id.",
  })
  @ApiResponse({ status: 200, description: "Plan record returned." })
  @ApiResponse({ status: 404, description: "Plan with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles(
    "Super Admin",
    "Certified Energy Auditor",
    "Organization Admin",
    "Financial Analyst",
    "Economic Buyer",
  )
  findOne(@Param("id") id: string) {
    return this.plansService.findOne(id);
  }

  @Get(":id/subscribers")
  @ApiOperation({
    summary: "Get Plan Subscribers",
    description:
      "Organisations currently contracted on this tier. Used by the Super Admin revenue console to show plan distribution.",
  })
  @ApiResponse({ status: 200, description: "Array of subscriber summaries." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  getSubscribers(@Param("id") id: string) {
    return this.plansService.getSubscribers(id);
  }

  @Put(":id")
  @ApiOperation({
    summary: "Replace Subscription Plan",
    description: "Completely replaces a price tier. Send a full body.",
  })
  @ApiResponse({ status: 200, description: "Plan replaced successfully." })
  @ApiResponse({ status: 404, description: "Plan with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  put(@Param("id") id: string, @Body() putDto: PutSubscriptionPlanDto) {
    return this.plansService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update Subscription Plan",
    description:
      "Partially updates a tier — a price change, or retiring it with is_active: false. Takes effect on the next invoice generated, with no redeploy.",
  })
  @ApiResponse({ status: 200, description: "Plan updated successfully." })
  @ApiResponse({ status: 404, description: "Plan with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  update(@Param("id") id: string, @Body() updateDto: UpdateSubscriptionPlanDto) {
    return this.plansService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete Subscription Plan",
    description:
      "Permanently removes a tier. Refused while any subscription still references it, since the billing engine would then fail to resolve a plan_id.",
  })
  @ApiResponse({ status: 200, description: "Plan deleted successfully." })
  @ApiResponse({ status: 404, description: "Plan with the given ID not found." })
  @ApiResponse({ status: 409, description: "Plan is still in use by a subscription." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  remove(@Param("id") id: string) {
    return this.plansService.remove(id);
  }
}
