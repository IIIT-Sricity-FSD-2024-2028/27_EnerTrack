import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { logWriter, MANAGED_PREFIXES } from '../src/core/utils/log-writer';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';

/**
 * End-to-end coverage for the middleware chain.
 *
 * These tests exercise the middlewares through real HTTP requests rather than
 * calling them directly, because the thing worth proving is that they are
 * actually WIRED UP — a middleware that works in isolation but was never
 * registered would pass a unit test and fail in production.
 */
describe('Middleware (e2e)', () => {
  let app: INestApplication;
  const logDir = path.join(process.cwd(), 'logs');
  const today = new Date().toISOString().split('T')[0];

  /** Reads a log file WITHOUT flushing — shows only what is already on disk. */
  const readLogRaw = (name: string): string => {
    const file = path.join(logDir, name);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  };

  /**
   * Flushes the buffer, then reads. Log writes are batched on a 5-second
   * timer, so a test that asserts immediately after a request would be racing
   * the interval. Flushing explicitly makes these tests deterministic without
   * having to sleep.
   */
  const readLog = (name: string): string => {
    logWriter.flushAll();
    return readLogRaw(name);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');

    // Mirror the enhancers main.ts registers, so the tests exercise the same
    // pipeline the running server uses.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalGuards(new RolesGuard(app.get(Reflector)));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Security middleware ────────────────────────────────────────────

  describe('SecurityMiddleware', () => {
    it('rejects an x-role that is not in the UserRole enum', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/invoices')
        .set('x-role', 'Definitely Not A Role')
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not a recognised role');
    });

    it('accepts a valid role', async () => {
      await request(app.getHttpServer())
        .get('/api/invoices')
        .set('x-role', 'Organization Admin')
        .expect(200);
    });

    it('passes a missing x-role through to the guard rather than blocking it itself', async () => {
      // SecurityMiddleware only rejects roles it does not RECOGNISE. A missing
      // role is not its business — it hands the request on, and RolesGuard
      // (which runs later) is what turns it away. The distinct message proves
      // which layer rejected it, and therefore proves the ordering.
      const res = await request(app.getHttpServer())
        .get('/api/invoices')
        .expect(403);

      expect(res.body.message).toContain("Role header 'x-role' is required");
      expect(res.body.message).not.toContain('not a recognised role');
    });

    it('blocks a script tag hidden in the request body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/invoices')
        .set('x-role', 'Organization Admin')
        .send({ vendor: '<script>alert(1)</script>' })
        .expect(400);

      expect(res.body.message).toContain('malicious content');
    });

    it('blocks a javascript: URI in a query string', async () => {
      await request(app.getHttpServer())
        .get('/api/invoices?search=javascript:alert(1)')
        .set('x-role', 'Organization Admin')
        .expect(400);
    });

    it('writes blocked requests to the threat log', async () => {
      const before = readLog(`security-threats-${today}.log`).length;

      await request(app.getHttpServer())
        .get('/api/invoices')
        .set('x-role', 'Intruder')
        .expect(403);

      const after = readLog(`security-threats-${today}.log`);
      expect(after.length).toBeGreaterThan(before);
      expect(after).toContain('INVALID_ROLE_HEADER');
    });
  });

  // ── Error-handling middleware ──────────────────────────────────────

  describe('AllExceptionsFilter', () => {
    it('returns the standard envelope for a 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/invoices/no-such-invoice')
        .set('x-role', 'Organization Admin')
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        statusCode: 404,
        error: 'Not Found',
        method: 'GET',
        path: '/api/invoices/no-such-invoice',
      });
      expect(res.body.timestamp).toBeDefined();
    });

    it('persists errors to a dated log file', async () => {
      const before = readLog(`error-${today}.log`).length;

      await request(app.getHttpServer())
        .get('/api/invoices/another-missing-one')
        .set('x-role', 'Organization Admin')
        .expect(404);

      const after = readLog(`error-${today}.log`);
      expect(after.length).toBeGreaterThan(before);
      expect(after).toContain('another-missing-one');
    });

    it('catches exceptions thrown inside middleware, not just controllers', async () => {
      // SecurityMiddleware throws before any controller is reached. If filters
      // did not cover middleware, this would come back as Express HTML.
      const res = await request(app.getHttpServer())
        .get('/api/invoices')
        .set('x-role', 'Not Real')
        .expect(403);

      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Logging middleware ─────────────────────────────────────────────

  describe('LoggerMiddleware', () => {
    it('writes both the request and the response to the debug log', async () => {
      await request(app.getHttpServer())
        .get('/api/invoices')
        .set('x-role', 'Organization Admin')
        .expect(200);

      const log = readLog(`custom-debug-${today}.log`);
      expect(log).toContain('INCOMING REQUEST');
      expect(log).toContain('/api/invoices');
      expect(log).toContain('SUCCESS RESPONSE');
    });
  });

  describe('Credential redaction', () => {
    // Regression test. The logger used to write POST /api/users/login bodies
    // verbatim, which put every user's plaintext password on disk.
    const password = 'PlaintextPasswordThatMustNeverBeLogged';

    it('never writes a login password to the debug log', async () => {
      await request(app.getHttpServer())
        .post('/api/users/login')
        .send({ email: 'aadi@gmail.com', password });

      const log = readLog(`custom-debug-${today}.log`);
      expect(log).not.toContain(password);
      // The request itself must still be logged — redaction, not silence.
      expect(log).toContain('/api/users/login');
      expect(log).toContain('[REDACTED]');
    });

    it('redacts token-like fields too, not just password', async () => {
      await request(app.getHttpServer())
        .post('/api/users/login')
        .send({
          email: 'aadi@gmail.com',
          password,
          accessToken: 'tok_must_not_appear',
          api_key: 'key_must_not_appear',
        });

      const log = readLog(`custom-debug-${today}.log`);
      expect(log).not.toContain('tok_must_not_appear');
      expect(log).not.toContain('key_must_not_appear');
    });

    it('leaves non-sensitive fields readable', async () => {
      await request(app.getHttpServer())
        .post('/api/users/login')
        .send({ email: 'visible@example.com', password });

      const log = readLog(`custom-debug-${today}.log`);
      expect(log).toContain('visible@example.com');
    });
  });

  // ── Log writer: intervals and retention ────────────────────────────

  describe('Log writer', () => {
    const PREFIX = 'custom-debug-';

    it('buffers ordinary entries and only writes them on flush', async () => {
      // Flush first so the buffer starts empty and the assertion below is
      // about THIS entry, not something left over from an earlier test.
      logWriter.flushAll();

      const marker = `BUFFER-MARKER-${Date.now()}`;
      logWriter.write(PREFIX, marker + '\n');

      // Still in memory — this is the "at regular intervals" behaviour.
      expect(readLogRaw(`${PREFIX}${today}.log`)).not.toContain(marker);

      logWriter.flushAll();
      expect(readLogRaw(`${PREFIX}${today}.log`)).toContain(marker);
    });

    it('writes immediate entries straight to disk, bypassing the buffer', () => {
      const marker = `IMMEDIATE-MARKER-${Date.now()}`;
      logWriter.write(PREFIX, marker + '\n', { immediate: true });

      // No flush call in between. A 5xx must survive a crash that happens
      // before the next interval fires.
      expect(readLogRaw(`${PREFIX}${today}.log`)).toContain(marker);
    });

    it('exposes a flush interval, so the docs and the code cannot drift', () => {
      expect(logWriter.flushIntervalMs).toBeGreaterThan(0);
    });

    it('retention deletes back-dated files for EVERY managed prefix', () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const created: string[] = [];

      for (const prefix of MANAGED_PREFIXES) {
        const file = path.join(logDir, `${prefix}1999-01-01.log`);
        fs.writeFileSync(file, 'stale', 'utf8');
        fs.utimesSync(file, eightDaysAgo / 1000, eightDaysAgo / 1000);
        created.push(file);
      }

      // A file this writer does not own must be left alone.
      const foreign = path.join(logDir, 'someone-elses.log');
      fs.writeFileSync(foreign, 'keep me', 'utf8');
      fs.utimesSync(foreign, eightDaysAgo / 1000, eightDaysAgo / 1000);

      logWriter.sweepOldLogs();

      for (const file of created) {
        expect(fs.existsSync(file)).toBe(false);
      }
      expect(fs.existsSync(foreign)).toBe(true);

      fs.unlinkSync(foreign);
    });

    it("keeps today's files", () => {
      const file = path.join(logDir, `error-${today}.log`);
      fs.writeFileSync(file, 'fresh', 'utf8');
      logWriter.sweepOldLogs();
      expect(fs.existsSync(file)).toBe(true);
    });
  });

  // ── Security headers (helmet) ──────────────────────────────────────
  // Registered with app.use() in main.ts, so it is asserted in the running
  // server rather than here — see MIDDLEWARE.md for the manual check.

  // ── File upload middleware ─────────────────────────────────────────

  describe('File upload', () => {
    it('returns 400, not 500, when no file is sent', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/meter-readings/upload')
        .set('x-role', 'Organization Admin')
        .expect(400);

      expect(res.body.message).toContain('No file was uploaded');
    });

    it('rejects a non-CSV file', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/meter-readings/upload')
        .set('x-role', 'Organization Admin')
        .attach('file', Buffer.from('not a csv'), {
          filename: 'evil.exe',
          contentType: 'application/octet-stream',
        })
        .expect(400);

      expect(res.body.message).toContain('.csv');
    });

    it('rejects a CSV whose rows reference an unknown meter, importing nothing', async () => {
      const csv = 'meter_id,value,unit\nnot-a-real-meter,42,kWh\n';
      const res = await request(app.getHttpServer())
        .post('/api/meter-readings/upload')
        .set('x-role', 'Organization Admin')
        .attach('file', Buffer.from(csv), {
          filename: 'readings.csv',
          contentType: 'text/csv',
        })
        .expect(400);

      expect(res.body.message).toContain('nothing was imported');
    });

    it('rejects a forged file whose contents do not match its extension', async () => {
      // An .exe renamed to .pdf with a spoofed Content-Type passes the
      // extension and MIME checks. Only the leading bytes give it away.
      const fakePdf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // "MZ" = Windows executable
      const res = await request(app.getHttpServer())
        .post('/api/invoices/vvvv0000-0001-4000-8000-000000000000/document')
        .set('x-role', 'Financial Analyst')
        .attach('file', fakePdf, {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);

      expect(res.body.message).toContain('not a real PDF');
    });

    it('accepts a file whose contents genuinely match', async () => {
      const realPdf = Buffer.from('%PDF-1.4 content %%EOF');
      await request(app.getHttpServer())
        .post('/api/invoices/vvvv0000-0001-4000-8000-000000000000/document')
        .set('x-role', 'Financial Analyst')
        // This invoice belongs to org-001. Tenant scoping fails closed, so a
        // caller who is neither inside a tenant nor EnerTrack staff gets a 404
        // here, exactly as an outsider should.
        .set('x-org-id', 'org-001')
        .attach('file', realPdf, {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
    });

    it('rejects binary content disguised as a CSV', async () => {
      const binary = Buffer.alloc(300);
      binary[10] = 0x00; // a NUL byte — never present in a text file
      binary[11] = 0xff;
      const res = await request(app.getHttpServer())
        .post('/api/meter-readings/upload')
        .set('x-role', 'Organization Admin')
        .attach('file', binary, { filename: 'readings.csv', contentType: 'text/csv' })
        .expect(400);

      expect(res.body.message).toContain('binary data');
    });

    it('blocks an upload from a role without permission', async () => {
      await request(app.getHttpServer())
        .post('/api/meter-readings/upload')
        .set('x-role', 'Campus Visitor')
        .expect(403);
    });
  });
});
