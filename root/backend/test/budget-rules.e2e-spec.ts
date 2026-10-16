import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';

/**
 * Budgets nest: a campus's buildings may hold at most the campus budget, and
 * a building's departments at most the building budget. See
 * src/core/utils/budget-rules.ts.
 *
 * Tests run in order against one seeded database. Seed state they rely on:
 *   Campus 1  ₹12,00,000, buildings hold ₹12,00,000 (full)
 *   Campus 2  ₹20,00,000, buildings hold ₹18,50,000
 *   Building 2 ₹4,00,000, departments hold ₹3,50,000
 */
describe('Infrastructure: budget rules (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const asAdmin = { 'x-role': 'Organization Admin', 'x-org-id': 'org-001' };
  const asStaff = { 'x-role': 'Super Admin' };
  const body = (res: request.Response) => res.body?.data ?? res.body;

  const CAMPUS_1 = '660e8700-0001-4000-8000-000000000000';
  const CAMPUS_2 = '660e8700-0002-4000-8000-000000000000';
  const BUILDING_2 = '660e8800-0002-4000-8000-000000000000'; // Campus 1, ₹4L
  const BUILDING_3 = '660e8800-0003-4000-8000-000000000000'; // Campus 2, ₹6L

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

  it('starts from seed data that already obeys the rules', async () => {
    const campuses = body(await http().get('/api/campus').set(asStaff));
    const buildings = body(await http().get('/api/buildings').set(asStaff));
    const departments = body(await http().get('/api/departments').set(asStaff));
    const sum = (list: any[]) => list.reduce((s, x) => s + (x.budget ?? 0), 0);

    for (const c of campuses)
      expect(sum(buildings.filter((b: any) => b.campus_id === c.campus_id)))
        .toBeLessThanOrEqual(c.total_budget);
    for (const b of buildings.filter((x: any) => x.budget != null))
      expect(sum(departments.filter((d: any) => d.building_id === b.building_id)))
        .toBeLessThanOrEqual(b.budget);
  });

  describe('buildings', () => {
    it('rejects a building larger than what its campus has left', async () => {
      const res = await http()
        .post('/api/buildings')
        .set(asAdmin)
        .send({ campus_id: CAMPUS_1, name: 'Overflow Block', budget: 1 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at most ₹0/);
    });

    it('accepts a building with no budget in a full campus', async () => {
      const res = await http()
        .post('/api/buildings')
        .set(asAdmin)
        .send({ campus_id: CAMPUS_1, name: 'Unbudgeted Block' });
      expect(res.status).toBe(201);
    });

    it('rejects a negative budget', async () => {
      const res = await http()
        .post('/api/buildings')
        .set(asAdmin)
        .send({ campus_id: CAMPUS_2, name: 'Negative Block', budget: -5 });
      expect(res.status).toBe(400);
    });

    it('lets an edit use exactly what is left, and not a rupee more', async () => {
      // Campus 2 ₹20L; the other buildings hold ₹12.5L, so ₹7.5L is the cap.
      const over = await http()
        .patch(`/api/buildings/${BUILDING_3}`)
        .set(asAdmin)
        .send({ budget: 750001 });
      expect(over.status).toBe(400);

      const exact = await http()
        .patch(`/api/buildings/${BUILDING_3}`)
        .set(asAdmin)
        .send({ budget: 750000 });
      expect(exact.status).toBe(200);
    });

    it('rejects moving a building into a campus without room for it', async () => {
      // Campus 2 is now full.
      const res = await http()
        .patch(`/api/buildings/${BUILDING_2}`)
        .set(asAdmin)
        .send({ campus_id: CAMPUS_2 });
      expect(res.status).toBe(400);
    });

    it('rejects lowering a building below what its departments hold', async () => {
      const res = await http()
        .patch(`/api/buildings/${BUILDING_2}`)
        .set(asAdmin)
        .send({ budget: 349999 });
      expect(res.status).toBe(400);
    });
  });

  describe('campuses', () => {
    it('rejects lowering a campus below what its buildings hold', async () => {
      const patch = await http()
        .patch(`/api/campus/${CAMPUS_1}`)
        .set(asAdmin)
        .send({ total_budget: 1199999 });
      expect(patch.status).toBe(400);

      const put = await http()
        .put(`/api/campus/${CAMPUS_1}`)
        .set(asAdmin)
        .send({ name: 'Campus 1', total_budget: 1199999 });
      expect(put.status).toBe(400);
    });

    it('still allows other edits to a full campus', async () => {
      const res = await http()
        .patch(`/api/campus/${CAMPUS_1}`)
        .set(asAdmin)
        .send({ location: 'Sri City' });
      expect(res.status).toBe(200);
    });
  });

  describe('departments', () => {
    it('caps a new department at what its building has left', async () => {
      const over = await http()
        .post('/api/departments')
        .set(asAdmin)
        .send({ building_id: BUILDING_2, name: 'Physics', budget: 50001 });
      expect(over.status).toBe(400);
      expect(over.body.message).toMatch(/at most ₹50,000/);

      const exact = await http()
        .post('/api/departments')
        .set(asAdmin)
        .send({ building_id: BUILDING_2, name: 'Physics', budget: 50000 });
      expect(exact.status).toBe(201);
    });
  });
});
