import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  AuditFinding,
  AuditStatus,
  BillingCycle,
  DatabaseService,
  EnergyAudit,
  FindingStatus,
  NotificationTargetType,
  OrganizationStatus,
  SubscriptionStatus,
  UserRole,
} from "../../core/database/database.service";
import { buildInvoice } from "../billing/pricing";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateEnergyAuditDto } from "./dto/create-energy-audit.dto";
import { PutEnergyAuditDto } from "./dto/put-energy-audit.dto";
import { UpdateEnergyAuditDto } from "./dto/update-energy-audit.dto";
import {
  CreateFindingDto,
  RespondToProposalDto,
  SendProposalDto,
  UpdateFindingDto,
} from "./dto/audit-sub-resource.dto";

/**
 * Certified energy audits.
 *
 * An audit answers one question for the client: what should we fix? It
 * records what the auditor found on site and the recommendations that came
 * out of it, and the client's own team implements them.
 *
 * Nothing here touches billing. An earlier version tied audits to a
 * performance share of verified savings, which required a locked baseline,
 * weather normalisation, attribution windows and a counter-signature
 * workflow — none of which survives, because nothing is charged for on the
 * strength of these records. Savings are reported separately and directly
 * from meter readings (OrganizationsService.savings).
 */
@Injectable()
export class EnergyAuditsService {
  constructor(private database: DatabaseService) {}

  /* ── CRUD ──────────────────────────────────────────────────────── */

  create(createDto: CreateEnergyAuditDto) {
    const orgId = createDto.organization_id ?? currentOrgId();
    if (!orgId)
      throw new BadRequestException(
        "organization_id is required, either in the body or as the x-org-id header",
      );

    const org = this.database.organizations.find(
      (o) => o.organization_id === orgId,
    );
    if (!org)
      throw new NotFoundException(`Organization with ID ${orgId} not found`);

    const auditor = this.database.users.find(
      (u) => u.user_id === createDto.auditor_id,
    );
    if (!auditor)
      throw new NotFoundException(
        `Auditor with ID ${createDto.auditor_id} not found`,
      );

    const newRecord: EnergyAudit = {
      audit_id: crypto.randomUUID(),
      organization_id: orgId,
      auditor_id: createDto.auditor_id,
      status: createDto.status,
      scheduled_on: createDto.scheduled_on ?? null,
      conducted_on: createDto.conducted_on ?? null,
      findings: (createDto.findings as any) ?? [],
      proposal: null,
      summary: createDto.summary ?? null,
    };

    this.database.energyAudits.push(newRecord);
    return newRecord;
  }

  findAll() {
    return scopeToTenant(this.database.energyAudits);
  }

