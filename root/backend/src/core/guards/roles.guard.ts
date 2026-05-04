import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

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

    if (!requiredRoles.includes(roleHeader)) {
      throw new ForbiddenException(
        `Role '${roleHeader}' is not authorized for this action`,
      );
    }

    return true;
  }
}
