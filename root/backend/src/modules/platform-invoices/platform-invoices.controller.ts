import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from "@nestjs/swagger";
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
import { PlatformInvoicesService } from "./platform-invoices.service";
import {
  CreatePlatformInvoiceDto,
  GenerateInvoiceDto,
} from "./dto/create-platform-invoice.dto";
import { PutPlatformInvoiceDto } from "./dto/put-platform-invoice.dto";
import { UpdatePlatformInvoiceDto } from "./dto/update-platform-invoice.dto";
import { Roles } from "../../core/decorators/roles.decorator";

const ROLE_HEADER = {
  name: "x-role",
  description:
    "Caller role for RBAC. Super Admin for writes; a client's own roles may read their invoices.",
  required: false,
};

const ORG_HEADER = {
  name: "x-org-id",
  description:
    "Organisation the caller is acting within. Omitted by EnerTrack staff, who get the cross-tenant view.",
  required: false,
};

const READERS = [
  "Super Admin",
  "Organization Admin",
  "Financial Analyst",
  "Economic Buyer",
] as const;

/**
 * EnerTrack's bills to its clients.
 *
 * Not to be confused with /api/invoices, which is the client's own
 * electricity bill from their utility supplier. Two money flows in
 * opposite directions.
 */
@ApiTags("platform-invoices")
@Controller("platform-invoices")
export class PlatformInvoicesController {
  constructor(private readonly invoicesService: PlatformInvoicesService) {}

  @Post("generate")
  @ApiOperation({
    summary: "Generate Platform Invoice",
    description:
      "Runs the pricing engine for one organisation and one period, and saves the result as a draft. Nothing is typed by hand: the tier fee comes from the plan and the seat overage from a live staff headcount. Change a tier's price and regenerate — the total moves with no code change.",
  })
  @ApiResponse({ status: 201, description: "Draft invoice generated." })
  @ApiResponse({ status: 404, description: "Organization, subscription or plan not found." })
  @ApiResponse({ status: 409, description: "An invoice for that period already exists." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  generate(@Body() dto: GenerateInvoiceDto) {
    return this.invoicesService.generate(dto);
  }

  @Get("preview")
  @ApiOperation({
    summary: "Preview Platform Invoice",
    description:
      "Computes a period's invoice without saving it, and reports the position behind it: billable staff, included seats, seats over allowance, and campuses used against the tier limit. Declared before :id so the literal path is not read as an invoice id.",
  })
  @ApiQuery({ name: "organization_id", required: true })
  @ApiQuery({ name: "period", required: true, description: "YYYY-MM" })
  @ApiResponse({ status: 200, description: "Computed invoice preview." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  preview(
    @Query("organization_id") organizationId: string,
    @Query("period") period: string,
  ) {
    return this.invoicesService.preview(organizationId, period);
  }

  @Get("revenue-summary")
  @ApiOperation({
    summary: "Platform Revenue Summary",
    description:
      "MRR, ARR, collection status, and a breakdown by organisation and by tier. Aggregates across every tenant, so it is restricted to EnerTrack staff. Seat utilisation per client is the upgrade signal: an organisation at or over its allowance is the next conversation.",
  })
  @ApiResponse({ status: 200, description: "Revenue summary returned." })
  @ApiResponse({ status: 403, description: "Forbidden – caller is not EnerTrack platform staff." })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  revenueSummary() {
    return this.invoicesService.revenueSummary();
  }

  @Post()
  @ApiOperation({
    summary: "Create Platform Invoice",
    description:
      "Records an invoice with line items supplied by the caller. Prefer POST /generate, which derives every figure from platform state instead.",
  })
  @ApiResponse({ status: 201, description: "Invoice created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  create(@Body() createDto: CreatePlatformInvoiceDto) {
    return this.invoicesService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: "List Platform Invoices",
    description:
      "Tenant-scoped, newest period first. EnerTrack staff see every client's bills; a client sees only its own.",
  })
  @ApiResponse({ status: 200, description: "Array of platform invoice records." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get Platform Invoice by ID",
    description:
      "One invoice with its line items. Every line carries a source_ref naming the subscription it was derived from, so any figure can be traced back.",
  })
  @ApiResponse({ status: 200, description: "Invoice record returned." })
  @ApiResponse({ status: 404, description: "Invoice with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  findOne(@Param("id") id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(":id/issue")
  @ApiOperation({
    summary: "Issue Platform Invoice",
    description:
      "Moves a draft to issued and sets the due date 30 days out. Issuing is a deliberate act, separate from generating, so a draft can be reviewed first.",
  })
  @ApiResponse({ status: 200, description: "Invoice issued." })
  @ApiResponse({ status: 409, description: "Invoice is not a draft." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  issue(@Param("id") id: string, @Body() body: { issued_on?: string }) {
    return this.invoicesService.issue(id, body?.issued_on);
  }

  @Patch(":id/mark-paid")
  @ApiOperation({
    summary: "Mark Platform Invoice Paid",
    description: "Records payment against an issued or overdue invoice.",
  })
  @ApiResponse({ status: 200, description: "Invoice marked paid." })
  @ApiResponse({ status: 409, description: "Invoice is still a draft, or already paid." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  markPaid(@Param("id") id: string, @Body() body: { paid_on?: string }) {
    return this.invoicesService.markPaid(id, body?.paid_on);
  }

  @Put(":id")
  @ApiOperation({
    summary: "Replace Platform Invoice",
    description: "Completely replaces an invoice record. Send a full body.",
  })
  @ApiResponse({ status: 200, description: "Invoice replaced successfully." })
  @ApiResponse({ status: 404, description: "Invoice with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  put(@Param("id") id: string, @Body() putDto: PutPlatformInvoiceDto) {
    return this.invoicesService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update Platform Invoice",
    description: "Partially updates an invoice, for example flagging it overdue.",
  })
  @ApiResponse({ status: 200, description: "Invoice updated successfully." })
  @ApiResponse({ status: 404, description: "Invoice with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  update(@Param("id") id: string, @Body() updateDto: UpdatePlatformInvoiceDto) {
    return this.invoicesService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete Platform Invoice",
    description:
      "Permanently removes an invoice. Refused once it has been paid — raise a credit note instead of erasing settled billing history.",
  })
  @ApiResponse({ status: 200, description: "Invoice deleted successfully." })
  @ApiResponse({ status: 409, description: "Invoice has been paid." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  remove(@Param("id") id: string) {
    return this.invoicesService.remove(id);
  }
}
