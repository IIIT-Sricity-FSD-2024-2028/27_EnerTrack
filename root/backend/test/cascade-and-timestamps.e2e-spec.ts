import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { signToken } from '../src/core/auth/token';

/**
 * 1. Deleting a campus takes its buildings, their departments and meters with
 *    it; deleting a building takes its departments and meters. (The delete
 *    confirmation in the app has always said so.) Nothing else is touched.
 * 2. Every notification gets a server-set created_at, so lists can be
 *    ordered newest first.
 */
describe('Infrastructure cascade delete + notification timestamps (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const asOrgAdmin = { 'x-role': 'Organization Admin', 'x-org-id': 'org-001' };
  const body = (res: request.Response) => res.body?.data ?? res.body;
  const stamp = Date.now().toString().slice(-6);
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

  const create = async (path: string, payload: object) => {
    const res = await http().post(`/api/${path}`).set(asOrgAdmin).send(payload);
    expect(res.status).toBe(201);
    return body(res);
  };
  const ids = async (path: string, key: string) =>
    body(await http().get(`/api/${path}`).set(asOrgAdmin)).map((r: any) => r[key]);

  /** A building with one department and one meter; returns all three ids. */
  const buildingWithChildren = async (campusId: string, n: number) => {
    const building = await create('buildings', { campus_id: campusId, name: `Cascade B${n} ${stamp}` });
    const dept = await create('departments', { building_id: building.building_id, name: `Cascade D${n} ${stamp}` });
    const meter = await create('meters', {
      building_id: building.building_id,
      meter_code: `CASC-${stamp}-${n}`,
      meter_type: 'electricity',
      status: 'active',
    });
    return { buildingId: building.building_id, deptId: dept.department_id, meterId: meter.meter_id };
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

  describe('cascade delete', () => {
    let campusId: string;
    let countsBefore: { buildings: number; departments: number; meters: number };

    beforeAll(async () => {
      countsBefore = {
        buildings: (await ids('buildings', 'building_id')).length,
        departments: (await ids('departments', 'department_id')).length,
        meters: (await ids('meters', 'meter_id')).length,
      };
      campusId = (await create('campus', { name: `Cascade Campus ${stamp}`, total_budget: 0 })).campus_id;
    });

    it("deleting a building removes its departments and meters, and nothing else", async () => {
      const keep = await buildingWithChildren(campusId, 1);
      const gone = await buildingWithChildren(campusId, 2);

      const res = await http().delete(`/api/buildings/${gone.buildingId}`).set(asOrgAdmin);
      expect(res.status).toBe(200);

      expect(await ids('buildings', 'building_id')).not.toContain(gone.buildingId);
      expect(await ids('departments', 'department_id')).not.toContain(gone.deptId);
      expect(await ids('meters', 'meter_id')).not.toContain(gone.meterId);
      // The sibling building and its children are untouched
      expect(await ids('buildings', 'building_id')).toContain(keep.buildingId);
      expect(await ids('departments', 'department_id')).toContain(keep.deptId);
      expect(await ids('meters', 'meter_id')).toContain(keep.meterId);
    });

    it('deleting a campus removes its buildings, their departments and meters', async () => {
      const res = await http().delete(`/api/campus/${campusId}`).set(asOrgAdmin);
      expect(res.status).toBe(200);

      // Back to exactly what the seed had: everything this test added is gone,
      // and no seeded building, department or meter went with it.
      expect((await ids('buildings', 'building_id')).length).toBe(countsBefore.buildings);
      expect((await ids('departments', 'department_id')).length).toBe(countsBefore.departments);
      expect((await ids('meters', 'meter_id')).length).toBe(countsBefore.meters);
    });

    it('still refuses a campus that does not exist', async () => {
      const res = await http().delete('/api/campus/no-such-campus').set(asOrgAdmin);
      expect(res.status).toBe(404);
    });
  });

  describe('notification timestamps', () => {
    const AADI = '550e8400-0001-4000-8000-000000000001';

    it('POST /notifications sets created_at and is_read: false', async () => {
      const before = Date.now();
      const n = await create('notifications', {
        user_id: AADI,
        target_type: 'report',
        target_id: 'x',
        message: `Timestamp test ${stamp}`,
      });
      expect(n.created_at).toMatch(ISO);
      expect(Date.parse(n.created_at)).toBeGreaterThanOrEqual(before - 1000);
      expect(n.is_read).toBe(false);
    });

    it('a client cannot set created_at itself', async () => {
      const res = await http()
        .post('/api/notifications')
        .set(asOrgAdmin)
        .send({ user_id: AADI, target_type: 'report', target_id: 'x', message: 'x', created_at: '2000-01-01T00:00:00Z' });
      expect(res.status).toBe(400);
    });

    it('PUT keeps the original created_at', async () => {
      const n = await create('notifications', { user_id: AADI, target_type: 'report', target_id: 'x', message: 'before' });
      const res = await http()
        .put(`/api/notifications/${n.notification_id}`)
        .set(asOrgAdmin)
        .send({ user_id: AADI, target_type: 'report', target_id: 'x', message: 'after', is_read: false });
      expect(res.status).toBe(200);
      expect(body(res).created_at).toBe(n.created_at);
    });

    it("notifications the server sends itself (audit request → auditor) carry created_at", async () => {
      const res = await http().post('/api/energy-audits/request').set(asOrgAdmin).send({ note: `ts ${stamp}` });
      expect([200, 201]).toContain(res.status);

      // Read the auditor's own bell, signed in as the seeded auditor (Arun).
      const arun = signToken({ user_id: '550e8400-00f2-4000-8000-0000000000f2', role: 'Certified Energy Auditor', organization_id: null });
      const mine = body(await http().get('/api/notifications/mine').set('Authorization', `Bearer ${arun}`));
      expect(mine.length).toBeGreaterThan(0);
      for (const n of mine) expect(n.created_at).toMatch(ISO);
    });
  });
});
