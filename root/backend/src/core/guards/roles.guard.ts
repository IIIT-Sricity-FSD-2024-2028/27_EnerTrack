import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { ROLE_EQUIVALENTS, DatabaseService } from "../database/database.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private databaseService: DatabaseService
  ) {}

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
    const userIdHeader = request.headers["x-user-id"];

    if (!userIdHeader) {
      throw new ForbiddenException("User ID header 'x-user-id' is required for authentication");
    }

    const user = this.databaseService.users.find(u => u.user_id === userIdHeader);
    if (!user) {
      throw new ForbiddenException("Invalid user session");
    }

    const role = user.role;
    const held = this.effectiveRoles(role);
    const allowed = held.some((r) => requiredRoles.includes(r));

    if (!allowed) {
      throw new ForbiddenException(
        `Role '${role}' is not authorized for this action`,
      );
    }

    // Attach user to request for current-user decorator
    request.user = user;

    return true;
  }
}
