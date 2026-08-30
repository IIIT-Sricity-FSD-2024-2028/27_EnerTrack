import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
} from "@nestjs/swagger";
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
} from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { PutOrganizationDto } from "./dto/put-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { Roles } from "../../core/decorators/roles.decorator";

const ROLE_HEADER = {
  name: "x-role",
  description:
    "Caller role for RBAC. Super Admin | Certified Energy Auditor | Organization Admin",
  required: false,
};

@ApiTags("organizations")
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({
    summary: "Create Organization",
    description:
      "Registers a new client organisation (tenant). Used when a prospect is onboarded. Only EnerTrack platform staff can create organisations.",
  })
  @ApiResponse({ status: 201, description: "Organization created successfully." })
  @ApiResponse({ status: 409, description: "An organization with that name already exists." })
  @ApiResponse({ status: 403, description: "Forbidden – caller is not EnerTrack platform staff." })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  create(@Body() createDto: CreateOrganizationDto) {
    return this.organizationsService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: "List All Organizations",
    description:
      "Retrieves every client organisation with its status, data source tier and contract details. This is the platform-wide tenant list, so it is restricted to EnerTrack staff.",
  })
  @ApiResponse({ status: 200, description: "Array of all organization records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin", "Organization Admin", "Certified Energy Auditor")
  findAll() {
    return this.organizationsService.findAll();
  }

  /**
   * Public tenant directory for the sign-up page.
   *
   * Declared BEFORE @Get(":id") on purpose. Nest matches routes in the order
   * they are declared, so if this sat lower, "/organizations/public" would be
   * swallowed by the :id route and arrive as findOne("public").
   *
   * Carries no @Roles, so RolesGuard lets it through unauthenticated, which it
   * has to be: the visitor has no account yet. It therefore returns id and
   * name only. Status, tariff rate, floor area and contract dates stay behind
   * the authenticated findAll().
   */
  @Get("public")
  @ApiOperation({
    summary: "Public Organization Directory",
    description:
      "Returns id and name only, for populating the organisation selector on the public sign-up page. No authorization headers required.",
  })
  @ApiResponse({ status: 200, description: "Array of { organization_id, name }." })
  listPublic() {
    return this.organizationsService.listPublic();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get Organization by ID",
    description:
      "Retrieves a single client organisation by its id. Pass the organization_id as a URL path parameter.",
  })
  @ApiResponse({ status: 200, description: "Organization record returned." })
  @ApiResponse({ status: 404, description: "Organization with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin", "Organization Admin", "Certified Energy Auditor")
  findOne(@Param("id") id: string) {
    return this.organizationsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({
    summary: "Replace Organization",
    description:
      "Completely replaces an existing organisation record. Send the organization_id in the URL and a complete PutOrganizationDto body.",
  })
  @ApiResponse({ status: 200, description: "Organization replaced successfully." })
  @ApiResponse({ status: 404, description: "Organization with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  put(@Param("id") id: string, @Body() putDto: PutOrganizationDto) {
    return this.organizationsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update Organization",
    description:
      "Partially updates an organisation, for example moving its status from prospect to active once a contract is signed.",
  })
  @ApiResponse({ status: 200, description: "Organization updated successfully." })
  @ApiResponse({ status: 404, description: "Organization with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  update(@Param("id") id: string, @Body() updateDto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete Organization",
    description:
      "Permanently removes an organisation. Refused while the organisation still owns campus records, to avoid orphaning tenant data.",
  })
  @ApiResponse({ status: 200, description: "Organization deleted successfully." })
  @ApiResponse({ status: 404, description: "Organization with the given ID not found." })
  @ApiResponse({ status: 409, description: "Organization still owns campus records." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  remove(@Param("id") id: string) {
    return this.organizationsService.remove(id);
  }

  @Get(":id/campuses")
  @ApiOperation({
    summary: "Get Organization Campuses",
    description:
      "Retrieves every campus owned by one organisation. Campus is the tenancy seam, so Buildings, Departments and Meters hang below these records.",
  })
  @ApiResponse({ status: 200, description: "Array of campus records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin", "Organization Admin", "Certified Energy Auditor")
  getCampuses(@Param("id") id: string) {
    return this.organizationsService.getCampuses(id);
  }

  @Get(":id/savings")
  @ApiOperation({
    summary: "Get Organization Savings",
    description:
      "Compares electricity consumption against the same calendar month a year earlier, and reports the difference in kWh, rupees and kg CO2. Comparing like months cancels seasonality without needing a weather model. This figure is reported, never billed — EnerTrack charges a subscription, not a share of savings.",
  })
  @ApiQuery({ name: "period", required: false, description: "Single month, YYYY-MM" })
  @ApiQuery({ name: "from", required: false, description: "Range start, YYYY-MM" })
  @ApiQuery({ name: "to", required: false, description: "Range end, YYYY-MM" })
  @ApiResponse({ status: 200, description: "Savings comparison returned." })
  @ApiResponse({ status: 400, description: "Supply period, or from and to." })
  @ApiResponse({ status: 404, description: "Organization with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles(
    "Super Admin",
    "Certified Energy Auditor",
    "Organization Admin",
    "Financial Analyst",
    "Economic Buyer",
    "Sustainability Officer",
    "Facility Manager",
  )
  getSavings(
    @Param("id") id: string,
    @Query("period") period?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.organizationsService.savings(id, { period, from, to });
  }

  @Get(":id/users")
  @ApiOperation({
    summary: "Get Organization Users",
    description:
      "Retrieves the client-side user accounts belonging to one organisation. EnerTrack staff accounts are not included, as they belong to no tenant.",
  })
  @ApiResponse({ status: 200, description: "Array of user records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin", "Organization Admin")
  getUsers(@Param("id") id: string) {
    return this.organizationsService.getUsers(id);
  }
}
