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
  DatabaseService,
  PLATFORM_SIDE_ROLES,
  SELF_REGISTERABLE_ROLES,
} from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
  getTenantContext,
} from "../../core/tenancy/tenant-context";
import { CreateUserDto } from "./dto/create-user.dto";
import { PutUserDto } from "./dto/put-user.dto";

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
   * Public sign-up.
   *
   * Distinct from create() because create() is reached by an authenticated
   * administrator, whose organisation comes from their x-org-id header. A
   * visitor has no header, so the organisation has to come from the request
   * body — which means both of these have to be enforced here, server side.
   * The sign-up form's dropdown is a convenience, not a control: anyone can
   * POST this endpoint directly with whatever body they like.
   */
  register(createDto: CreateUserDto) {
    // 1. Self-registration may only ever grant a role on the allowlist. This
    //    is checked positively rather than by excluding staff roles: a
    //    denylist would silently admit any role that leaves PLATFORM_SIDE_ROLES
    //    for an unrelated reason, which is precisely what happened to
    //    Organization Admin when it stopped being platform-side.
    if (!SELF_REGISTERABLE_ROLES.includes(createDto.role)) {
      throw new BadRequestException(
        `Role '${createDto.role}' cannot be self-registered. Contact an administrator.`,
      );
    }

    // 2. An account with no organisation belongs to no tenant, and tenant
    //    scoping fails closed, so such an account would see nothing at all.
    //    Rejecting it here gives a clear error instead of a silently empty app.
    if (!createDto.organization_id) {
      throw new BadRequestException("organization_id is required to sign up");
    }

    const org = this.database.organizations.find(
      (o) => o.organization_id === createDto.organization_id,
    );
    if (!org) {
      throw new BadRequestException(
        `Unknown organization '${createDto.organization_id}'`,
      );
    }

    return this.create(createDto);
  }

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

    if (createDto.email) {
      const exists = this.database.users.find(
        (x) => x.email === createDto.email,
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
    const newRecord = { user_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null };
    this.database.users.push(newRecord as any);
    return this.withoutPassword(newRecord);
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
    } as any;
    return this.withoutPassword(this.database.users[index]);
  }
  update(id: string, updateDto: UpdateUserDto) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1 || !assertTenantOwns(this.database.users[index]))
      throw new NotFoundException(`User with ID ${id} not found`);
    this.database.users[index] = {
      ...this.database.users[index],
      ...updateDto,
      organization_id: this.database.users[index].organization_id,
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
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!user) throw new UnauthorizedException('Invalid email or password');
    // Never send the password back to the client
    const { password: _pw, ...safeUser } = user;
    return safeUser;
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
