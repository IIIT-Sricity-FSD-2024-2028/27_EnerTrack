import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth/token";

/**
 * Establishes who is calling, from a signed token and nothing else.
 *
 * The rest of the backend (SecurityMiddleware, TenantMiddleware, RolesGuard,
 * the services) reads `x-role` and `x-org-id` to decide what a caller may do.
 * Those used to come straight from the client, so anyone could type
 * "Super Admin". This middleware runs first and takes that choice away:
 *
 *   - Whatever `x-role` / `x-org-id` the client sent is discarded.
 *   - If a valid `Authorization: Bearer <token>` is present, the two headers
 *     are rewritten from the token's signed claims.
 *   - If there is no token, the request carries no role at all, so every
 *     protected route answers 403 and only the public routes work.
 *   - A token that is present but forged, expired or malformed is a 401.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    delete req.headers["x-role"];
    delete req.headers["x-org-id"];

    const header = req.headers.authorization;
    if (!header) return next();

    const [scheme, token] = header.split(" ");
    const claims = scheme === "Bearer" && token ? verifyToken(token) : null;
    if (!claims) {
      throw new UnauthorizedException("Your session is invalid or has expired. Sign in again.");
    }

    req.headers["x-role"] = claims.role;
    if (claims.org) req.headers["x-org-id"] = claims.org;
    next();
  }
}
