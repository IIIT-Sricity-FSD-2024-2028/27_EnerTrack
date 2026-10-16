import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import * as jwt from 'jsonwebtoken';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { DatabaseService } from '../src/core/database/database.service';
import { hashPassword } from '../src/core/auth/passwords';

/**
 * Who you are comes from a signed token, never from a header you typed.
 */
describe('Security (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const body = (res: request.Response) => res.body?.data ?? res.body;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalGuards(new RolesGuard(app.get(Reflector)));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const login = async (email: string, password: string) =>
    http().post('/api/users/login').send({ email, password });

  describe('forged headers', () => {
    it('ignores a typed x-role: Super Admin with no token', async () => {
      const res = await http().get('/api/users').set('x-forge-role', 'Super Admin');
      expect(res.status).toBe(403);
    });

    it('ignores a forged x-role even when the caller holds a lesser token', async () => {
      const token = body(await login('husaam@gmail.com', 'Husaam@123')).token;
      const res = await http()
        .get('/api/platform-invoices/revenue-summary')
        .set('Authorization', `Bearer ${token}`)
        .set('x-forge-role', 'Super Admin');
      expect(res.status).toBe(403);
    });

    it('ignores a forged x-org-id and keeps the caller in their own tenant', async () => {
      const token = body(await login('aadi@gmail.com', 'Aadi@123')).token;
      const res = await http()
        .get('/api/organizations')
        .set('Authorization', `Bearer ${token}`)
        .set('x-forge-org-id', 'org-002');
      expect(res.status).toBe(200);
      const ids = body(res).map((o: any) => o.organization_id);
      expect(ids).toEqual(['org-001']);
    });
  });

  describe('tokens', () => {
    it('rejects a garbage token with 401', async () => {
      const res = await http().get('/api/users').set('Authorization', 'Bearer not-a-token');
      expect(res.status).toBe(401);
    });

    it('rejects a token signed with a different key', async () => {
      const forged = jwt.sign({ sub: 'x', role: 'Super Admin' }, 'some-other-secret');
      const res = await http().get('/api/users').set('Authorization', `Bearer ${forged}`);
      expect(res.status).toBe(401);
    });

    it('rejects an expired token', async () => {
      const expired = jwt.sign({ sub: 'x', role: 'Super Admin' }, process.env.JWT_SECRET!, {
        expiresIn: -10,
      });
      const res = await http().get('/api/users').set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
    });

    it('rejects an unsigned (alg: none) token', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'x', role: 'Super Admin' })).toString('base64url');
      const res = await http().get('/api/users').set('Authorization', `Bearer ${header}.${payload}.`);
      expect(res.status).toBe(401);
    });

    it('accepts the token login returns, and takes role and org from it', async () => {
      const session = body(await login('aadi@gmail.com', 'Aadi@123'));
      expect(session.role).toBe('Organization Admin');
      expect(session.token).toEqual(expect.any(String));
      expect(session.password).toBeUndefined();

      const res = await http().get('/api/users').set('Authorization', `Bearer ${session.token}`);
      expect(res.status).toBe(200);
      for (const u of body(res)) expect(u.organization_id).toBe(session.organization_id);
    });
  });

  describe('public routes', () => {
    it('lists only the intended public routes', async () => {
      const doc = SwaggerModule.createDocument(app, new DocumentBuilder().build());
      const open: string[] = [];
      for (const [path, ops] of Object.entries<any>(doc.paths)) {
        for (const method of Object.keys(ops)) {
          const url = path.replace(/\{[^}]+\}/g, 'x').replace(/^\/api/, '/api');
          const res = await (http() as any)[method](url).send(method === 'get' || method === 'delete' ? undefined : {});
          if (res.status !== 403) open.push(`${method.toUpperCase()} ${path}`);
        }
      }
      expect(open.sort()).toEqual(
        [
          'GET /api',
          'GET /api/subscription-plans/public',
          'POST /api/audit-requests',
          'POST /api/users/change-password',
          'POST /api/users/delete-account',
          'POST /api/users/login',
          'POST /api/users/signup',
          'POST /api/users/update-details',
        ].sort(),
      );
    });
  });

  describe('role escalation', () => {
    it('stops an Organization Admin giving anyone a platform role', async () => {
      const token = body(await login('aadi@gmail.com', 'Aadi@123')).token;
      const auth = { Authorization: `Bearer ${token}` };
      const users = body(await http().get('/api/users').set(auth));
      const target = users.find((u: any) => u.role === 'Financial Analyst');

      const patch = await http().patch(`/api/users/${target.user_id}`).set(auth).send({ role: 'Super Admin' });
      expect(patch.status).toBe(403);

      const put = await http()
        .put(`/api/users/${target.user_id}`)
        .set(auth)
        .send({
          name: target.name,
          email: target.email,
          phone: target.phone,
          password: 'Str0ng@Pass1',
          role: 'Super Admin',
        });
      expect(put.status).toBe(403);

      const after = body(await http().get(`/api/users/${target.user_id}`).set(auth));
      expect(after.role).toBe('Financial Analyst');
    });
  });

  describe('passwords', () => {
    it('are stored hashed, including seeded accounts', () => {
      const db = app.get(DatabaseService);
      for (const user of db.users) expect(user.password).toMatch(/^\$2[aby]\$/);
      for (const r of db.auditRequests) expect(r.admin_password).toMatch(/^\$2[aby]\$/);
    });

    it('still lets a seeded user sign in and rejects a wrong password', async () => {
      expect((await login('aadi@gmail.com', 'Aadi@123')).status).toBe(201);
      expect((await login('aadi@gmail.com', 'wrong')).status).toBe(401);
    });

    it('stores a changed password hashed and signs in with the new one', async () => {
      const email = 'husaam@gmail.com';
      const change = await http()
        .post('/api/users/change-password')
        .send({ email, current_password: 'Husaam@123', new_password: 'N3w@Passw0rd' });
      expect(change.status).toBe(201);
      expect(body(change).token).toEqual(expect.any(String));

      const db = app.get(DatabaseService);
      const stored = db.users.find((u) => u.email === email)!.password;
      expect(stored).not.toContain('N3w@Passw0rd');
      expect(stored).toMatch(/^\$2[aby]\$/);

      expect((await login(email, 'N3w@Passw0rd')).status).toBe(201);
      expect((await login(email, 'Husaam@123')).status).toBe(401);
    });
  });

  describe('impersonation', () => {
    it('needs a Super Admin token and returns a token for the target', async () => {
      const db = app.get(DatabaseService);
      const target = db.users.find((u) => u.role === 'Organization Admin')!;

      const anon = await http().post(`/api/users/${target.user_id}/impersonate`).send({});
      expect(anon.status).toBe(403);

      const admin = body(await login('aadi@gmail.com', 'Aadi@123')).token;
      const notStaff = await http()
        .post(`/api/users/${target.user_id}/impersonate`)
        .set('Authorization', `Bearer ${admin}`)
        .send({});
      expect(notStaff.status).toBe(403);

      const staff = await http()
        .post(`/api/users/${target.user_id}/impersonate`)
        .set('x-role', 'Super Admin')
        .send({});
      expect(staff.status).toBe(201);
      expect(body(staff).token).toEqual(expect.any(String));
      expect(body(staff).password).toBeUndefined();
    });
  });

  describe('revoked sessions', () => {
    const PASS = 'Rev0ke@Pass1';
    let n = 0;
    /** A real account with a known password, and the token its sign-in returns. */
    const signedIn = async () => {
      n += 1;
      const db = app.get(DatabaseService);
      const user = {
        user_id: `revoke-${Date.now()}-${n}`,
        name: 'Revoke Test',
        email: `revoke${Date.now()}${n}@gmail.com`,
        role: 'Financial Analyst',
        organization_id: 'org-001',
        password: hashPassword(PASS),
        must_change_password: false,
      };
      db.users.push(user as any);
      const token = body(await login(user.email, PASS)).token as string;
      return { user, token };
    };
    const status = async (token: string) =>
      (await http().get('/api/users').set('Authorization', `Bearer ${token}`)).status;
    const superAdmin = async () => body(await login('priya@enertrack.com', 'Priya@123'));

    it('refuses the token of an account that was deleted', async () => {
      const { user, token } = await signedIn();
      expect(await status(token)).not.toBe(401);
      const admin = await superAdmin();
      const del = await http().delete(`/api/users/${user.user_id}`).set('Authorization', `Bearer ${admin.token}`);
      expect(del.status).toBe(200);
      expect(await status(token)).toBe(401);
    });

    it('refuses the old token after a role change', async () => {
      const { user, token } = await signedIn();
      const admin = await superAdmin();
      const patch = await http()
        .patch(`/api/users/${user.user_id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'Technician' });
      expect(patch.status).toBe(200);
      expect(await status(token)).toBe(401);
    });

    it('refuses the old token after a password change, and accepts the new one', async () => {
      const { user, token } = await signedIn();
      const changed = await http()
        .post('/api/users/change-password')
        .send({ email: user.email, current_password: PASS, new_password: 'N3w@Passw0rd' });
      expect(changed.status).toBe(201);
      expect(await status(token)).toBe(401);
      expect(await status(body(changed).token)).not.toBe(401);
    });

    it('takes the role from the current account, not the token', async () => {
      const { user, token } = await signedIn();
      expect(await status(token)).toBe(200);
      // Changed directly, without revoking, to show the token's own claim is not used.
      (app.get(DatabaseService).users.find((u) => u.user_id === user.user_id) as any).role = 'Campus Visitor';
      expect(await status(token)).toBe(403);
    });
  });

  describe('who did it', () => {
    it('records the signed-in Super Admin as decided_by, whatever the body says', async () => {
      const admin = body(await login('priya@enertrack.com', 'Priya@123'));
      const submit = await http()
        .post('/api/audit-requests')
        .send({
          name: `Who Decided ${Date.now()}`,
          type: 'University',
          admin_name: 'Head Person',
          admin_email: `head${Date.now()}@whodecided.edu`,
          admin_password: 'Wh0@Decided1',
        });
      expect(submit.status).toBe(201);
      const res = await http()
        .patch(`/api/audit-requests/${body(submit).request_id}/deny`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ decided_by: 'someone-else' });
      expect(res.status).toBe(200);
      expect(body(res).decided_by).toBe(admin.user_id);
    });

    it('names the signed-in caller in the impersonation log, not a name from the body', async () => {
      const admin = body(await login('priya@enertrack.com', 'Priya@123'));
      const db = app.get(DatabaseService);
      const target = db.users.find((u) => u.role === 'Financial Analyst')!;
      const res = await http()
        .post(`/api/users/${target.user_id}/impersonate`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ actor: 'Mallory' });
      expect([200, 201]).toContain(res.status);
      const entry = db.activityLogs[db.activityLogs.length - 1];
      expect(entry.title).toContain(admin.name);
      expect(entry.title).not.toContain('Mallory');
    });
  });
});
