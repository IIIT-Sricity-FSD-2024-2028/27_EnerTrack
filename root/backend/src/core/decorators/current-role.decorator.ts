import { createParamDecorator, ExecutionContext } from "@nestjs/common";
export const CurrentRole = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // RolesGuard now attaches the verified user to the request
    return request.user?.role || "System Administrator";
  },
);
