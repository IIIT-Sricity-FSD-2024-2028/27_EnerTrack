import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';

/**
 * Onboarding: organisations register themselves, everyone else is created by
 * their Organization Admin, and the first sign-in replaces the issued
 * password.
 */
describe('Auth & onboarding (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const stamp = Date.now().toString().slice(-6);
  const domain = `campus${stamp}.edu`;
  const adminEmail = `head@${domain}`;
  const adminPassword = 'Adm1n@Pass!';
  let orgId: string;
  const asAdmin = () => ({ 'x-role': 'Organization Admin', 'x-org-id': orgId });

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

  const body = (res: request.Response) => res.body?.data ?? res.body;

  describe('public surface', () => {
    it('has no public self sign-up for people', async () => {
      const res = await http().post('/api/users/register').send({});
      expect(res.status).toBe(404);
    });

    it('does not list organisations publicly', async () => {
      const res = await http().get('/api/organizations/public');
      // "public" now falls through to the :id route, which needs a role.
      expect([401, 403, 404]).toContain(res.status);
    });
  });

  describe('organisation registration', () => {
    const payload = () => ({
      name: `Campus ${stamp} College`,
      type: 'University',
      location: 'Sri City, Andhra Pradesh',
      email_domain: domain,
      admin_name: 'Head Admin',
      admin_email: adminEmail,
      admin_password: adminPassword,
      admin_phone: '9876543210',
    });

    it.each([
      ['name', { name: '!!' }],
      ['type', { type: '123' }],
      ['email_domain', { email_domain: 'https://x.edu' }],
      ['admin_name', { admin_name: '1bad' }],
      ['admin_email', { admin_email: 'not-an-email' }],
      ['admin_password', { admin_password: 'weakpass' }],
      ['admin_phone', { admin_phone: '12345' }],
    ])('rejects an invalid %s', async (_field, override) => {
      const res = await http().post('/api/organizations/register').send({ ...payload(), ...override });
      expect(res.status).toBe(400);
    });

    it('rejects a public mailbox provider as the organisation domain', async () => {
      const res = await http()
        .post('/api/organizations/register')
        .send({ ...payload(), email_domain: 'gmail.com', admin_email: 'x@gmail.com' });
      expect(res.status).toBe(400);
    });

    it("requires the admin's email to use the organisation domain", async () => {
      const res = await http()
        .post('/api/organizations/register')
        .send({ ...payload(), admin_email: 'head@other.edu' });
      expect(res.status).toBe(400);
    });

    it('creates the organisation and its admin', async () => {
      const res = await http().post('/api/organizations/register').send(payload());
      expect(res.status).toBe(201);
      const data = body(res);
      orgId = data.organization.organization_id;
      expect(data.admin.role).toBe('Organization Admin');
      expect(data.admin.password).toBeUndefined();
    });

    it('refuses a second organisation on the same domain', async () => {
      const res = await http()
        .post('/api/organizations/register')
        .send({ ...payload(), name: `Another ${stamp} College`, admin_email: `x@${domain}` });
      expect(res.status).toBe(409);
    });
  });

  describe('admin-created accounts', () => {
    const issued: Record<string, string> = {};

    it('rejects an email outside the organisation domain', async () => {
      const res = await http()
        .post('/api/users')
        .set(asAdmin())
        .send({ name: 'Wrong Domain', email: 'a@elsewhere.com', password: 'Str0ng@Pass1', role: 'Technician' });
      expect(res.status).toBe(400);
    });

    it('rejects a weak password and bad fields', async () => {
      const res = await http()
        .post('/api/users')
        .set(asAdmin())
        .send({ name: 'Weak One', email: `weak@${domain}`, password: 'password', role: 'Technician' });
      expect(res.status).toBe(400);
    });

    it('creates a staff user flagged for a first-login password change', async () => {
      const res = await http()
        .post('/api/users')
        .set(asAdmin())
        .send({ name: 'Tess Tech', email: `tess@${domain}`, password: 'Temp@Pass12', role: 'Technician' });
      expect(res.status).toBe(201);
      expect(body(res).must_change_password).toBe(true);
      expect(body(res).organization_id).toBe(orgId);
      issued.email = `tess@${domain}`;
      issued.password = 'Temp@Pass12';
    });

    it('bulk-creates visitors, issues passwords and reports bad rows', async () => {
      const res = await http()
        .post('/api/users/bulk')
        .set(asAdmin())
        .send({
          users: [
            { name: 'Stu Dent', email: `stu@${domain}`, role: 'Campus Visitor' },
            { name: 'Fac Ulty', email: `fac@${domain}`, role: 'Campus Visitor', phone: '9123456780' },
            { name: 'Off Domain', email: 'x@elsewhere.com', role: 'Campus Visitor' },
            { name: 'Stu Dent', email: `stu@${domain}`, role: 'Campus Visitor' },
          ],
        });
      expect(res.status).toBe(201);
      const rows = body(res);
      expect(rows.map((r: any) => r.ok)).toEqual([true, true, false, false]);
      expect(rows[0].password).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,32}$/);

      const login = await http().post('/api/users/login').send({ email: rows[0].email, password: rows[0].password });
      expect(login.status).toBe(201);
      expect(body(login).role).toBe('Campus Visitor');
    });

    it('does not let a non-admin bulk create', async () => {
      const res = await http()
        .post('/api/users/bulk')
        .set({ 'x-role': 'Technician', 'x-org-id': orgId })
        .send({ users: [{ name: 'No Way', email: `no@${domain}`, role: 'Technician' }] });
      expect(res.status).toBe(403);
    });

    it('rejects invalid bulk payloads', async () => {
      const res = await http()
        .post('/api/users/bulk')
        .set(asAdmin())
        .send({ users: [{ name: '9', email: 'bad', role: 'Technician' }] });
      expect(res.status).toBe(400);
    });

    it('forces a password change on first sign-in, then clears the flag', async () => {
      const login = await http().post('/api/users/login').send({ email: issued.email, password: issued.password });
      expect(body(login).must_change_password).toBe(true);

      const wrong = await http()
        .post('/api/users/change-password')
        .send({ email: issued.email, current_password: 'Nope@Nope12', new_password: 'Fresh@Pass99' });
      expect(wrong.status).toBe(401);

      const same = await http()
        .post('/api/users/change-password')
        .send({ email: issued.email, current_password: issued.password, new_password: issued.password });
      expect(same.status).toBe(400);

      const weak = await http()
        .post('/api/users/change-password')
        .send({ email: issued.email, current_password: issued.password, new_password: 'short' });
      expect(weak.status).toBe(400);

      const ok = await http()
        .post('/api/users/change-password')
        .send({ email: issued.email, current_password: issued.password, new_password: 'Fresh@Pass99' });
      expect(ok.status).toBe(201);
      expect(body(ok).must_change_password).toBe(false);

      const again = await http().post('/api/users/login').send({ email: issued.email, password: 'Fresh@Pass99' });
      expect(body(again).must_change_password).toBe(false);
      const old = await http().post('/api/users/login').send({ email: issued.email, password: issued.password });
      expect(old.status).toBe(401);
    });
  });

  describe('campus visitor self sign-up', () => {
    const visitor = () => ({
      name: 'Stu Dent',
      email: `student@${domain}`,
      phone: '9812345670',
      password: 'Stud3nt@Pass',
    });

    it('rejects an email whose domain belongs to no organisation', async () => {
      const res = await http()
        .post('/api/users/signup')
        .send({ ...visitor(), email: 'student@unknown-campus.edu' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not linked to an organisation/);
    });

    it('does not let the caller choose a role or organisation', async () => {
      const res = await http()
        .post('/api/users/signup')
        .send({ ...visitor(), role: 'Super Admin', organization_id: 'org-001' });
      expect(res.status).toBe(400);
    });

    it.each([
      ['name', { name: '9' }],
      ['email', { email: 'bad' }],
      ['phone', { phone: '123' }],
      ['password', { password: 'weak' }],
    ])('rejects an invalid %s', async (_f, override) => {
      const res = await http().post('/api/users/signup').send({ ...visitor(), ...override });
      expect(res.status).toBe(400);
    });

    it('creates a Campus Visitor in the organisation that owns the domain', async () => {
      const res = await http().post('/api/users/signup').send(visitor());
      expect(res.status).toBe(201);
      const user = body(res);
      expect(user.role).toBe('Campus Visitor');
      expect(user.organization_id).toBe(orgId);
      expect(user.must_change_password).toBe(false);
      expect(user.password).toBeUndefined();

      const login = await http()
        .post('/api/users/login')
        .send({ email: visitor().email, password: visitor().password });
      expect(login.status).toBe(201);
    });

    it('refuses a repeat sign-up with the same email', async () => {
      const res = await http().post('/api/users/signup').send(visitor());
      expect(res.status).toBe(409);
    });
  });

  describe('login', () => {
    it('validates the payload shape', async () => {
      const res = await http().post('/api/users/login').send({ email: 'nope', password: '' });
      expect(res.status).toBe(400);
    });

    it('signs the new organisation admin in', async () => {
      const res = await http().post('/api/users/login').send({ email: adminEmail, password: adminPassword });
      expect(res.status).toBe(201);
      expect(body(res).role).toBe('Organization Admin');
      expect(body(res).must_change_password).toBe(false);
    });
  });
});
