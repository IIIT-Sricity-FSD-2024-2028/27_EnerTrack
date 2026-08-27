import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
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

  const readLog = (name: string): string => {
    const file = path.join(logDir, name);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
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
        .set('x-role', 'System Administrator')
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
        .set('x-role', 'System Administrator')
        .send({ vendor: '<script>alert(1)</script>' })
        .expect(400);

      expect(res.body.message).toContain('malicious content');
    });

    it('blocks a javascript: URI in a query string', async () => {
      await request(app.getHttpServer())
        .get('/api/invoices?search=javascript:alert(1)')
        .set('x-role', 'System Administrator')
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
        .set('x-role', 'System Administrator')
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
        .set('x-role', 'System Administrator')
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
        .set('x-role', 'System Administrator')
        .expect(200);

      const log = readLog(`custom-debug-${today}.log`);
      expect(log).toContain('INCOMING REQUEST');
      expect(log).toContain('/api/invoices');
      expect(log).toContain('SUCCESS RESPONSE');
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
        .set('x-role', 'System Administrator')
        .expect(400);

      expect(res.body.message).toContain('No file was uploaded');
    });

    it('rejects a non-CSV file', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/meter-readings/upload')
        .set('x-role', 'System Administrator')
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
        .set('x-role', 'System Administrator')
        .attach('file', Buffer.from(csv), {
          filename: 'readings.csv',
          contentType: 'text/csv',
        })
        .expect(400);

      expect(res.body.message).toContain('nothing was imported');
    });

    it('blocks an upload from a role without permission', async () => {
      await request(app.getHttpServer())
        .post('/api/meter-readings/upload')
        .set('x-role', 'Campus Visitor')
        .expect(403);
    });
  });
});
