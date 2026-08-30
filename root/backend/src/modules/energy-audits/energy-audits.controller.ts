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
import { EnergyAuditsService } from "./energy-audits.service";
import { CreateEnergyAuditDto } from "./dto/create-energy-audit.dto";
import { PutEnergyAuditDto } from "./dto/put-energy-audit.dto";
import { UpdateEnergyAuditDto } from "./dto/update-energy-audit.dto";
import {
  CreateFindingDto,
  RespondToProposalDto,
  SendProposalDto,
  UpdateFindingDto,
  UpdateSurveyDto,
} from "./dto/audit-sub-resource.dto";
import { Roles } from "../../core/decorators/roles.decorator";

const ROLE_HEADER = {
  name: "x-role",
  description:
    "Caller role for RBAC. Certified Energy Auditor | Super Admin write; the audited client reads.",
  required: false,
};

const ORG_HEADER = {
  name: "x-org-id",
  description:
    "Organisation the caller is acting within. Omitted by EnerTrack staff, who get the cross-tenant view.",
  required: false,
};

/** Platform staff plus the audited client's own roles. */
const READERS = [
  "Super Admin",
  "Certified Energy Auditor",
  "Organization Admin",
  "Financial Analyst",
  "Economic Buyer",
  "Facility Manager",
  "Technician Administrator",
  "Sustainability Officer",
] as const;

/**
 * A certified auditor's site visits and the recommendations they produce.
 *
 * Nothing in this controller feeds an invoice. An audit is a service
 * included in the subscription, not something charged for.
 */
/** Client-side roles that may answer a proposal about their own organisation. */
const CLIENT_SIGNATORIES = [
  'Organization Admin',
  'Economic Buyer',
  'Financial Analyst',
] as const;

@ApiTags("energy-audits")
@Controller("energy-audits")
export class EnergyAuditsController {
  constructor(private readonly auditsService: EnergyAuditsService) {}

