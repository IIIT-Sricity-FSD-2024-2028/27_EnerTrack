import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { ROLE_EQUIVALENTS } from "../database/database.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Expands a role into itself plus every legacy role it stands in for.
   *
   * This is what lets the B2B role model coexist with the 127 @Roles
   * decorators written against the original roles. "Facility Manager"
   * expands to ["Facility Manager", "Technician Administrator"], so it
   * satisfies a controller that still asks for the latter.
   *
   * A legacy role has no entry in the table and expands to itself, so its
   * behaviour is unchanged.
   */
  private effectiveRoles(role: string): string[] {
    return [role, ...(ROLE_EQUIVALENTS[role] ?? [])];
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true; // No @Roles decorator means public route
    }

    const request = context.switchToHttp().getRequest();
    const roleHeader = request.headers["x-role"];

    if (!roleHeader) {
      throw new ForbiddenException("Role header 'x-role' is required");
    }

    const held = this.effectiveRoles(roleHeader);
    const allowed = held.some((r) => requiredRoles.includes(r));

    if (!allowed) {
      throw new ForbiddenException(
        `Role '${roleHeader}' is not authorized for this action`,
      );
    }

    return true;
  }
}
