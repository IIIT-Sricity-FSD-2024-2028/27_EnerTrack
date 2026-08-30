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
  CreateVerificationDto,
  DisputeVerificationDto,
  LockBaselineDto,
  UpdateFindingDto,
  UpdateSurveyDto,
} from "./dto/audit-sub-resource.dto";
import { Roles } from "../../core/decorators/roles.decorator";

const ROLE_HEADER = {
  name: "x-role",
  description:
    "Caller role for RBAC. Certified Energy Auditor | Super Admin write audits; a client's own roles accept or dispute a verification.",
  required: false,
};

const ORG_HEADER = {
  name: "x-org-id",
  description:
    "Organisation the caller is acting within. Required for a client accepting or disputing a verification.",
  required: false,
};

/** Platform staff plus the audited client's own roles. */
const READERS = [
  "Super Admin",
  "Certified Energy Auditor",
  "Account Officer",
  "System Administrator",
  "Financial Analyst",
  "Economic Buyer",
  "Sustainability Officer",
] as const;

/** Client-side roles that may sign off on a savings claim against them. */
const CLIENT_SIGNATORIES = [
  "Economic Buyer",
  "System Administrator",
  "Financial Analyst",
] as const;

@ApiTags("energy-audits")
@Controller("energy-audits")
export class EnergyAuditsController {
  constructor(private readonly auditsService: EnergyAuditsService) {}

