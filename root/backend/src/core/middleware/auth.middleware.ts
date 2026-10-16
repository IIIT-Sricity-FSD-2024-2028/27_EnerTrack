import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth/token";
import { DatabaseService } from "../database/database.service";

/**
 * Establishes who is calling, from a signed token and nothing else.
 *
 * The rest of the backend (SecurityMiddleware, TenantMiddleware, RolesGuard,
 * the services) reads `x-role`, `x-org-id` and `x-user-id` to decide what a
 * caller may do and who did it. Those used to come straight from the client,
 * so anyone could type "Super Admin". This middleware runs first and takes
 * that choice away:
 *
 *   - Whatever `x-role` / `x-org-id` / `x-user-id` the client sent is discarded.
 *   - If a valid `Authorization: Bearer <token>` is present, the headers are
 *     rewritten for the signed-in user. Role and organisation come from the
 *     user's current account, so a role change takes effect at once.
 *   - A token issued before the user's sessions were revoked (account
 *     deleted, role or organisation changed, password changed) is refused.
 *   - If there is no token, the request carries no role at all, so every
 *     protected route answers 403 and only the public routes work.
 *   - A token that is present but forged, expired, revoked or malformed is a 401.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private database: DatabaseService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    delete req.headers["x-role"];
    delete req.headers["x-org-id"];
    delete req.headers["x-user-id"];

    const header = req.headers.authorization;
    if (!header) return next();

    const [scheme, token] = header.split(" ");
    const claims = scheme === "Bearer" && token ? verifyToken(token) : null;
    const issuedAt = claims ? (claims.iat_ms ?? (claims.iat ?? 0) * 1000) : 0;
    const revokedAt = claims ? this.database.sessionsRevokedAt[claims.sub] : undefined;
    if (!claims || (revokedAt !== undefined && issuedAt < revokedAt)) {
      throw new UnauthorizedException("Your session is invalid or has expired. Sign in again.");
    }

    const account = this.database.users.find((u) => u.user_id === claims.sub);
    const role = account ? account.role : claims.role;
    const org = account ? account.organization_id : claims.org;

    req.headers["x-user-id"] = claims.sub;
    req.headers["x-role"] = role;
    if (org) req.headers["x-org-id"] = org;
    next();
  }
}
