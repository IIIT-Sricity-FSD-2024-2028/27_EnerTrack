import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import {
  DatabaseService,
  FindingSeverity,
  FindingStatus,
  NotificationTargetType,
} from '../src/core/database/database.service';
import { lastFullMonth, periodsBetween } from '../src/core/utils/period';

/**
 * Stage 5: building hotspots (T11), measured initiatives (T12) and accepted
 * audit findings becoming initiatives (T13).
 */
describe('Stage 5: buildings, measured initiatives, findings (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const http = () => request(app.getHttpServer());
  const body = (res: request.Response) => res.body?.data ?? res.body;

  const ORG = 'org-001';
  const as = (role: string, org = ORG) => ({ 'x-role': role, 'x-org-id': org });
  const SO = as('Sustainability Officer');
  const ADMIN = as('Organization Admin');
  const LAST = lastFullMonth();
  const HVAC = 'iiii0000-0002-4000-8000-000000000000';
  const BUILDING_2 = '660e8800-0002-4000-8000-000000000000';
  const M001 = 'mmmm0000-0001-4000-8000-000000000000';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalGuards(new RolesGuard(app.get(Reflector)));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    db = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────── T11 building hotspots ───────────────────────

  describe('summary by building (T11)', () => {
    const summary = (q: string) => http().get(`/api/sustainability-metrics/summary?${q}&groupBy=building`).set(SO);

    it.each([
      ['2026-01', LAST],
      ['2025-01', '2025-12'],
      ['2026-03', '2026-05'],
      [LAST, LAST],
    ])('buildings add up exactly to the campus totals (%s to %s)', async (from, to) => {
      const d = body(await summary(`from=${from}&to=${to}`).expect(200));
      for (const key of ['energy_kwh', 'water_kl', 'gas_m3', 'scope1_kg', 'scope2_kg', 'emissions_kg']) {
        expect(d.by_building.reduce((acc: number, b: any) => acc + b[key], 0)).toBe(d.totals[key]);
      }
    });

    it('lists only this organisation\'s buildings, busiest first', async () => {
      const d = body(await summary(`from=2026-01&to=${LAST}`).expect(200));
      const own = db.buildings.filter((b) => b.organization_id === ORG).map((b) => b.building_id).sort();
      expect(d.by_building.map((b: any) => b.building_id).sort()).toEqual(own);
      const energy = d.by_building.map((b: any) => b.energy_kwh);
      expect(energy).toEqual([...energy].sort((a, b) => b - a));
    });

    it('compares like for like with last year, and says so when it cannot', async () => {
      const now = body(await summary(`from=2026-03&to=2026-05`).expect(200));
      const b2 = now.by_building.find((b: any) => b.building_id === BUILDING_2);
      expect(b2.yoy_pct).toBe(-12); // the seed cuts this building's meter by 12%
      const then = body(await summary('from=2025-01&to=2025-12').expect(200));
      expect(then.by_building.every((b: any) => b.yoy_pct === null)).toBe(true); // no 2024 readings
    });

    it('shows a silent meter under its building', async () => {
      const d = body(await summary(`from=${LAST}&to=${LAST}`).expect(200));
      const b5 = d.by_building.find((b: any) => b.silent_meters.some((m: any) => m.meter_code === 'M-004'));
      expect(b5).toBeDefined();
      expect(b5.meters_reporting).toBeLessThan(b5.meters_total);
    });

    it('refuses an unknown groupBy (400)', async () => {
      await http().get('/api/sustainability-metrics/summary?groupBy=floor').set(SO).expect(400);
    });

    it('leaves by_building out unless asked for', async () => {
      const d = body(await http().get('/api/sustainability-metrics/summary').set(SO).expect(200));
      expect(d.by_building).toBeUndefined();
    });
  });

  describe('raising a meter alert (T11)', () => {
    const M004 = 'mmmm0000-0004-4000-8000-000000000000';
    const raise = (who: Record<string, string>, meterId: string) =>
      http().post('/api/alerts').set(who).send({ meter_id: meterId, title: 'No readings this month', severity: 'medium', status: 'open' });

    it('lets the SO raise one for a silent meter, once', async () => {
      const res = await raise(SO, M004).expect(201);
      expect(body(res).meter_id).toBe(M004);
      const again = await raise(SO, M004).expect(409);
      expect(again.body.message).toContain('already an open alert for this meter');
    });

    it('treats another organisation\'s meter as not found', async () => {
      const foreign = db.meters.find((m) => m.organization_id !== ORG)!;
      await raise(SO, foreign.meter_id).expect(404);
    });

    it('is still refused for a Campus Visitor', async () => {
      await raise(as('Campus Visitor'), M004).expect(403);
    });
  });

  // ─────────────────────── T12 measured initiatives ───────────────────────

  describe('measured initiatives (T12)', () => {
    it('the seeded HVAC initiative is on track with a real measured saving', async () => {
      const p = body(await http().get(`/api/initiatives/${HVAC}/performance`).set(SO).expect(200));
      expect(p.measurable).toBe(true);
      expect(p.months_compared).toBe(periodsBetween('2026-03', LAST).length);
      expect(p.actual_saving_to_date).toBeGreaterThan(0);
      expect(p.expected_to_date).toBe(Math.round((60000 / 12) * p.months_compared));
      expect(p.on_track).toBe(true);
      expect(p.rating).toBe('green');
      expect(p.months.every((m: any) => m.baseline_period === `2025-${m.period.slice(5)}`)).toBe(true);
    });

    it('the list carries each initiative\'s performance', async () => {
      const list = body(await http().get('/api/initiatives').set(SO).expect(200));
      expect(list.find((i: any) => i.initiative_id === HVAC).performance.on_track).toBe(true);
      const led = list.find((i: any) => i.title === 'LED Campus-Wide Retrofit');
      expect(led.performance).toEqual({ measurable: false, reason: 'No measure chosen.' });
    });

    it('never counts a month with no readings as a saving', async () => {
      const before = body(await http().get(`/api/initiatives/${HVAC}/performance`).set(SO).expect(200));
      const removed = db.meterReadings.filter((r) => r.meter_id === M001 && r.timestamp.startsWith('2026-04'));
      expect(removed.length).toBeGreaterThan(0);
      db.meterReadings = db.meterReadings.filter((r) => !removed.includes(r));
      try {
        const after = body(await http().get(`/api/initiatives/${HVAC}/performance`).set(SO).expect(200));
        expect(after.months_compared).toBe(before.months_compared - 1);
        expect(after.months.find((m: any) => m.period === '2026-04').compared).toBe(false);
        // The silent month is dropped, not read as a 100% saving.
        expect(after.actual_saving_to_date).toBeLessThan(before.actual_saving_to_date);
      } finally {
        db.meterReadings.push(...removed);
      }
    });

    it('records the verified saving when it is completed, and stamps the start date when work starts', async () => {
      const created = body(
        await http().post('/api/initiatives').set(SO).send({
          title: 'Building 2 chiller retune',
          feasible: true,
          metric: 'energy_kwh',
          building_ids: [BUILDING_2],
          expected_saving: 60000,
        }).expect(201),
      );
      expect(created.performance).toEqual({ measurable: false, reason: 'Not started yet.' });
      const id = created.initiative_id;
      await http().patch(`/api/initiatives/${id}`).set(ADMIN).send({ status: 'approved' }).expect(200);
      const started = body(await http().patch(`/api/initiatives/${id}`).set(SO).send({ status: 'in-progress' }).expect(200));
      expect(started.start_date).toBe(new Date().toISOString().slice(0, 10));

      // Backdate the start so there are measured months, then complete it.
      await http().patch(`/api/initiatives/${id}`).set(SO).send({ start_date: '2026-03-01' }).expect(200);
      const perf = body(await http().get(`/api/initiatives/${id}/performance`).set(SO).expect(200));
      const done = body(await http().patch(`/api/initiatives/${id}`).set(SO).send({ status: 'completed' }).expect(200));
      expect(done.verified_saving).toBe(perf.actual_saving_to_date);
      expect(done.verified_saving).toBeGreaterThan(0);
      expect(done.verified_at).toBe(done.completed_at);
    });

    it.each([
      ['an unknown building', { building_ids: ['nope'] }],
      ['another organisation\'s building', { building_ids: ['660e8800-0f02-4000-8000-000000000000'] }],
      ['a target that measures something else', { metric: 'water_kl', target_id: 'tgt00000-0001-4000-8000-000000000000' }],
      ['a negative expected saving', { metric: 'energy_kwh', expected_saving: -5 }],
      ['the old manual onTrack flag', { onTrack: true }],
    ])('refuses %s (400)', async (_label, extra) => {
      await http().post('/api/initiatives').set(SO).send({ title: 'X', feasible: true, ...extra }).expect(400);
    });
  });

  // ─────────────────── T13 findings become initiatives ───────────────────

  describe('accepted audit findings become initiatives (T13)', () => {
    const AUDIT = 'audit-001';
    const linked = (findingId: string) =>
      db.initiatives.filter((i) => i.source_finding === `${AUDIT}:${findingId}`);

    beforeAll(() => {
      db.energyAudits
        .find((a) => a.audit_id === AUDIT)!
        .findings.push({
          finding_id: 'find-e2e',
          title: 'Variable speed drives on AHU fans',
          category: 'HVAC',
          severity: FindingSeverity.MODERATE,
          est_annual_saving: 170000,
          capex: 400000,
          payback_months: 28,
          status: FindingStatus.PROPOSED,
          implemented_on: null,
          building_ids: ['660e8800-0001-4000-8000-000000000000'],
        });
    });

    it('accepting a finding creates exactly one proposed, linked initiative', async () => {
      await http().patch(`/api/energy-audits/${AUDIT}/findings/find-e2e`).set(SO).send({ status: 'accepted' }).expect(200);
      const made = linked('find-e2e');
      expect(made).toHaveLength(1);
      const i = made[0];
      expect(i.status).toBe('proposed');
      expect(i.title).toBe('Variable speed drives on AHU fans');
      expect(i.metric).toBe('energy_kwh');
      expect(i.building_ids).toEqual(['660e8800-0001-4000-8000-000000000000']);
      expect(i.expected_saving_amount).toBe(170000);
      expect(i.expected_saving).toBe(Math.round(170000 / 8.5)); // org-001 tariff
      expect(i.capex).toBe(400000);
      expect(i.description).toBe('HVAC measure from the energy audit of 12 Sep 2025.');

      const notes = db.notifications.filter((n) => n.target_type === NotificationTargetType.INITIATIVE && n.target_id === i.initiative_id);
      const expected = db.users
        .filter((u) => u.organization_id === ORG && ['Sustainability Officer', 'Organization Admin'].includes(u.role))
        .map((u) => u.user_id)
        .sort();
      expect(notes.map((n) => n.user_id).sort()).toEqual(expected);
    });

    it('accepting it again does not create a duplicate', async () => {
      // A client cannot move an accepted finding back to proposed (409), so
      // the repeat comes from the auditor's side.
      await http().patch(`/api/energy-audits/${AUDIT}/findings/find-e2e`).set(SO).send({ status: 'proposed' }).expect(409);
      await http().patch(`/api/energy-audits/${AUDIT}/findings/find-e2e`).set(as('Certified Energy Auditor')).send({ status: 'accepted' }).expect(200);
      expect(linked('find-e2e')).toHaveLength(1);
    });

    it('marking it implemented sets the initiative\'s start date', async () => {
      await http()
        .patch(`/api/energy-audits/${AUDIT}/findings/find-e2e`)
        .set(SO)
        .send({ status: 'implemented' })
        .expect(200);
      const finding = db.energyAudits.find((a) => a.audit_id === AUDIT)!.findings!.find((f: any) => f.finding_id === 'find-e2e') as any;
      const start = linked('find-e2e')[0].start_date;
      expect(finding.implemented_on).toBe(new Date().toISOString().slice(0, 10));
      expect(start).toBe(finding.implemented_on);
    });

    it('the seeded accepted solar finding already has its one initiative', async () => {
      await http().patch(`/api/energy-audits/${AUDIT}/findings/find-003`).set(SO).send({ status: 'accepted' }).expect(200);
      expect(linked('find-003')).toHaveLength(1);
      expect(linked('find-003')[0].expected_saving_amount).toBe(1450000);
    });
  });
});
