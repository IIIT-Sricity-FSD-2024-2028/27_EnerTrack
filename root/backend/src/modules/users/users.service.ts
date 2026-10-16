import * as crypto from "crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AuditRequestStatus,
  DatabaseService,
  PLATFORM_SIDE_ROLES,
  UserRole,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
  getTenantContext,
} from "../../core/tenancy/tenant-context";
import { CreateUserDto } from "./dto/create-user.dto";
import { PutUserDto } from "./dto/put-user.dto";
import { BulkUserRowDto } from "./dto/bulk-create-users.dto";
import { SignupDto } from "./dto/signup.dto";

import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private database: DatabaseService) {}

  /**
   * Strips the password before a user record leaves the API.
   *
   * login() already did this, but the list and read endpoints did not, so
   * GET /api/users returned every user's password in plaintext to any caller
   * holding a valid role header. Centralised here so a new endpoint cannot
   * quietly reintroduce the leak.
   */
  private withoutPassword<T extends Record<string, any>>(record: T) {
    if (!record) return record;
    const { password: _pw, ...safe } = record;
    return safe;
  }

  /**
   * Accounts are provisioned, never self-created: the organisation's
   * Organization Admin (or EnerTrack staff) issues the credentials and hands
   * them over, so the organisation controls its own address format. The
   * issued password is temporary (must_change_password), so the admin only
   * knows it until the person's first sign-in.
   */
  create(createDto: CreateUserDto) {
    // Only EnerTrack's own staff may create an account that holds an
    // EnerTrack staff role. Without this, a client's Organization Admin
    // could POST a user with role "Super Admin" and hand themselves back the
    // organisation-write access that the @Roles decorators just removed.
    if (
      PLATFORM_SIDE_ROLES.includes(createDto.role) &&
      !getTenantContext()?.isPlatformSide
    ) {
      throw new ForbiddenException(
        `Only EnerTrack staff may create a user with the '${createDto.role}' role`,
      );
    }

    createDto = { ...createDto, email: createDto.email.trim().toLowerCase() };

    // The organisation may require its own mail domain (e.g. iiits.in). The
    // target organisation is the caller's tenant, or the body's for platform
    // staff creating an Organization Admin on a client's behalf.
    const orgId = currentOrgId() ?? createDto.organization_id ?? null;
    const org = orgId
      ? this.database.organizations.find((o) => o.organization_id === orgId)
      : null;
    if (orgId && !org)
      throw new BadRequestException(`Unknown organization '${orgId}'`);
    if (org?.email_domain) {
      const domain = createDto.email.split("@")[1];
      if (domain !== org.email_domain)
        throw new BadRequestException(
          `${org.name} accounts must use an @${org.email_domain} email address`,
        );
    }

    if (createDto.email) {
      const exists = this.database.users.find(
        (x) => x.email.toLowerCase() === createDto.email,
      );
      if (exists)
        throw new ConflictException(`Duplicate email '${createDto.email}'`);
    }
    if (createDto.phone) {
      const exists = this.database.users?.find(
        (x) => x.phone === createDto.phone,
      );
      if (exists)
        throw new ConflictException(`Duplicate phone '${createDto.phone}'`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { user_id: generatedId, ...createDto, organization_id: orgId, must_change_password: true };
    this.database.users.push(newRecord as any);
    return this.withoutPassword(newRecord);
  }

  /**
   * Self-service sign-up for students and faculty, and ONLY for them.
   *
   * Everyone else is created by their organisation's administrator. The
   * organisation is found from the email domain the administrator registered
   * (Organization.email_domain), and the role is always Campus Visitor, the
   * least-privileged one: the caller chooses neither.
   *
   * Honest limitation: the address is not verified, so someone could sign up
   * with a student address they do not own. That is accepted for now (no
   * mailer yet); the blast radius is the Campus Visitor dashboard of that one
   * organisation.
   */
  signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    const domain = email.split("@")[1];
    const org = this.database.organizations.find(
      (o) => o.email_domain === domain,
    );
    if (!org)
      throw new BadRequestException(
        "Your email domain is not linked to an organisation on EnerTrack yet. Ask your campus administrator to register it or to create your account.",
      );

    // create() applies the same checks as an admin-created account: duplicate
    // email/phone and the organisation's domain.
    const created = this.create({
      name: dto.name,
      email,
      phone: dto.phone,
      password: dto.password,
      role: UserRole.CAMPUS_VISITOR,
      organization_id: org.organization_id,
    } as CreateUserDto);

    // The person chose this password themselves, so there is nothing to replace.
    const record = this.database.users.find((u) => u.user_id === created.user_id);
    if (record) record.must_change_password = false;
    return { ...created, must_change_password: false };
  }

  findAll() {
    return scopeToTenant(this.database.users).map((u) =>
      this.withoutPassword(u),
    );
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.users.find((item) => item.user_id === id));
    if (!record) throw new NotFoundException(`User with ID ${id} not found`);
    return this.withoutPassword(record);
  }

  put(id: string, putDto: PutUserDto) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1 || !assertTenantOwns(this.database.users[index]))
      throw new NotFoundException(`User with ID ${id} not found`);
    this.database.users[index] = {
      user_id: id,
      ...putDto,
      organization_id: this.database.users[index].organization_id,
      must_change_password: true,
    } as any;
    return this.withoutPassword(this.database.users[index]);
  }
  update(id: string, updateDto: UpdateUserDto) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1 || !assertTenantOwns(this.database.users[index]))
      throw new NotFoundException(`User with ID ${id} not found`);

    const current = this.database.users[index];

    // organization_id is normally pinned, the same way Subscription's is:
    // letting a PATCH move an already-tenanted account would silently
    // reassign it to a different client. But that protection only means
    // something once a tenant is actually set. A null organization_id has
    // nothing to protect, so it may be filled in exactly once — the repair
    // path for a user created without one (e.g. an Organization Admin
    // added from the Super Admin's User Management before an organisation
    // was picked). Once set, it reverts to pinned like every other user.
    const organization_id =
      current.organization_id ?? updateDto.organization_id ?? null;

    this.database.users[index] = {
      ...current,
      ...updateDto,
      organization_id,
      // An administrator-issued password is temporary, like at creation.
      ...(updateDto.password ? { must_change_password: true } : {}),
    };
    return this.withoutPassword(this.database.users[index]);
  }

  remove(id: string) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1 || !assertTenantOwns(this.database.users[index]))
      throw new NotFoundException(`User with ID ${id} not found`);
    const removed = this.database.users.splice(index, 1);
    return this.withoutPassword(removed[0]);
  }

  getNotifications(id: string) {
    return scopeToTenant(this.database.notifications.filter((item) => item.user_id === id));
  }

  login(email: string, password: string) {
    const user = this.database.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    );
    if (!user) {
      this.explainUnapprovedRequest(email, password);
      throw new UnauthorizedException('Invalid email or password');
    }
    // Never send the password back to the client
    const { password: _pw, ...safeUser } = user;
    return { ...safeUser, must_change_password: !!user.must_change_password };
  }

  /**
   * Someone who asked for an audit has no account until an auditor approves,
   * so signing in would just say "Invalid email or password", which looks
   * like a mistake rather than a wait. If the email AND password match a
   * request that has not been approved, say where it stands instead.
   *
   * Matching the password too is deliberate: the message must not let anyone
   * discover which email addresses have applied.
   */
  private explainUnapprovedRequest(email: string, password: string) {
    const wanted = email.trim().toLowerCase();
    const request = [...this.database.auditRequests]
      .reverse()
      .find(
        (r) =>
          r.admin_email.toLowerCase() === wanted &&
          r.admin_password === password &&
          r.status !== AuditRequestStatus.APPROVED,
      );
    if (!request) return;
    if (request.status === AuditRequestStatus.PENDING)
      throw new ForbiddenException(
        'Your audit request is still awaiting approval by an EnerTrack auditor. You can sign in once it is approved.',
      );
    throw new ForbiddenException(
      `Your audit request was not approved.${request.decision_note ? ` Reason: ${request.decision_note}` : ''}`,
    );
  }

  /**
   * Replaces the issued (or any) password. Proves knowledge of the current
   * one rather than trusting a header, because this route is public.
   */
  changePassword(email: string, currentPassword: string, newPassword: string) {
    const user = this.database.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === currentPassword,
    );
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (newPassword === currentPassword)
      throw new BadRequestException('Choose a password different from the current one');
    user.password = newPassword;
    user.must_change_password = false;
    const { password: _pw, ...safeUser } = user;
    return { ...safeUser, must_change_password: false };
  }

  /** A one-time password that always satisfies the password rule. */
  generatePassword() {
    const pick = (chars: string) => chars[crypto.randomInt(chars.length)];
    const required = [
      pick("ABCDEFGHJKLMNPQRSTUVWXYZ"),
      pick("abcdefghijkmnpqrstuvwxyz"),
      pick("23456789"),
      pick("@#$%&*!?"),
    ];
    const all = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%&*!?";
    while (required.length < 12) required.push(pick(all));
    // Fisher-Yates so the guaranteed characters are not always first
    for (let i = required.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [required[i], required[j]] = [required[j], required[i]];
    }
    return required.join("");
  }

  /**
   * Creates many accounts at once (e.g. a class of students) and returns the
   * issued credentials for the administrator to distribute. Rows are
   * independent: one bad row never blocks the rest.
   */
  bulkCreate(rows: BulkUserRowDto[]) {
    return rows.map((row, i) => {
      const password = this.generatePassword();
      try {
        const user = this.create({ ...row, password } as CreateUserDto);
        return { row: i + 1, ok: true, email: user.email, name: user.name, role: user.role, password };
      } catch (err: any) {
        return { row: i + 1, ok: false, email: row.email, name: row.name, role: row.role, error: err?.message ?? "Could not create user" };
      }
    });
  }

  /**
   * Returns another user's session so a Super Admin can see the product
   * through their eyes. Same shape as login(), so the frontend can drop the
   * result straight into the session it already understands.
   *
   * Be honest about what this is and is not. Authorisation in this system
   * is a client-supplied x-role header with no token, so anyone who can
   * open devtools could already become any role by editing localStorage.
   * This route is NOT a new security boundary — it is the same capability,
   * made deliberate, logged, and reachable in one click, and shaped so it
   * still makes sense once real authentication lands.
   *
   * What it does add is the activity log entry below: every impersonation
   * leaves a record naming both parties, which is the part that actually
   * matters for a support tool.
   */
  impersonate(targetUserId: string, actor: string | null) {
    const target = this.database.users.find((u) => u.user_id === targetUserId);
    if (!target)
      throw new NotFoundException(`User with ID ${targetUserId} not found`);

    this.database.activityLogs.push({
      activity_log_id: crypto.randomUUID(),
      organization_id: target.organization_id ?? '',
      user_id: target.user_id,
      action_type: 'impersonation',
      title: `${actor ?? 'A Super Admin'} started acting as ${target.name} (${target.role})`,
      timestamp: new Date().toISOString(),
    });

    const { password: _pw, ...safeUser } = target;
    return safeUser;
  }
}