  findOne(id: string) {
    const record = assertTenantOwns(
      this.database.energyAudits.find((item) => item.audit_id === id),
    );
    if (!record) throw new NotFoundException(`Audit with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutEnergyAuditDto) {
    const index = this.indexOf(id);
    this.database.energyAudits[index] = {
      ...this.database.energyAudits[index],
      ...(putDto as any),
      audit_id: id,
      organization_id: this.database.energyAudits[index].organization_id,
    };
    return this.database.energyAudits[index];
  }

  update(id: string, updateDto: UpdateEnergyAuditDto) {
    const index = this.indexOf(id);
    this.database.energyAudits[index] = {
      ...this.database.energyAudits[index],
      ...(updateDto as any),
      audit_id: id,
      organization_id: this.database.energyAudits[index].organization_id,
    };
    return this.database.energyAudits[index];
  }

  remove(id: string) {
    const index = this.indexOf(id);
    const audit = this.database.energyAudits[index];

    // Recommendations the client has already acted on are a record of work
    // done, so an audit holding them is kept rather than erased.
    const implemented = audit.findings.filter(
      (f) => f.status === FindingStatus.IMPLEMENTED,
    ).length;
    if (implemented > 0)
      throw new ConflictException(
        `Cannot delete audit ${id}: ${implemented} of its recommendations have been implemented`,
      );

    return this.database.energyAudits.splice(index, 1)[0];
  }

  /* ── Findings ──────────────────────────────────────────────────── */

  addFinding(id: string, dto: CreateFindingDto) {
    const audit = this.findOne(id);

    for (const buildingId of dto.building_ids) {
      const building = this.database.buildings.find(
        (b) => b.building_id === buildingId,
      );
      if (!building)
        throw new NotFoundException(`Building with ID ${buildingId} not found`);
      if (building.organization_id !== audit.organization_id)
        throw new BadRequestException(
          `Building ${buildingId} belongs to a different organisation than this audit`,
        );
    }

    const finding: AuditFinding = {
      finding_id: crypto.randomUUID(),
      title: dto.title,
      category: dto.category,
      severity: dto.severity,
      est_annual_saving: dto.est_annual_saving,
      capex: dto.capex,
      // Simple payback, derived when the auditor has not supplied one.
      payback_months:
        dto.payback_months ??
        (dto.est_annual_saving > 0
          ? Math.round((dto.capex / dto.est_annual_saving) * 12)
          : 0),
      status: dto.status ?? FindingStatus.PROPOSED,
      implemented_on: null,
      building_ids: dto.building_ids,
    };

    audit.findings.push(finding);
    return finding;
  }

  updateFinding(id: string, findingId: string, dto: UpdateFindingDto) {
    const audit = this.findOne(id);
    const finding = audit.findings.find((f) => f.finding_id === findingId);
    if (!finding)
      throw new NotFoundException(
        `Finding with ID ${findingId} not found on audit ${id}`,
      );

    Object.assign(finding, dto);

    // Stamped here rather than trusted from the body, so the record of when
    // work was done is the server's rather than the caller's.
    if (finding.status === FindingStatus.IMPLEMENTED && !finding.implemented_on) {
      finding.implemented_on =
        dto.implemented_on ?? new Date().toISOString().slice(0, 10);
    }
    if (finding.status !== FindingStatus.IMPLEMENTED && !dto.implemented_on) {
      finding.implemented_on = null;
    }

    return finding;
  }

  removeFinding(id: string, findingId: string) {
    const audit = this.findOne(id);
    const index = audit.findings.findIndex((f) => f.finding_id === findingId);
    if (index === -1)
      throw new NotFoundException(
        `Finding with ID ${findingId} not found on audit ${id}`,
      );
    return audit.findings.splice(index, 1)[0];
  }

  /**
   * Recommendations across every audit the caller can see, flattened with
   * their organisation. Drives the auditor's own worklist.
   */
  listFindings(status?: string) {
    return scopeToTenant(this.database.energyAudits).flatMap((audit) =>
      audit.findings
        .filter((f) => !status || f.status === status)
        .map((f) => ({
          ...f,
          audit_id: audit.audit_id,
          organization_id: audit.organization_id,
          organization_name:
            this.database.organizations.find(
              (o) => o.organization_id === audit.organization_id,
            )?.name ?? null,
        })),
    );
  }


  /**
   * An Organization Admin asks EnerTrack to come and look at their site.
   *
   * This is the first move in the whole engagement, and it is the client's
   * to make. Everything downstream — the recommendations, the proposal, the
   * subscription — hangs off this one record.
   *
   * Refused while an engagement is already open, because two auditors
   * surveying the same estate in parallel would produce two proposals and no
   * way to say which one the client answered.
   */
  requestAudit(note?: string) {
    const orgId = currentOrgId();
    if (!orgId)
      throw new BadRequestException(
        "An audit is requested for an organisation, so the x-org-id header is required",
      );

    const org = this.database.organizations.find(
      (o) => o.organization_id === orgId,
    );
    if (!org)
      throw new NotFoundException(`Organization with ID ${orgId} not found`);

    const open = this.database.energyAudits.find(
      (a) =>
        a.organization_id === orgId &&
        a.status !== AuditStatus.ACCEPTED &&
        a.status !== AuditStatus.DECLINED,
    );
    if (open)
      throw new ConflictException(
        `An audit is already underway for ${org.name} (currently ${open.status})`,
      );

    // One auditor in this deployment, so assignment is deterministic. A
    // larger practice would queue here instead; refusing outright is better
    // than creating an engagement nobody owns.
    const auditor = this.database.users.find(
      (u) => u.role === UserRole.CERTIFIED_ENERGY_AUDITOR,
    );
    if (!auditor)
      throw new ConflictException(
        "No certified energy auditor is available. EnerTrack will be in touch.",
      );

    const audit: EnergyAudit = {
      audit_id: crypto.randomUUID(),
      organization_id: orgId,
      auditor_id: auditor.user_id,
      status: AuditStatus.SCHEDULED,
      scheduled_on: null,
      conducted_on: null,
      findings: [],
      proposal: null,
      summary: note?.trim() || null,
    };
    this.database.energyAudits.push(audit);

    this.notify(
      auditor.user_id,
      audit,
      `${org.name} has requested an energy audit${note ? `: ${note.trim()}` : ""}`,
    );

    return audit;
  }

  /* ── Proposal ──────────────────────────────────────────────────── */

  /**
   * Sends the client what they need and what it costs, on one document.
   *
   * Deliberately ONE approval rather than two. An earlier draft of this
   * workflow had the client sign off a requirements list first and see a
   * price only afterwards, but nobody approves a scope without knowing the
   * cost, and a surprising price reopens the scope anyway — so that round
   * trip bought nothing.
   *
   * monthly_estimate is computed by the pricing engine from the tier and
   * the surveyed headcount. The auditor picks the tier; they never type a
   * number, so they cannot quietly discount and the quote is always a
   * figure the billing engine would really produce.
   */
  sendProposal(id: string, dto: SendProposalDto) {
    const audit = this.findOne(id);

    const plan = this.database.subscriptionPlans.find(
      (p) => p.plan_id === dto.recommended_plan_id,
    );
    if (!plan)
      throw new NotFoundException(
        `Subscription plan with ID ${dto.recommended_plan_id} not found`,
      );
    if (!plan.is_active)
      throw new ConflictException(
        `Plan ${plan.name} is retired and cannot be proposed`,
      );
    if (audit.status === AuditStatus.ACCEPTED)
      throw new ConflictException(
        `Audit ${id} has already been accepted; raise a new engagement to re-quote`,
      );

    // A tier that cannot hold their estate is not a proposal, it is a
    // mistake the client would discover after signing.
    if (plan.max_campuses !== null && dto.estimated_campuses > plan.max_campuses)
      throw new ConflictException(
        `${plan.name} covers ${plan.max_campuses} campus(es) but this estate has ` +
          `${dto.estimated_campuses}. Propose a larger tier.`,
      );

    // The client's account owner: their Organization Admin, which is the
    // first account created for any organisation. Stored as a user id
    // rather than a role, because a proposal is sent to a person.
    const recipient = this.database.users.find(
      (u) =>
        u.organization_id === audit.organization_id &&
        u.role === UserRole.ORGANIZATION_ADMIN,
    );
    if (!recipient)
      throw new ConflictException(
        `Organization ${audit.organization_id} has no Organization Admin to send a ` +
          `proposal to. Register one before auditing.`,
      );

    const today = new Date().toISOString().slice(0, 10);
    audit.proposal = {
      recommended_plan_id: plan.plan_id,
      estimated_staff: dto.estimated_staff,
      estimated_campuses: dto.estimated_campuses,
      monthly_estimate: buildInvoice({
        period: today.slice(0, 7),
        subscription: {
          subscription_id: audit.audit_id,
          billing_cycle: BillingCycle.MONTHLY,
        } as any,
        plan,
        billableStaff: dto.estimated_staff,
      }).subtotal,
      sent_to_user_id: recipient.user_id,
      sent_on: today,
      responded_on: null,
      response_note: null,
    };
    audit.status = AuditStatus.PROPOSED;

    // A prospect that has seen a proposal has been audited.
    const org = this.database.organizations.find(
      (o) => o.organization_id === audit.organization_id,
    );
    if (org && org.status === OrganizationStatus.PROSPECT)
      org.status = OrganizationStatus.AUDITED;

    this.notify(
      recipient.user_id,
      audit,
      `${plan.name} proposed for your organisation — ` +
        `${audit.proposal.monthly_estimate.toLocaleString('en-IN')} per month before GST`,
    );

    return audit;
  }

  /**
   * The client says yes, and the service turns on.
   *
   * This is the only place a Subscription is created outside a Super Admin
   * doing it by hand, and it is the point of the whole workflow: a tier
   * stops appearing by magic and instead comes from an audit somebody
   * actually signed.
   */
  acceptProposal(id: string, actorUserId: string) {
    const audit = this.requireOpenProposal(id);
    const proposal = audit.proposal!;

    const existing = this.database.subscriptions.find(
      (sub) =>
        sub.organization_id === audit.organization_id &&
        sub.status !== SubscriptionStatus.CANCELLED,
    );
    if (existing)
      throw new ConflictException(
        `Organization ${audit.organization_id} already has a live subscription ` +
          `(${existing.subscription_id})`,
      );

    const today = new Date().toISOString().slice(0, 10);
    const renews = new Date(today);
    renews.setFullYear(renews.getFullYear() + 1);

    const subscription = {
      subscription_id: crypto.randomUUID(),
      organization_id: audit.organization_id,
      plan_id: proposal.recommended_plan_id,
      status: SubscriptionStatus.ACTIVE,
      billing_cycle: BillingCycle.MONTHLY,
      started_on: today,
      renews_on: renews.toISOString().slice(0, 10),
      cancelled_on: null,
    };
    this.database.subscriptions.push(subscription);

    proposal.responded_on = today;
    audit.status = AuditStatus.ACCEPTED;

    const org = this.database.organizations.find(
      (o) => o.organization_id === audit.organization_id,
    );
    if (org) {
      org.status = OrganizationStatus.ACTIVE;
      if (!org.contract_start) org.contract_start = today;
    }

    this.notify(
      audit.auditor_id,
      audit,
      `Proposal accepted by ${this.nameOf(actorUserId)} — subscription is live`,
    );

    return { audit, subscription };
  }

  /**
   * The client pushes back. The proposal stays on the audit with their note
   * attached, so the auditor revises rather than starting again — which is
   * the difference between a conversation and a rejection.
   */
  requestChanges(id: string, dto: RespondToProposalDto, actorUserId: string) {
    const audit = this.requireOpenProposal(id);
    audit.proposal!.responded_on = new Date().toISOString().slice(0, 10);
    audit.proposal!.response_note = dto.response_note;
    audit.status = AuditStatus.CHANGES_REQUESTED;

    this.notify(
      audit.auditor_id,
      audit,
      `${this.nameOf(actorUserId)} asked for changes: ${dto.response_note}`,
    );
    return audit;
  }

  /** The client says no. Kept as a state so conversion stays reportable. */
  declineProposal(id: string, dto: RespondToProposalDto, actorUserId: string) {
    const audit = this.requireOpenProposal(id);
    audit.proposal!.responded_on = new Date().toISOString().slice(0, 10);
    audit.proposal!.response_note = dto.response_note;
    audit.status = AuditStatus.DECLINED;

    this.notify(
      audit.auditor_id,
      audit,
      `Proposal declined by ${this.nameOf(actorUserId)}: ${dto.response_note}`,
    );
    return audit;
  }

  /** A proposal exists and is still awaiting an answer. */
  private requireOpenProposal(id: string): EnergyAudit {
    const audit = this.findOne(id);
    if (!audit.proposal)
      throw new ConflictException(`Audit ${id} has no proposal to respond to`);
    if (audit.status === AuditStatus.ACCEPTED)
      throw new ConflictException(`Audit ${id} has already been accepted`);
    return audit;
  }

  private nameOf(userId: string): string {
    return (
      this.database.users.find((u) => u.user_id === userId)?.name ?? 'The client'
    );
  }

  /** Reuses the existing notification queue rather than inventing one. */
  private notify(userId: string, audit: EnergyAudit, message: string) {
    this.database.notifications.push({
      notification_id: crypto.randomUUID(),
      organization_id: audit.organization_id,
      user_id: userId,
      target_type: NotificationTargetType.PROPOSAL,
      target_id: audit.audit_id,
      message,
      is_read: false,
    });
  }

  private indexOf(id: string): number {
    const index = this.database.energyAudits.findIndex(
      (item) => item.audit_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.energyAudits[index]))
      throw new NotFoundException(`Audit with ID ${id} not found`);
    return index;
  }
}
