import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { logWriter } from "../../core/utils/log-writer";

/**
 * Invoice Access Middleware — ROUTER-LEVEL, registered by a FEATURE MODULE
 * ───────────────────────────────────────────────────────────────────────
 * Writes a one-line audit record for every request that touches an invoice.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Invoices are financial records. In a platform that bills client
 * organisations for their energy use, who reads and edits those records is
 * audit-relevant in a way that reading a campus list is not. This gives
 * that trail its own file, separate from general debug logging, so it stays
 * readable for as long as it is useful.
 *
 * WHY IT LIVES HERE AND NOT IN AppModule
 * ──────────────────────────────────────
 * It is registered in InvoicesModule.configure(), not AppModule. Two
 * reasons:
 *
 *   1. Cohesion. This concern belongs to the invoices feature. AppModule
 *      does not need to know that invoice access is audited, and removing
 *      InvoicesModule removes this middleware with it — nothing is left
 *      dangling in a central file.
 *
 *   2. It demonstrates that middleware registration is not a privilege of
 *      the root module. Any module implementing NestModule can bind its
 *      own middleware, and Nest collects them all at startup.
 *
 * BINDING STYLE
 * ─────────────
 * Bound with `.forRoutes(InvoicesController)` — the controller class rather
 * than a path string. Nest reads the controller's route decorators and
 * binds one Express route per handler, so a new @Get added to the
 * controller tomorrow is covered automatically with no path to keep in
 * sync. This is the most maintenance-proof of the four binding styles.
 *
 * LOG FORMAT
 * ──────────
 * One line per entry, unlike the multi-line blocks used by the debug and
 * upload-audit logs. An audit trail is something you grep, sort and count,
 * so a line-oriented format is easier to work with than a pretty block:
 *
 *   2026-08-27T12:00:00.000Z | GET    /api/invoices        | Financial Analyst | org-001 | 200 | 4ms
 */
@Injectable()
export class InvoiceAccessMiddleware implements NestMiddleware {
  private readonly logger = new Logger("InvoiceAccess");
  /** Filename prefix; logWriter appends the date and the .log extension. */
  private readonly LOG_PREFIX = "invoice-access-";

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Snapshot before handing off — later middleware may alter the request.
    const method = req.method;
    const url = req.originalUrl;
    const role = (req.headers["x-role"] as string) || "none";
    const orgId = (req.headers["x-org-id"] as string) || "none";
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    // Same reasoning as UploadAuditMiddleware: listen for 'finish' rather
    // than wrapping res.send, because LoggerMiddleware already wraps it and
    // two wrappers on one method make behaviour depend on registration order.
    res.on("finish", () => {
      const line =
        [
          new Date().toISOString(),
          method.padEnd(6),
          url.padEnd(52),
          role.padEnd(20),
          orgId.padEnd(12),
          String(res.statusCode),
          `${Date.now() - startTime}ms`,
          ip,
        ].join(" | ") + "\n";

      logWriter.write(this.LOG_PREFIX, line);
    });

    next();
  }
}