  @Post()
  @ApiOperation({
    summary: "Create Energy Audit",
    description:
      "Schedules a certified audit against a client organisation. The auditor then records a site survey and a list of recommendations.",
  })
  @ApiResponse({ status: 201, description: "Audit created successfully." })
  @ApiResponse({ status: 404, description: "Organization or auditor not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  create(@Body() createDto: CreateEnergyAuditDto) {
    return this.auditsService.create(createDto);
  }

  /** Declared before @Get(":id") so the literal path is not read as an id. */
  @Get("findings")
  @ApiOperation({
    summary: "List Recommendations",
    description:
      "Every recommendation across every audit the caller can see, flattened with its organisation. Filter with ?status=accepted to get the measures a client has agreed to but not yet carried out.",
  })
  @ApiQuery({ name: "status", required: false, description: "proposed | accepted | implemented | rejected" })
  @ApiResponse({ status: 200, description: "Array of findings." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  listFindings(@Query("status") status?: string) {
    return this.auditsService.listFindings(status);
  }

  @Get()
  @ApiOperation({
    summary: "List Energy Audits",
    description:
      "Tenant-scoped: EnerTrack staff see every engagement, a client sees only its own.",
  })
  @ApiResponse({ status: 200, description: "Array of audit records." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  findAll() {
    return this.auditsService.findAll();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get Energy Audit by ID",
    description: "One audit with its site survey and recommendations.",
  })
  @ApiResponse({ status: 200, description: "Audit record returned." })
  @ApiResponse({ status: 404, description: "Audit with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  findOne(@Param("id") id: string) {
    return this.auditsService.findOne(id);
  }

  @Patch(":id/survey")
  @ApiOperation({
    summary: "Update Site Survey",
    description:
      "Records what the auditor found on site: buildings walked, meters located, existing metering tier and floor area.",
  })
  @ApiResponse({ status: 200, description: "Survey updated." })
  @ApiResponse({ status: 404, description: "Audit not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  updateSurvey(@Param("id") id: string, @Body() dto: UpdateSurveyDto) {
    return this.auditsService.updateSurvey(id, dto);
  }

  @Post(":id/findings")
  @ApiOperation({
    summary: "Add Recommendation",
    description:
      "Records a recommended measure with its estimated annual saving, capex and the buildings it affects. Payback is derived from capex and saving when not supplied.",
  })
  @ApiResponse({ status: 201, description: "Recommendation added." })
  @ApiResponse({ status: 400, description: "Building belongs to another organisation." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  addFinding(@Param("id") id: string, @Body() dto: CreateFindingDto) {
    return this.auditsService.addFinding(id, dto);
  }

  @Patch(":id/findings/:findingId")
  @ApiOperation({
    summary: "Update Recommendation",
    description:
      "Moves a measure along proposed → accepted → implemented. The client's own facilities roles may mark work done, since they are the ones who carry it out.",
  })
  @ApiResponse({ status: 200, description: "Recommendation updated." })
  @ApiResponse({ status: 404, description: "Audit or finding not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles(
    "Certified Energy Auditor",
    "Super Admin",
    "Facility Manager",
    "Technician Administrator",
    "Sustainability Officer",
  )
  updateFinding(
    @Param("id") id: string,
    @Param("findingId") findingId: string,
    @Body() dto: UpdateFindingDto,
  ) {
    return this.auditsService.updateFinding(id, findingId, dto);
  }

  @Delete(":id/findings/:findingId")
  @ApiOperation({
    summary: "Delete Recommendation",
    description: "Removes a recommendation from an audit.",
  })
  @ApiResponse({ status: 200, description: "Recommendation deleted." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  removeFinding(@Param("id") id: string, @Param("findingId") findingId: string) {
    return this.auditsService.removeFinding(id, findingId);
  }


  /* ── Proposal ──────────────────────────────────────────────────── */

  @Post(':id/proposal')
  @ApiOperation({
    summary: 'Send Proposal',
    description:
      "Sends the client one document carrying what they need and what it costs. The monthly figure is computed by the pricing engine from the tier and the surveyed headcount, never typed, so the quote is always a number the billing engine would really produce. Addressed to the organisation's Organization Admin, who is its first account and its owner. Moves the audit to proposed and the organisation from prospect to audited.",
  })
  @ApiResponse({ status: 201, description: 'Proposal sent; the client has been notified.' })
  @ApiResponse({ status: 404, description: 'Audit or plan not found.' })
  @ApiResponse({
    status: 409,
    description:
      'Already accepted, tier too small for the estate, or the organisation has no Organization Admin to send to.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader(ROLE_HEADER)
  @Roles('Certified Energy Auditor', 'Super Admin')
  sendProposal(@Param('id') id: string, @Body() dto: SendProposalDto) {
    return this.auditsService.sendProposal(id, dto);
  }

  @Patch(':id/proposal/accept')
  @ApiOperation({
    summary: 'Accept Proposal (client)',
    description:
      'The client agrees. This creates their subscription, moves the organisation to active, and notifies the auditor. It is the only path to a live contract other than a Super Admin creating one by hand, which is the point: a tier now comes from an audit somebody signed.',
  })
  @ApiResponse({ status: 200, description: 'Accepted; subscription created.' })
  @ApiResponse({ status: 409, description: 'No open proposal, or a live subscription already exists.' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...CLIENT_SIGNATORIES)
  acceptProposal(@Param('id') id: string, @Body() body: { accepted_by: string }) {
    return this.auditsService.acceptProposal(id, body?.accepted_by);
  }

  @Patch(':id/proposal/request-changes')
  @ApiOperation({
    summary: 'Request Changes (client)',
    description:
      'The client pushes back with a concern or a suggestion. The proposal stays on the audit with their note attached so the auditor revises it rather than starting again, and the auditor is notified.',
  })
  @ApiResponse({ status: 200, description: 'Changes requested; the auditor has been notified.' })
  @ApiResponse({ status: 409, description: 'No open proposal to respond to.' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...CLIENT_SIGNATORIES)
  requestChanges(
    @Param('id') id: string,
    @Body() dto: RespondToProposalDto & { responded_by?: string },
  ) {
    return this.auditsService.requestChanges(id, dto, dto?.responded_by ?? '');
  }

  @Patch(':id/proposal/decline')
  @ApiOperation({
    summary: 'Decline Proposal (client)',
    description:
      'The client says no. Kept as a state rather than deleted so the Super Admin revenue console can report conversion honestly.',
  })
  @ApiResponse({ status: 200, description: 'Declined; the auditor has been notified.' })
  @ApiResponse({ status: 409, description: 'No open proposal to respond to.' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...CLIENT_SIGNATORIES)
  declineProposal(
    @Param('id') id: string,
    @Body() dto: RespondToProposalDto & { responded_by?: string },
  ) {
    return this.auditsService.declineProposal(id, dto, dto?.responded_by ?? '');
  }

  @Put(':id')
  @ApiOperation({
    summary: "Replace Energy Audit",
    description: "Completely replaces an audit record. Send a full body.",
  })
  @ApiResponse({ status: 200, description: "Audit replaced successfully." })
  @ApiResponse({ status: 404, description: "Audit not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  put(@Param("id") id: string, @Body() putDto: PutEnergyAuditDto) {
    return this.auditsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update Energy Audit",
    description:
      "Partially updates an audit, for example moving it from scheduled to in-progress or completed.",
  })
  @ApiResponse({ status: 200, description: "Audit updated successfully." })
  @ApiResponse({ status: 404, description: "Audit not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  update(@Param("id") id: string, @Body() updateDto: UpdateEnergyAuditDto) {
    return this.auditsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete Energy Audit",
    description:
      "Permanently removes an audit. Refused once any of its recommendations have been implemented, since that is a record of work actually done.",
  })
  @ApiResponse({ status: 200, description: "Audit deleted successfully." })
  @ApiResponse({ status: 409, description: "Audit holds implemented recommendations." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  remove(@Param("id") id: string) {
    return this.auditsService.remove(id);
  }
}
