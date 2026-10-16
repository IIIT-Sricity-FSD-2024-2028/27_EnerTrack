import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';

/**
 * Deleting an organisation takes its user accounts with it, so none are left
 * orphaned. An organisation that still owns campuses still cannot be deleted.
 */
describe('Organisations: delete (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const asSuperAdmin = { 'x-role': 'Super Admin' };
  const body = (res: request.Response) => res.body?.data ?? res.body;
  const stamp = Date.now().toString().slice(-6);

  /** Creates an organisation and returns its id. */
  const createOrg = async (name: string) => {
    const res = await http()
      .post('/api/organizations')
      .set(asSuperAdmin)
      .send({ name, type: 'University', status: 'prospect' });
    expect(res.status).toBe(201);
    return body(res).organization_id as string;
  };

  /** Creates a user in an organisation and returns its id. */
  const createUser = async (orgId: string, n: number) => {
    const res = await http()
      .post('/api/users')
      .set(asSuperAdmin)
      .send({
        name: `Test User ${n}`,
        email: `delete.test${stamp}.${n}@example.com`,
        phone: `91${stamp}${String(n).padStart(2, '0')}`,
        role: 'Financial Analyst',
        organization_id: orgId,
        password: 'Str0ng@Pass',
      });
    expect(res.status).toBe(201);
    return body(res).user_id as string;
  };

  const userIds = async () =>
    body(await http().get('/api/users').set(asSuperAdmin)).map((u: any) => u.user_id);

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

  it("deletes the organisation's users with it", async () => {
    const orgId = await createOrg(`Delete Test Org ${stamp}`);
    const first = await createUser(orgId, 1);
    const second = await createUser(orgId, 2);

    const res = await http().delete(`/api/organizations/${orgId}`).set(asSuperAdmin);
    expect(res.status).toBe(200);

    const left = await userIds();
    expect(left).not.toContain(first);
    expect(left).not.toContain(second);
  });

  it("leaves other organisations' users alone", async () => {
    const before = (await userIds()).length;
    const orgId = await createOrg(`Delete Test Org B ${stamp}`);
    await createUser(orgId, 3);

    await http().delete(`/api/organizations/${orgId}`).set(asSuperAdmin);

    // The one user added above is gone again; everyone else is still there
    expect((await userIds()).length).toBe(before);
    expect(await userIds()).toContain('550e8400-0006-4000-8000-000000000006'); // Trishank, org-001
  });

  it('deletes an organisation that has no users', async () => {
    const orgId = await createOrg(`Delete Test Org C ${stamp}`);
    const res = await http().delete(`/api/organizations/${orgId}`).set(asSuperAdmin);
    expect(res.status).toBe(200);
  });

  it('still refuses an organisation that owns campuses, and keeps its users', async () => {
    const before = await userIds();
    const res = await http().delete('/api/organizations/org-001').set(asSuperAdmin);
    expect(res.status).toBe(409);
    expect(await userIds()).toEqual(before);
  });
});
