import * as crypto from "crypto";
import { hashPassword } from "../../core/auth/passwords";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditRequest,
  AuditRequestStatus,
  DatabaseService,
} from "../../core/database/database.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { RegisterOrganizationDto } from "../organizations/dto/register-organization.dto";
import { DecideAuditRequestDto } from "./dto/decide-audit-request.dto";

/**
 * Audit requests: an organisation asking to be taken on, before it exists.
 *
 * The point of this module is the gap it puts between "someone typed a form"
 * and "the database has a new organisation and account". Nothing is created
 * until a Super Admin approves, so an anonymous visitor can no longer
 * write organisations and users into the system just by posting.
 */
@Injectable()
export class AuditRequestsService {
  constructor(
    private database: DatabaseService,
    private organizations: OrganizationsService,
  ) {}

  /** A request as the Super Admin sees it. The password never leaves the server. */
  private view(request: AuditRequest) {
    const { admin_password: _password, ...visible } = request;
    return visible;
  }

  private find(id: string): AuditRequest {
    const request = this.database.auditRequests.find(
      (r) => r.request_id === id,
    );
    if (!request)
      throw new NotFoundException(`Audit request with ID ${id} not found`);
    return request;
  }

  private assertPending(request: AuditRequest) {
    if (request.status !== AuditRequestStatus.PENDING)
      throw new ConflictException(
        `This request was already ${request.status}`,
      );
  }

  /**
   * Public: the person asking has no account. Records the request as pending
   * and creates nothing else.
   *
   * It refuses a name, email or domain that is already taken, whether by a real
   * organisation or user or by another request still waiting, so one person
   * cannot queue the same request again and again.
   */
  submit(dto: RegisterOrganizationDto) {
    const name = dto.name.trim();
    const email = dto.admin_email.trim().toLowerCase();
    const domain = dto.email_domain?.trim().toLowerCase() || null;

    const waiting = this.database.auditRequests.filter(
      (r) => r.status === AuditRequestStatus.PENDING,
    );
    if (waiting.some((r) => r.name.toLowerCase() === name.toLowerCase()))
      throw new ConflictException(
        `A request for an organisation named '${name}' is already awaiting approval.`,
      );
    if (waiting.some((r) => r.admin_email.toLowerCase() === email))
      throw new ConflictException(
        `An audit request for the email ${email} is already awaiting approval.`,
      );
    if (domain && waiting.some((r) => r.email_domain === domain))
      throw new ConflictException(
        `The domain ${domain} is already part of a request awaiting approval.`,
      );

    // Real organisations and users: same rules as creating them for real.
    this.organizations.assertCanRegister(dto);

    const request: AuditRequest = {
      request_id: crypto.randomUUID(),
      status: AuditRequestStatus.PENDING,
      requested_at: new Date().toISOString(),
      name,
      type: dto.type.trim(),
      location: dto.location?.trim() || null,
      floor_area_sqm: dto.floor_area_sqm ?? null,
      email_domain: domain,
      admin_name: dto.admin_name.trim(),
      admin_email: email,
      admin_phone: dto.admin_phone?.trim() || null,
      admin_password: hashPassword(dto.admin_password),
      decided_at: null,
      decided_by: null,
      decision_note: null,
      organization_id: null,
    };
    this.database.auditRequests.push(request);

    // The public caller only needs to know it was received.
    return {
      request_id: request.request_id,
      status: request.status,
      requested_at: request.requested_at,
      name: request.name,
    };
  }

  /** Newest first, optionally only one status. */
  findAll(status?: string) {
    if (
      status &&
      !Object.values(AuditRequestStatus).includes(status as AuditRequestStatus)
    )
      throw new BadRequestException(
        `status must be one of: ${Object.values(AuditRequestStatus).join(", ")}`,
      );
    return this.database.auditRequests
      .filter((r) => !status || r.status === status)
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
      .map((r) => this.view(r));
  }

  /**
   * Approving is what creates the organisation and its administrator. If the
   * name, email or domain has been taken since the request was made, creation
   * fails with a 409 and the request stays pending, so the Super Admin can deny it.
   */
  approve(id: string, dto: DecideAuditRequestDto) {
    const request = this.find(id);
    this.assertPending(request);

    const { organization, admin } = this.organizations.createWithAdmin({
      name: request.name,
      type: request.type,
      location: request.location ?? undefined,
      floor_area_sqm: request.floor_area_sqm ?? undefined,
      email_domain: request.email_domain ?? undefined,
      admin_name: request.admin_name,
      admin_email: request.admin_email,
      admin_password: request.admin_password,
      admin_phone: request.admin_phone ?? undefined,
    });

    request.status = AuditRequestStatus.APPROVED;
    request.decided_at = new Date().toISOString();
    request.decided_by = dto.decided_by ?? null;
    request.decision_note = dto.note?.trim() || null;
    request.organization_id = organization.organization_id;

    return { request: this.view(request), organization, admin };
  }

  /** Denying creates nothing. The note is what the person sees when they try to sign in. */
  deny(id: string, dto: DecideAuditRequestDto) {
    const request = this.find(id);
    this.assertPending(request);

    request.status = AuditRequestStatus.DENIED;
    request.decided_at = new Date().toISOString();
    request.decided_by = dto.decided_by ?? null;
    request.decision_note = dto.note?.trim() || null;

    return this.view(request);
  }
}