  @Post()
  @ApiOperation({
    summary: "Create Energy Audit",
    description:
      "Opens a certified audit engagement against a client organisation. Stage one of the six-stage lifecycle: everything the revenue model measures starts here.",
  })
  @ApiResponse({ status: 201, description: "Audit created successfully." })
  @ApiResponse({ status: 404, description: "Organization or auditor not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  create(@Body() createDto: CreateEnergyAuditDto) {
    return this.auditsService.create(createDto);
  }

  /**
   * Declared before @Get(":id") so the literal path is not matched as an id.
   */
  @Get("verifications")
  @ApiOperation({
    summary: "List Savings Verifications",
    description:
      "Every verification across every audit the caller can see, flattened with its organisation. Filter with ?status=auditor-signed to get the queue waiting on client acceptance — that queue is unbillable revenue, so it is the Account Officer's worklist.",
  })
  @ApiQuery({ name: "status", required: false, description: "draft | auditor-signed | client-accepted | disputed" })
  @ApiResponse({ status: 200, description: "Array of verifications." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  listVerifications(@Query("status") status?: string) {
    return this.auditsService.listVerifications(status);
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
    description: "One audit with its survey, baseline, findings and verifications.",
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

  @Get(":id/baseline-suggestion")
  @ApiOperation({
    summary: "Suggest Baseline From Readings",
    description:
      "Aggregates the organisation's live electricity meters across a window and returns the average monthly consumption plus the weather and occupancy averages for the same window. The auditor confirms these figures rather than typing their own: a hand-entered baseline is the easiest place to quietly inflate every future savings claim.",
  })
  @ApiQuery({ name: "from", required: true, description: "Window start, YYYY-MM" })
  @ApiQuery({ name: "to", required: true, description: "Window end, YYYY-MM" })
  @ApiResponse({ status: 200, description: "Suggested baseline and factors." })
  @ApiResponse({ status: 400, description: "Missing/invalid range, or no readings in it." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin", "Account Officer")
  baselineSuggestion(
    @Param("id") id: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.auditsService.baselineSuggestion(id, from, to);
  }

  @Get(":id/verification-suggestion")
  @ApiOperation({
    summary: "Compute Claimable Savings For a Period",
    description:
      "Runs attribution and baseline adjustment for one month without saving anything. Returns the adjusted baseline, the actual consumption, the claimable saving, and — for comparison — what a naive baseline-minus-actual would have claimed. The gap between those two is the weather and occupancy the client is not billed for.",
  })
  @ApiQuery({ name: "period", required: true, description: "YYYY-MM" })
  @ApiResponse({ status: 200, description: "Computed draft verification." })
  @ApiResponse({ status: 409, description: "Audit has no locked baseline." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...READERS)
  verificationSuggestion(@Param("id") id: string, @Query("period") period: string) {
    return this.auditsService.verificationSuggestion(id, period);
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

  @Patch(":id/baseline")
  @ApiOperation({
    summary: "Lock Baseline",
    description:
      "Freezes the figures every future savings claim is measured against. Refused if a baseline is already locked — one that can be edited after claims have been made against it is not a baseline. Normalisation factors are mandatory: without them a later period cannot be adjusted.",
  })
  @ApiResponse({ status: 200, description: "Baseline locked." })
  @ApiResponse({ status: 400, description: "Normalisation factors missing." })
  @ApiResponse({ status: 409, description: "Baseline already locked." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  lockBaseline(@Param("id") id: string, @Body() dto: LockBaselineDto) {
    return this.auditsService.lockBaseline(id, dto);
  }

  @Post(":id/findings")
  @ApiOperation({
    summary: "Add Audit Finding",
    description:
      "Records a recommendation with its estimated saving, capex and the buildings it touches. Those buildings scope which meters a later verification may credit, so a finding with no buildings can never contribute to a bill.",
  })
  @ApiResponse({ status: 201, description: "Finding added." })
  @ApiResponse({ status: 400, description: "Building belongs to another organisation." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  addFinding(@Param("id") id: string, @Body() dto: CreateFindingDto) {
    return this.auditsService.addFinding(id, dto);
  }

  @Patch(":id/findings/:findingId")
  @ApiOperation({
    summary: "Update Audit Finding",
    description:
      "Moves a recommendation along proposed → accepted → implemented → verified. Setting status to implemented stamps implemented_on, which is the date that decides from which month savings may be claimed for this measure.",
  })
  @ApiResponse({ status: 200, description: "Finding updated." })
  @ApiResponse({ status: 404, description: "Audit or finding not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin", "Facility Manager", "Technician Administrator")
  updateFinding(
    @Param("id") id: string,
    @Param("findingId") findingId: string,
    @Body() dto: UpdateFindingDto,
  ) {
    return this.auditsService.updateFinding(id, findingId, dto);
  }

  @Delete(":id/findings/:findingId")
  @ApiOperation({
    summary: "Delete Audit Finding",
    description:
      "Removes a recommendation. Refused once a savings verification credits it.",
  })
  @ApiResponse({ status: 200, description: "Finding deleted." })
  @ApiResponse({ status: 409, description: "A verification credits this finding." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  removeFinding(@Param("id") id: string, @Param("findingId") findingId: string) {
    return this.auditsService.removeFinding(id, findingId);
  }

  @Post(":id/verifications")
  @ApiOperation({
    summary: "Create Savings Verification",
    description:
      "Saves a draft claim for one month. Every figure is recomputed server-side from the locked baseline and the period's readings — nothing is accepted from the request body, because the party submitting works for the party being paid the share. Refused when no implemented finding covered the period.",
  })
  @ApiResponse({ status: 201, description: "Draft verification created." })
  @ApiResponse({ status: 409, description: "Period already verified, or nothing implemented to claim." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  addVerification(@Param("id") id: string, @Body() dto: CreateVerificationDto) {
    return this.auditsService.addVerification(id, dto);
  }

  @Patch(":id/verifications/:vid/sign")
  @ApiOperation({
    summary: "Sign Savings Verification",
    description:
      "The auditor's sign-off. Still not billable: the pricing engine ignores anything short of client acceptance, so signing alone cannot enlarge an invoice.",
  })
  @ApiResponse({ status: 200, description: "Verification signed." })
  @ApiResponse({ status: 409, description: "Already accepted by the client." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Certified Energy Auditor", "Super Admin")
  signVerification(
    @Param("id") id: string,
    @Param("vid") vid: string,
    @Body() body: { signed_by: string },
  ) {
    return this.auditsService.signVerification(id, vid, body.signed_by);
  }

  @Patch(":id/verifications/:vid/accept")
  @ApiOperation({
    summary: "Accept Savings Verification (client)",
    description:
      "The client's counter-signature, and the only point at which a savings claim becomes billable. One of two writes in the revenue model a client-side role may perform. The caller's x-org-id must match the audited organisation.",
  })
  @ApiResponse({ status: 200, description: "Verification accepted; now billable." })
  @ApiResponse({ status: 403, description: "Caller belongs to another organisation." })
  @ApiResponse({ status: 409, description: "Not yet signed, or already accepted." })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...CLIENT_SIGNATORIES)
  acceptVerification(
    @Param("id") id: string,
    @Param("vid") vid: string,
    @Body() body: { accepted_by: string },
  ) {
    return this.auditsService.acceptVerification(id, vid, body.accepted_by);
  }

  @Patch(":id/verifications/:vid/dispute")
  @ApiOperation({
    summary: "Dispute Savings Verification (client)",
    description:
      "The client's rejection, with a reason. A disputed claim never reaches an invoice; the subscription still bills, since that service was delivered regardless.",
  })
  @ApiResponse({ status: 200, description: "Verification disputed." })
  @ApiResponse({ status: 403, description: "Caller belongs to another organisation." })
  @ApiResponse({ status: 409, description: "Already accepted." })
  @ApiHeader(ROLE_HEADER)
  @ApiHeader(ORG_HEADER)
  @Roles(...CLIENT_SIGNATORIES)
  disputeVerification(
    @Param("id") id: string,
    @Param("vid") vid: string,
    @Body() dto: DisputeVerificationDto,
  ) {
    return this.auditsService.disputeVerification(id, vid, dto);
  }

  @Put(":id")
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
      "Partially updates an audit, for example submitting it for approval or approving it.",
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
      "Permanently removes an audit. Refused while a subscription measures against its baseline, or once it holds client-accepted verifications that have been billed.",
  })
  @ApiResponse({ status: 200, description: "Audit deleted successfully." })
  @ApiResponse({ status: 409, description: "Audit is referenced by a contract or a billed verification." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader(ROLE_HEADER)
  @Roles("Super Admin")
  remove(@Param("id") id: string) {
    return this.auditsService.remove(id);
  }
}
