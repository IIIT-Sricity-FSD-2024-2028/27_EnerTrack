import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../database/database.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Custom Security Middleware
 * ─────────────────────────
 * A hand-written, Router-level NestJS middleware that provides three
 * security layers on every incoming request:
 *
 *   1. Header Integrity   — validates x-role against the UserRole enum
 *   2. Payload Sanitisation — deep-scans body, query, and URL params
 *                             for XSS / script-injection patterns
 *   3. Threat Audit Log    — writes every blocked request to a
 *                             persistent file for forensic review
 *
 * Registered in AppModule.configure() alongside TenantMiddleware and
 * LoggerMiddleware, satisfying the "Router-level middleware" criterion.
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger('SecurityMiddleware');
  private readonly allowedRoles = Object.values(UserRole) as string[];
  private readonly logDir = path.join(process.cwd(), 'logs');

  /** Returns today's threat log path, e.g. logs/security-threats-2026-08-26.log */
  private get threatLogFile(): string {
    const today = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `security-threats-${today}.log`);
  }

  /**
   * Patterns that indicate malicious intent.
   * Each entry carries a human-readable label so the threat log
   * can explain *which* pattern was matched.
   */
  private readonly dangerousPatterns: { label: string; regex: RegExp }[] = [
    { label: 'Inline <script> tag',          regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi },
    { label: 'javascript: URI scheme',       regex: /javascript\s*:/gi },
    { label: 'Inline onerror handler',       regex: /on(error|load|click|mouseover|focus)\s*=/gi },
    { label: 'Embedded <iframe>',            regex: /<iframe\b/gi },
    { label: 'HTML <object>/<embed> tag',    regex: /<(object|embed)\b/gi },
    { label: 'data: URI with script type',   regex: /data\s*:\s*text\/html/gi },
  ];

  constructor() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const roleHeader = req.headers['x-role'] as string | undefined;

    // ── 1. HEADER INTEGRITY ─────────────────────────────────────────
    // If x-role is supplied, it MUST match a value in the UserRole enum.
    // This prevents attackers from sending garbage or SQL/injection
    // strings inside the header that later code might interpolate.
    if (roleHeader && !this.allowedRoles.includes(roleHeader)) {
      this.writeThreatLog({
        type: 'INVALID_ROLE_HEADER',
        ip: clientIp,
        method: req.method,
        url: req.originalUrl,
        detail: `Rejected unknown role: "${roleHeader}"`,
      });
      throw new ForbiddenException(
        `Access Denied: "${roleHeader}" is not a recognised role`,
      );
    }

    // ── 2. DEEP PAYLOAD SANITISATION ────────────────────────────────
    // Recursively walk the request body, query string, and URL params
    // looking for any string value that matches a dangerous pattern.
    const threat =
      this.inspectValue(req.body,   'body')   ||
      this.inspectValue(req.query,  'query')  ||
      this.inspectValue(req.params, 'params');

    if (threat) {
      this.writeThreatLog({
        type: 'XSS_INJECTION_BLOCKED',
        ip: clientIp,
        method: req.method,
        url: req.originalUrl,
        detail: threat,
      });
      throw new BadRequestException(
        'Security Violation: Potentially malicious content detected in the request',
      );
    }

    // ── All checks passed — hand off to the next middleware ─────────
    next();
  }

  // ─── Private helpers ───────────────────────────────────────────────

  /**
   * Recursively inspects a value (string, array, or object) against
   * every dangerous pattern. Returns a human-readable description of
   * the first match, or null if the value is clean.
   */
  private inspectValue(value: unknown, location: string): string | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      for (const { label, regex } of this.dangerousPatterns) {
        // Reset lastIndex because some regexes have the /g flag
        regex.lastIndex = 0;
        if (regex.test(value)) {
          const preview = value.length > 80 ? value.substring(0, 80) + '…' : value;
          return `${label} found in ${location}: "${preview}"`;
        }
      }
      return null;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const found = this.inspectValue(value[i], `${location}[${i}]`);
        if (found) return found;
      }
      return null;
    }

    if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        const found = this.inspectValue(val, `${location}.${key}`);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Appends a structured threat entry to the daily threat log file.
   * Each entry is self-contained so `grep` / `cat` work immediately.
   */
  private writeThreatLog(entry: {
    type: string;
    ip: string;
    method: string;
    url: string;
    detail: string;
  }): void {
    const timestamp = new Date().toISOString();
    const separator = '─'.repeat(80);
    const line =
      `\n${separator}\n` +
      `  🛑 THREAT BLOCKED\n` +
      `${separator}\n` +
      `  Timestamp : ${timestamp}\n` +
      `  Type      : ${entry.type}\n` +
      `  IP        : ${entry.ip}\n` +
      `  Route     : ${entry.method} ${entry.url}\n` +
      `  Detail    : ${entry.detail}\n` +
      `${separator}\n`;

    this.logger.warn(`🛑 [${entry.type}] ${entry.method} ${entry.url} from ${entry.ip}`);

    try {
      fs.appendFileSync(this.threatLogFile, line, 'utf8');
    } catch (err) {
      this.logger.error(`Failed to write threat log: ${err}`);
    }
  }
}
