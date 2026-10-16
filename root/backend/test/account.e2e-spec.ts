import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';

/**
 * "My account": a person changing their own details or deleting their own
 * account, and who may give someone an EnerTrack staff role.
 */
describe('My account (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const stamp = Date.now().toString().slice(-6);
  const body = (res: request.Response) => res.body?.data ?? res.body;

  const asOrgAdmin = (orgId: string) => ({ 'x-role': 'Organization Admin', 'x-org-id': orgId });
  const asSuperAdmin = { 'x-role': 'Super Admin' };
  const asAuditor = { 'x-role': 'Certified Energy Auditor' };

  const PASS = 'Acc0unt@Pass1';
  let nextPhone = 9100000000 + Number(stamp);
  const newPhone = () => String(nextPhone++);

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

  /** An organisation with exactly one Organization Admin, made the real way: request, then approval. */
  async function newOrganisation(tag: string) {
    const adminEmail = `head@${tag}${stamp}.edu`;
    const submit = await http()
      .post('/api/audit-requests')
      .send({
        name: `Account Test ${tag} ${stamp}`,
        type: 'University',
        location: 'Hyderabad, Telangana',
        email_domain: `${tag}${stamp}.edu`,
        admin_name: 'Head Person',
        admin_email: adminEmail,
        admin_password: PASS,
      });
    expect(submit.status).toBe(201);
    const approved = await http()
      .patch(`/api/audit-requests/${body(submit).request_id}/approve`)
      .set(asAuditor)
      .send({});
    expect(approved.status).toBe(200);
    return { orgId: body(approved).organization.organization_id as string, adminEmail };
  }

  /** A staff account made by the organisation's admin, with a known password. */
  async function newStaff(orgId: string, email: string, role = 'Financial Analyst') {
    const res = await http()
      .post('/api/users')
      .set(asOrgAdmin(orgId))
      .send({ name: 'Staff Person', email, phone: newPhone(), password: PASS, role });
    expect(res.status).toBe(201);
    return body(res);
  }

  const signIn = (email: string, password = PASS) =>
    http().post('/api/users/login').send({ email, password });

  describe('update-details', () => {
    let orgId: string;
    const email = `edit${stamp}@editorg${stamp}.edu`;
    beforeAll(async () => {
      orgId = (await newOrganisation('editorg')).orgId;
      await newStaff(orgId, email);
    });

    it('changes the name and phone, and returns no password', async () => {
      const phone = newPhone();
      const res = await http()
        .post('/api/users/update-details')
        .send({ email, current_password: PASS, name: 'Renamed Person', phone });
      expect(res.status).toBe(201);
      expect(body(res).name).toBe('Renamed Person');
      expect(body(res).phone).toBe(phone);
      expect(body(res).password).toBeUndefined();
      expect(body(res).role).toBe('Financial Analyst');

      // The change is real: signing in again shows it.
      expect(body(await signIn(email)).name).toBe('Renamed Person');
    });

    it('allows a blank phone, which clears it', async () => {
      const res = await http()
        .post('/api/users/update-details')
        .send({ email, current_password: PASS, name: 'Renamed Person', phone: '' });
      expect(res.status).toBe(201);
      expect(body(res).phone).toBeUndefined();
    });

    it('refuses the wrong current password', async () => {
      const res = await http()
        .post('/api/users/update-details')
        .send({ email, current_password: 'Wr0ng@Pass99', name: 'Hacked Name' });
      expect(res.status).toBe(401);
      expect(body(await signIn(email)).name).toBe('Renamed Person');
    });

    it('rejects a bad name and a bad phone', async () => {
      const badName = await http()
        .post('/api/users/update-details')
        .send({ email, current_password: PASS, name: '1bad' });
      expect(badName.status).toBe(400);
      const badPhone = await http()
        .post('/api/users/update-details')
        .send({ email, current_password: PASS, name: 'Fine Name', phone: '123' });
      expect(badPhone.status).toBe(400);
    });

    it('refuses a phone number that belongs to someone else', async () => {
      const other = await newStaff(orgId, `other${stamp}@editorg${stamp}.edu`);
      const res = await http()
        .post('/api/users/update-details')
        .send({ email, current_password: PASS, name: 'Fine Name', phone: other.phone });
      expect(res.status).toBe(409);
    });

    it('cannot be used to change role or organisation', async () => {
      const role = await http()
        .post('/api/users/update-details')
        .send({ email, current_password: PASS, name: 'Fine Name', role: 'Super Admin' });
      expect(role.status).toBe(400);
      const org = await http()
        .post('/api/users/update-details')
        .send({ email, current_password: PASS, name: 'Fine Name', organization_id: 'org-001' });
      expect(org.status).toBe(400);
    });
  });

  describe('delete-account', () => {
    it('deletes the account after the password is confirmed', async () => {
      const { orgId } = await newOrganisation('delorg');
      const email = `gone${stamp}@delorg${stamp}.edu`;
      await newStaff(orgId, email);

      const wrong = await http()
        .post('/api/users/delete-account')
        .send({ email, password: 'Wr0ng@Pass99' });
      expect(wrong.status).toBe(401);
      expect((await signIn(email)).status).toBe(201);

      const res = await http().post('/api/users/delete-account').send({ email, password: PASS });
      expect(res.status).toBe(201);
      expect(body(res).deleted).toBe(true);
      expect((await signIn(email)).status).toBe(401);
    });

    it("refuses the organisation's only Organization Admin, until someone else holds the role", async () => {
      const { orgId, adminEmail } = await newOrganisation('soleorg');

      const blocked = await http()
        .post('/api/users/delete-account')
        .send({ email: adminEmail, password: PASS });
      expect(blocked.status).toBe(409);
      expect(blocked.body.message).toMatch(/only Organization Admin/);
      expect((await signIn(adminEmail)).status).toBe(201);

      await newStaff(orgId, `second${stamp}@soleorg${stamp}.edu`, 'Organization Admin');
      const allowed = await http()
        .post('/api/users/delete-account')
        .send({ email: adminEmail, password: PASS });
      expect(allowed.status).toBe(201);
    });

    it('refuses the only Super Admin and the only Certified Energy Auditor', async () => {
      const superAdmin = await http()
        .post('/api/users/delete-account')
        .send({ email: 'priya@enertrack.com', password: 'Priya@123' });
      expect(superAdmin.status).toBe(409);
      const auditor = await http()
        .post('/api/users/delete-account')
        .send({ email: 'arun@enertrack.com', password: 'Arun@123' });
      expect(auditor.status).toBe(409);
    });
  });

  describe('who may give the Certified Energy Auditor role', () => {
    let orgId: string;
    let staff: any;
    beforeAll(async () => {
      orgId = (await newOrganisation('roleorg')).orgId;
      staff = await newStaff(orgId, `role${stamp}@roleorg${stamp}.edu`);
    });

    it('an Organization Admin cannot create one', async () => {
      const res = await http()
        .post('/api/users')
        .set(asOrgAdmin(orgId))
        .send({
          name: 'Sneaky Auditor',
          email: `sneaky${stamp}@roleorg${stamp}.edu`,
          phone: newPhone(),
          password: PASS,
          role: 'Certified Energy Auditor',
        });
      expect(res.status).toBe(403);
    });

    it('an Organization Admin cannot promote a staff member with PATCH', async () => {
      const res = await http()
        .patch(`/api/users/${staff.user_id}`)
        .set(asOrgAdmin(orgId))
        .send({ role: 'Certified Energy Auditor' });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Only EnerTrack staff/);
    });

    it('an Organization Admin cannot promote a staff member with PUT', async () => {
      const res = await http()
        .put(`/api/users/${staff.user_id}`)
        .set(asOrgAdmin(orgId))
        .send({
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          password: PASS,
          role: 'Certified Energy Auditor',
        });
      expect(res.status).toBe(403);
    });

    it('an Organization Admin cannot import one either', async () => {
      const res = await http()
        .post('/api/users/bulk')
        .set(asOrgAdmin(orgId))
        .send({
          users: [
            {
              name: 'Bulk Auditor',
              email: `bulk${stamp}@roleorg${stamp}.edu`,
              phone: newPhone(),
              role: 'Certified Energy Auditor',
            },
          ],
        });
      expect(res.status).toBe(201);
      expect(body(res)[0].ok).toBe(false);
    });

    it('the staff member is unchanged after all of that', async () => {
      const res = await http().get(`/api/users/${staff.user_id}`).set(asOrgAdmin(orgId));
      expect(body(res).role).toBe('Financial Analyst');
    });

    it('an Organization Admin can still change a staff member to an ordinary role', async () => {
      const res = await http()
        .patch(`/api/users/${staff.user_id}`)
        .set(asOrgAdmin(orgId))
        .send({ role: 'Sustainability Officer' });
      expect(res.status).toBe(200);
      expect(body(res).role).toBe('Sustainability Officer');
    });

    it('a Super Admin can give the role', async () => {
      const res = await http()
        .patch(`/api/users/${staff.user_id}`)
        .set(asSuperAdmin)
        .send({ role: 'Certified Energy Auditor' });
      expect(res.status).toBe(200);
      expect(body(res).role).toBe('Certified Energy Auditor');
    });
  });
});
