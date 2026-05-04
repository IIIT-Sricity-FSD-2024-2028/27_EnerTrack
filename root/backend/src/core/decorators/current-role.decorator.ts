import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentRole = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['x-user-role'] || 'System Administrator';
  },
);
