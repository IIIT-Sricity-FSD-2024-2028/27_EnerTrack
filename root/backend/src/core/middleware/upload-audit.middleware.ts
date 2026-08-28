import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logWriter } from '../utils/log-writer';

/**
 * Upload Audit Middleware — ROUTER-LEVEL
 * ──────────────────────────────────────
 * Records an audit entry for every attempt to upload a file.
 *
 * WHY THIS IS ROUTER-LEVEL AND THE OTHERS ARE NOT
 * ───────────────────────────────────────────────
 * SecurityMiddleware, TenantMiddleware and LoggerMiddleware are registered
 * with `.forRoutes("*")`, which binds them to every route in the application.
 * That is application-level behaviour: they cannot tell you anything about
 * WHICH route was hit, because the answer is always "all of them".
 *
 * This middleware is bound in AppModule.configure() to three specific
 * path + method pairs:
 *
 *   POST /api/meter-readings/upload
 *   POST /api/invoices/:id/document
 *   POST /api/wastage-reports/:id/photos
 *
 * A GET to the same paths does not trigger it. Neither does a POST to any
 * other route. That selectivity is the whole point, and it is observable:
 * hit an upload route and logs/upload-audit-*.log grows, hit anything else
 * and it does not.
 *
 * WHY AN AUDIT TRAIL FOR UPLOADS SPECIFICALLY
 * ───────────────────────────────────────────
 * Uploads are the highest-risk endpoints in the system: they are the only
 * ones that write attacker-supplied bytes to our disk. If a malicious file
 * ever does get through, this log is what tells us who sent it, when, from
 * where, and whether it was accepted.
 *
 * WHERE IT SITS IN THE PIPELINE
 * ─────────────────────────────
 * Middleware runs BEFORE guards and before multer's file interceptor, so:
 *
 *   - Rejected attempts are still recorded. A caller whose role fails
 *     RolesGuard, or whose file is refused by the type filter, appears in
 *     this log with the status code that turned them away. That is exactly
 *     what an audit trail is for — a log of only successful uploads would
 *     be useless for spotting someone probing the endpoint.
 *
 *   - req.body and req.file are NOT yet populated. The multipart body has
 *     not been parsed at this point, so the real filename and true byte
 *     count are unavailable here. We record the CLIENT-DECLARED
 *     content-length instead, and label it as such, because a declared
 *     size is a claim rather than a fact.
 *
 *   - req.params is empty. Route matching happens after middleware, so the
 *     :id in the path cannot be read from req.params. The full URL is
 *     recorded instead.
 */
@Injectable()
export class UploadAuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger('UploadAudit');
  /** Filename prefix; logWriter appends the date and the .log extension. */
  private readonly LOG_PREFIX = 'upload-audit-';

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Captured now rather than inside the finish handler: by the time the
    // response completes, other middleware may have altered the request.
    const attempt = {
      method: req.method,
      url: req.originalUrl,
      role: (req.headers['x-role'] as string) || 'none',
      orgId: (req.headers['x-org-id'] as string) || 'none',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      contentType: req.get('content-type') || 'none',
      declaredBytes: Number(req.get('content-length') || 0),
    };

    this.logger.log(
      `[UPLOAD ATTEMPT] ${attempt.method} ${attempt.url} | Role: ${attempt.role} | ~${this.humanSize(attempt.declaredBytes)}`,
    );

    // 'finish' fires once the response has been fully flushed to the socket.
    //
    // Deliberately NOT done by replacing res.send: LoggerMiddleware already
    // wraps that method, and a second wrapper would stack on top of the
    // first, making the behaviour depend on registration order. Listening
    // for an event touches nothing that another middleware owns.
    res.on('finish', () => {
      this.writeAuditEntry({
        ...attempt,
        statusCode: res.statusCode,
        durationMs: Date.now() - startTime,
        outcome: res.statusCode < 400 ? 'ACCEPTED' : 'REJECTED',
      });
    });

    next();
  }

  /** Bytes as something a human can read at a glance. */
  private humanSize(bytes: number): string {
    if (!bytes) return 'unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private writeAuditEntry(entry: {
    method: string;
    url: string;
    role: string;
    orgId: string;
    ip: string;
    userAgent: string;
    contentType: string;
    declaredBytes: number;
    statusCode: number;
    durationMs: number;
    outcome: string;
  }): void {
    const separator = '─'.repeat(80);
    const marker = entry.outcome === 'ACCEPTED' ? '✔' : '✘';

    let block = `\n${separator}\n`;
    block += `  ${marker} UPLOAD ${entry.outcome}\n`;
    block += `${separator}\n`;
    block += `  Timestamp     : ${new Date().toISOString()}\n`;
    block += `  Route         : ${entry.method} ${entry.url}\n`;
    block += `  Role          : ${entry.role}\n`;
    block += `  Organisation  : ${entry.orgId}\n`;
    block += `  IP            : ${entry.ip}\n`;
    block += `  User-Agent    : ${entry.userAgent}\n`;
    block += `  Content-Type  : ${entry.contentType}\n`;
    // "Declared" because this is the client's own claim about the payload
    // size, read before the body was parsed. It is not a verified figure.
    block += `  Declared Size : ${this.humanSize(entry.declaredBytes)}\n`;
    block += `  Status        : ${entry.statusCode}\n`;
    block += `  Duration      : ${entry.durationMs}ms\n`;
    block += `${separator}\n`;

    logWriter.write(this.LOG_PREFIX, block);
  }
}
