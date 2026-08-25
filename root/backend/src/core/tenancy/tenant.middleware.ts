import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { tenantStorage } from "./tenant-context";
import { PLATFORM_SIDE_ROLES } from "../database/database.service";

/**
 * Reads the tenant headers off each request and opens an AsyncLocalStorage
 * scope for the rest of that request's lifetime.
 *
 *   x-role    which role the caller holds
 *   x-org-id  which client organisation they are acting within
 *
 * Both are optional. With no x-org-id the request behaves exactly as it did
 * before multi-tenancy existed.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const role = (req.headers["x-role"] as string) || null;
    const orgId = (req.headers["x-org-id"] as string) || null;
    const isPlatformSide = role ? PLATFORM_SIDE_ROLES.includes(role) : false;

    tenantStorage.run({ orgId, role, isPlatformSide }, () => next());
  }
}
