import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';

/**
 * Audit requests: an organisation asking to be taken on does not become an
 * organisation until a certified auditor approves. These tests cover the rules
 * around that gap: what a request can and cannot do, who may decide, and what
 * the person sees when they try to sign in.
 */
describe('Audit requests (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const body = (res: request.Response) => res.body?.data ?? res.body;
  const asAuditor = { 'x-role': 'Certified Energy Auditor' };
  const stamp = Date.now().toString().slice(-6);

  /** A fresh, valid request, different every call unless overridden. */
  let counter = 0;
  const payload = (override: Record<string, unknown> = {}) => {
    counter += 1;
    const domain = `request${stamp}${counter}.edu`;
    return {
      name: `Request ${stamp}${counter} Institute`,
      type: 'University',
      location: 'Hyderabad, Telangana',
      email_domain: domain,
      admin_name: 'Request Admin',
      admin_email: `admin@${domain}`,
      admin_password: 'Adm1n@Pass!',
      ...override,
    };
  };
  const submit = async (override: Record<string, unknown> = {}) => {
    const sent = payload(override);
    const res = await http().post('/api/audit-requests').send(sent);
    return { sent, res, id: body(res)?.request_id as string };
  };

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

  describe('submitting', () => {
    it('is public and answers with a pending receipt, not the record', async () => {
      const { res } = await submit();
      expect(res.status).toBe(201);
      const data = body(res);
      expect(data.status).toBe('pending');
      expect(data.admin_email).toBeUndefined();
      expect(data.admin_password).toBeUndefined();
    });

    it('refuses the same organisation name while one is still waiting', async () => {
      const first = await submit();
      const again = await submit({ name: first.sent.name });
      expect(again.res.status).toBe(409);
    });

    it('refuses the same email while a request from it is still waiting', async () => {
      const first = await submit();
      const again = await submit({ admin_email: first.sent.admin_email });
      expect(again.res.status).toBe(409);
    });

    it('refuses an email that already has an account', async () => {
      const res = await http()
        .post('/api/audit-requests')
        .send(payload({ admin_email: 'aadi@gmail.com', email_domain: undefined }));
      expect(res.status).toBe(409);
    });

    it('refuses the name of an organisation that already exists', async () => {
      const orgs = await http().get('/api/organizations').set({ 'x-role': 'Super Admin' });
      const existing = body(orgs)[0].name;
      const { res } = await submit({ name: existing });
      expect(res.status).toBe(409);
    });
  });

  describe('the auditor’s list', () => {
    it('shows pending requests, newest first, without any password', async () => {
      const first = await submit();
      const second = await submit();
      const res = await http().get('/api/audit-requests?status=pending').set(asAuditor);
      expect(res.status).toBe(200);
      const rows: any[] = body(res);
      const ids = rows.map((r) => r.request_id);
      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
      expect(rows.every((r) => r.admin_password === undefined)).toBe(true);
      expect(rows.every((r) => r.status === 'pending')).toBe(true);
    });

    it('rejects a status that does not exist', async () => {
      const res = await http().get('/api/audit-requests?status=banana').set(asAuditor);
      expect(res.status).toBe(400);
    });

    it('lets a Super Admin read it too, but nobody else', async () => {
      expect((await http().get('/api/audit-requests').set({ 'x-role': 'Super Admin' })).status).toBe(200);
      for (const role of ['Organization Admin', 'Technician', 'Financial Analyst', 'Campus Visitor']) {
        expect((await http().get('/api/audit-requests').set({ 'x-role': role })).status).toBe(403);
      }
    });
  });

  describe('denying', () => {
    it('creates nothing and tells the requester why when they try to sign in', async () => {
      const { sent, id } = await submit();
      const denied = await http()
        .patch(`/api/audit-requests/${id}/deny`)
        .set(asAuditor)
        .send({ note: 'We do not cover your region yet' });
      expect(denied.status).toBe(200);
      expect(body(denied).status).toBe('denied');
      expect(body(denied).organization_id).toBeNull();

      const orgs = await http().get('/api/organizations').set({ 'x-role': 'Super Admin' });
      expect(JSON.stringify(body(orgs))).not.toContain(sent.name);

      const login = await http()
        .post('/api/users/login')
        .send({ email: sent.admin_email, password: sent.admin_password });
      expect(login.status).toBe(403);
      expect(login.body.message).toContain('not approved');
      expect(login.body.message).toContain('We do not cover your region yet');
    });

    it('can be decided only once', async () => {
      const { id } = await submit();
      await http().patch(`/api/audit-requests/${id}/deny`).set(asAuditor).send({});
      expect((await http().patch(`/api/audit-requests/${id}/deny`).set(asAuditor).send({})).status).toBe(409);
      expect((await http().patch(`/api/audit-requests/${id}/approve`).set(asAuditor).send({})).status).toBe(409);
    });

    it('lets the same organisation ask again after a denial', async () => {
      const first = await submit();
      await http().patch(`/api/audit-requests/${first.id}/deny`).set(asAuditor).send({});
      const again = await submit({
        name: first.sent.name,
        admin_email: first.sent.admin_email,
        email_domain: first.sent.email_domain,
      });
      expect(again.res.status).toBe(201);
    });
  });

  describe('approving', () => {
    it('creates the organisation as a prospect and an admin who can then sign in', async () => {
      const { sent, id } = await submit();
      const res = await http().patch(`/api/audit-requests/${id}/approve`).set(asAuditor).send({});
      expect(res.status).toBe(200);
      const data = body(res);
      expect(data.organization.name).toBe(sent.name);
      expect(data.organization.status).toBe('prospect');
      expect(data.admin.role).toBe('Organization Admin');
      expect(data.admin.password).toBeUndefined();
      expect(data.request.admin_password).toBeUndefined();

      const login = await http()
        .post('/api/users/login')
        .send({ email: sent.admin_email, password: sent.admin_password });
      expect(login.status).toBe(201);
      expect(body(login).role).toBe('Organization Admin');
      expect(body(login).organization_id).toBe(data.organization.organization_id);
    });

    it('stays pending, and can still be denied, if the name was taken in the meantime', async () => {
      const first = await submit();
      // Someone creates the organisation directly (Super Admin) before the auditor decides.
      const direct = await http()
        .post('/api/organizations')
        .set({ 'x-role': 'Super Admin' })
        .send({ name: first.sent.name, type: 'University', status: 'prospect' });
      expect(direct.status).toBe(201);

      const approve = await http().patch(`/api/audit-requests/${first.id}/approve`).set(asAuditor).send({});
      expect(approve.status).toBe(409);

      const list = await http().get('/api/audit-requests?status=pending').set(asAuditor);
      expect(body(list).some((r: any) => r.request_id === first.id)).toBe(true);
      expect((await http().patch(`/api/audit-requests/${first.id}/deny`).set(asAuditor).send({})).status).toBe(200);
    });

    it('is refused for anyone but an auditor or Super Admin', async () => {
      const { id } = await submit();
      for (const role of ['Organization Admin', 'Technician', 'Campus Visitor']) {
        expect(
          (await http().patch(`/api/audit-requests/${id}/approve`).set({ 'x-role': role }).send({})).status,
        ).toBe(403);
      }
      expect((await http().patch(`/api/audit-requests/${id}/approve`).send({})).status).toBe(403);
    });

    it('returns 404 for a request that does not exist', async () => {
      expect((await http().patch('/api/audit-requests/nope/approve').set(asAuditor).send({})).status).toBe(404);
    });
  });
});
