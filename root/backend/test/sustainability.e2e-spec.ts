import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { GAS_CO2_KG_PER_M3, GRID_CO2_KG_PER_KWH } from '../src/modules/organizations/organizations.service';
import { DatabaseService } from '../src/core/database/database.service';
import { DispatchService } from '../src/modules/dispatch/dispatch.service';
import { defaultRange } from '../src/core/utils/period';

/**
 * End-to-end coverage for the Sustainability Officer endpoints and workflows.
 *
 * Covers:
 * - GET /api/sustainability-metrics/summary: tenant scoping, RBAC, arithmetic,
 *   meter coverage, and zero-data safety.
 * - POST /api/sustainability-reports/generate: period validation, preview shape,
 *   and proving no records are persisted.
 * - DELETE /api/sustainability-reports/:id: Sustainability Officer deletion.
 * - Wastage cases are seeded Open.
 */
describe('Sustainability Workflows (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

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

  describe('GET /api/sustainability-metrics/summary', () => {
    it('rejects access from unprivileged roles (Campus Visitor)', async () => {
      await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Campus Visitor')
        .set('x-org-id', 'org-001')
        .expect(403);
    });

    it('allows access to Sustainability Officer', async () => {
      const res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('allows access to Organization Admin', async () => {
      await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Organization Admin')
        .set('x-org-id', 'org-001')
        .expect(200);
    });

    it('computes emissions as Scope 1 (gas x 1.9) plus Scope 2 (electricity x 0.82)', async () => {
      const res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      const { totals, series, emission_factors } = res.body.data;
      expect(totals.energy_kwh).toBeGreaterThan(0);
      expect(totals.gas_m3).toBeGreaterThan(0);
      expect(emission_factors).toEqual({
        grid_kg_per_kwh: GRID_CO2_KG_PER_KWH,
        gas_kg_per_m3: GAS_CO2_KG_PER_M3,
      });
      expect(totals.scope2_kg).toBe(Math.round(totals.energy_kwh * GRID_CO2_KG_PER_KWH));
      expect(totals.scope1_kg).toBe(Math.round(totals.gas_m3 * GAS_CO2_KG_PER_M3));
      expect(totals.scope1_kg).toBeGreaterThan(0);
      expect(totals.emissions_kg).toBe(totals.scope1_kg + totals.scope2_kg);
      expect(totals.emissions_t).toBe(Number((totals.emissions_kg / 1000).toFixed(2)));
      for (const row of series) {
        expect(row.emissions_kg).toBe(row.scope1_kg + row.scope2_kg);
      }
    });

    it('keeps scope totals consistent when rolled up by quarter and year', async () => {
      const monthly = await request(server())
        .get('/api/sustainability-metrics/summary?from=2025-01&to=2025-12')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);
      const quarterly = await request(server())
        .get('/api/sustainability-metrics/summary?from=2025-01&to=2025-12&granularity=quarter')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);
      const yearly = await request(server())
        .get('/api/sustainability-metrics/summary?from=2025-01&to=2025-12&granularity=year')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      expect(quarterly.body.data.series).toHaveLength(4);
      expect(yearly.body.data.series).toHaveLength(1);
      const sum = (rows: any[], key: string) => rows.reduce((a, r) => a + r[key], 0);
      for (const key of ['energy_kwh', 'gas_m3', 'scope1_kg', 'scope2_kg', 'emissions_kg']) {
        expect(sum(quarterly.body.data.series, key)).toBe(sum(monthly.body.data.series, key));
        expect(yearly.body.data.series[0][key]).toBe(sum(monthly.body.data.series, key));
      }
    });

    it.each(['week', 'weekly', 'day', 'daily', 'hour'])(
      'rejects granularity=%s with 400 instead of inventing a split',
      async (granularity) => {
        const res = await request(server())
          .get(`/api/sustainability-metrics/summary?from=2026-08&to=2026-08&granularity=${granularity}`)
          .set('x-role', 'Sustainability Officer')
          .set('x-org-id', 'org-001')
          .expect(400);
        expect(res.body.message).toContain('granularity');
      },
    );

    it('defaults to January of the current year through the last full month', async () => {
      const res = await request(server())
        .get('/api/sustainability-metrics/summary')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      const { from, to } = defaultRange();
      expect(res.body.data.from).toBe(from);
      expect(res.body.data.to).toBe(to);
      // The seed runs to the last full month, so the default window has data.
      expect(res.body.data.totals.energy_kwh).toBeGreaterThan(0);
      for (const row of res.body.data.series) {
        expect(row.energy_kwh).toBeGreaterThan(0);
      }
    });

    it('lists active meters with no readings in the period as silent', async () => {
      const db = app.get(DatabaseService);
      const meterId = 'mmmm0000-0001-4000-8000-000000000000'; // M001, active
      const query = '/api/sustainability-metrics/summary?from=2026-08&to=2026-08';

      const before = await request(server())
        .get(query)
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);
      const silentBefore = before.body.data.silent_meters.map((m: any) => m.meter_id);
      expect(silentBefore).not.toContain(meterId);
      // Silent active meters and active meters that reported add up to all
      // active meters; a calibrating meter's readings must not hide a gap.
      const cov = before.body.data.meter_coverage;
      expect(cov.active_reporting + silentBefore.length).toBe(cov.active);

      const removed = db.meterReadings.filter(
        (r) => r.meter_id === meterId && r.timestamp.startsWith('2026-08'),
      );
      expect(removed.length).toBeGreaterThan(0);
      db.meterReadings = db.meterReadings.filter((r) => !removed.includes(r));
      try {
        const after = await request(server())
          .get(query)
          .set('x-role', 'Sustainability Officer')
          .set('x-org-id', 'org-001')
          .expect(200);
        const silent = after.body.data.silent_meters;
        expect(silent).toHaveLength(silentBefore.length + 1);
        const m001 = silent.find((m: any) => m.meter_id === meterId);
        expect(m001).toMatchObject({ meter_code: 'M-001', meter_type: 'electricity' });
        expect(m001.building_id).toBeTruthy();
        expect(after.body.data.meter_coverage.reporting_in_period).toBe(
          before.body.data.meter_coverage.reporting_in_period - 1,
        );
        expect(after.body.data.meter_coverage.active_reporting).toBe(
          before.body.data.meter_coverage.active_reporting - 1,
        );
      } finally {
        db.meterReadings.push(...removed);
      }
    });

    it('aggregates water, gas and food readings generated in the seed', async () => {
      const res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      const { totals, series } = res.body.data;
      expect(totals.water_kl).toBeGreaterThan(0);
      expect(totals.gas_m3).toBeGreaterThan(0);
      expect(totals.food_kg).toBeGreaterThan(0);
      expect(series).toHaveLength(8);
      for (const item of series) {
        expect(item.energy_kwh).toBeGreaterThan(0);
        expect(item.water_kl).toBeGreaterThan(0);
        expect(item.gas_m3).toBeGreaterThan(0);
        expect(item.food_kg).toBeGreaterThan(0);
      }
    });

    it('reports meter coverage including active, faulty, calibrating, and meters reporting in period', async () => {
      const res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      const { meter_coverage } = res.body.data;
      expect(meter_coverage.total).toBe(10);
      expect(meter_coverage.active).toBe(6);
      expect(meter_coverage.faulty).toBe(2);
      expect(meter_coverage.calibrating).toBe(1);
      expect(meter_coverage.decommissioned).toBe(1);
      // Live reporting meters in org-001 for the period: M001, M010, M007, M002, M008, M005
      expect(meter_coverage.reporting_in_period).toBe(6);
    });

    it('calculates change vs previous period of equal length', async () => {
      // 3 months: 2026-06 to 2026-08 compared against 2026-03 to 2026-05
      const res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-06&to=2026-08')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      const { change } = res.body.data;
      expect(change.has_comparison).toBe(true);
      expect(typeof change.energy_pct).toBe('number');
      expect(typeof change.water_pct).toBe('number');
    });

    it('scopes data strictly to the caller tenant', async () => {
      const org1Res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      const org2Res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-002')
        .expect(200);

      expect(org1Res.body.data.meter_coverage.total).toBe(10);
      expect(org2Res.body.data.meter_coverage.total).toBe(1);
      expect(org1Res.body.data.totals.energy_kwh).not.toBe(org2Res.body.data.totals.energy_kwh);
    });

    it('handles an organisation with no data gracefully (returns zero metrics and empty state)', async () => {
      const res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-003')
        .expect(200);

      const { totals, change, meter_coverage } = res.body.data;
      expect(totals.energy_kwh).toBe(0);
      expect(totals.water_kl).toBe(0);
      expect(totals.emissions_kg).toBe(0);
      expect(meter_coverage.total).toBe(0);
      expect(meter_coverage.reporting_in_period).toBe(0);
      expect(change.has_comparison).toBe(false);
    });

    it.each(['2026-13', '2026-00', '2026-1'])('rejects a month that does not exist (%s)', async (month) => {
      await request(server())
        .get(`/api/sustainability-metrics/summary?from=${month}`)
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(400);
    });

    it('rejects invalid range where from is after to', async () => {
      const res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-08&to=2026-01')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(400);

      expect(res.body.message).toContain('must not be after');
    });
  });

  describe('POST /api/sustainability-reports/generate', () => {
    it('validates period and rejects empty body', async () => {
      await request(server())
        .post('/api/sustainability-reports/generate')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .send({})
        .expect(400);
    });

    it('never invents figures: waste diverted is not reported, and no comparison means null', async () => {
      const res = await request(server())
        .post('/api/sustainability-reports/generate')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .send({ period: 'custom', from: '2031-01', to: '2031-02' })
        .expect(201);
      const m = res.body.data.metrics;
      expect(m).not.toHaveProperty('wasteDiverted');
      expect(m.energyReduction).toBeNull();
      expect(m.avoidedEmissions).toBeNull();
      expect(m.waterSaved).toBeNull();
      expect(JSON.stringify(m)).not.toMatch(/72%|4\.2%|12\.4|1\.2 ML/);
    });

    it('rejects invalid date range with 400', async () => {
      await request(server())
        .post('/api/sustainability-reports/generate')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .send({ period: 'custom', from: '2026-08', to: '2026-01' })
        .expect(400);
    });

    it('returns computed metrics and honest data gaps without saving to database', async () => {
      // Record initial report count
      const listBefore = await request(server())
        .get('/api/sustainability-reports')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);
      const countBefore = listBefore.body.data.length;

      const genRes = await request(server())
        .post('/api/sustainability-reports/generate')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .send({ period: 'Q2 2026' })
        .expect(201);

      const preview = genRes.body.data;
      expect(preview.title).toBeDefined();
      expect(preview.metrics).toBeDefined();
      // Q2 2026 has a previous quarter with readings, so every figure is measured.
      expect(preview.metrics.energyReduction).toMatch(/^([+−]\d+\.\d%|0%)$/);
      expect(preview.metrics.waterSaved).toMatch(/^[\d,]+ kL$/);
      expect(preview.metrics.avoidedEmissions).toMatch(/^[\d,]+\.\d t CO₂e$/);
      // No data source exists for diverted waste, and carbonOffset was renamed.
      expect(preview.metrics.wasteDiverted).toBeUndefined();
      expect(preview.metrics.carbonOffset).toBeUndefined();
      expect(preview.compared_with).toEqual({ from: '2026-01', to: '2026-03' });
      expect(Array.isArray(preview.data_gaps)).toBe(true);

      // Verify report was NOT saved
      const listAfter = await request(server())
        .get('/api/sustainability-reports')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);
      expect(listAfter.body.data.length).toBe(countBefore);
    });
  });

  describe('Report figures are measured, never filled in', () => {
    it('returns null figures and says why when the previous period has no readings', async () => {
      // Readings start in January 2025, so December 2024 has nothing.
      const res = await request(server())
        .post('/api/sustainability-reports/generate')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .send({ period: 'January 2025', from: '2025-01', to: '2025-01' })
        .expect(201);

      const preview = res.body.data;
      expect(preview.totals.energy_kwh).toBeGreaterThan(0);
      expect(preview.metrics.energyReduction).toBeNull();
      expect(preview.metrics.avoidedEmissions).toBeNull();
      expect(preview.metrics.waterSaved).toBeNull();
      expect(preview.deltas.energy_pct).toBeNull();
      expect(preview.deltas.emissions_pct).toBeNull();
      expect(preview.data_gaps).toContain(
        'There are no readings for December 2024, so changes against the previous period cannot be calculated.',
      );
      expect(JSON.stringify(preview)).not.toMatch(/-4\.2%|72%|12\.4|standard operational baselines|FAULTY|CALIBRATING|telemetry/);
      expect(preview.previous).toEqual({ energy_kwh: 0, water_kl: 0, gas_m3: 0, food_kg: 0, emissions_kg: 0 });
    });
  });

  describe('POST /api/sustainability-reports (server-built snapshot)', () => {
    const asSO = (r: request.Test) =>
      r.set('x-role', 'Sustainability Officer').set('x-org-id', 'org-001');

    it('rejects client-supplied metrics and stores nothing', async () => {
      const before = await asSO(request(server()).get('/api/sustainability-reports')).expect(200);
      await asSO(request(server()).post('/api/sustainability-reports'))
        .send({ period: 'May 2026', metrics: { energyReduction: '-99%' } })
        .expect(400);
      await asSO(request(server()).post('/api/sustainability-reports'))
        .send({ period: 'May 2026', generated_by_id: '550e8400-0005-4000-8000-000000000005' })
        .expect(400);
      const after = await asSO(request(server()).get('/api/sustainability-reports')).expect(200);
      expect(after.body.data.length).toBe(before.body.data.length);
    });

    it('saves exactly what /generate previews, with author, status and data gaps', async () => {
      const body = { period: 'October 2026', from: '2026-10', to: '2026-10' };
      const preview = (
        await asSO(request(server()).post('/api/sustainability-reports/generate')).send(body).expect(201)
      ).body.data;
      const saved = (
        await asSO(request(server()).post('/api/sustainability-reports')).send(body).expect(201)
      ).body.data;

      expect(saved.report_id).toBeDefined();
      expect(saved.generated_by_id).toBe('test-user');
      expect(saved.status).toBe('draft');
      expect(saved.organization_id).toBe('org-001');
      for (const key of ['totals', 'previous', 'deltas', 'metrics', 'meter_coverage', 'emission_factors', 'data_gaps', 'from', 'to']) {
        expect(saved[key]).toEqual(preview[key]);
      }
      expect(saved.data_gaps.length).toBeGreaterThan(0);
      // Plain sentences, correct grammar, and the silent meter named.
      expect(saved.data_gaps).toEqual([
        'Meters M-003 and M-009 are marked faulty, so their readings may be incomplete.',
        'Meter M-005 is being calibrated, so its readings may be inaccurate.',
        'M-004 sent no readings for this period. 5 of 6 active meters are included.',
      ]);
      expect(saved.previous.energy_kwh).toBeGreaterThan(0);

      // Reading it back returns the stored snapshot, data gaps included.
      const fetched = (
        await asSO(request(server()).get(`/api/sustainability-reports/${saved.report_id}`)).expect(200)
      ).body.data;
      expect(fetched.data_gaps).toEqual(saved.data_gaps);
      expect(fetched.totals).toEqual(saved.totals);
    });

    it('lets the title be renamed but not the figures', async () => {
      const saved = (
        await asSO(request(server()).post('/api/sustainability-reports'))
          .send({ period: 'September 2026', from: '2026-09', to: '2026-09' })
          .expect(201)
      ).body.data;

      const renamed = (
        await asSO(request(server()).patch(`/api/sustainability-reports/${saved.report_id}`))
          .send({ title: 'Renamed report' })
          .expect(200)
      ).body.data;
      expect(renamed.title).toBe('Renamed report');
      expect(renamed.totals).toEqual(saved.totals);

      await asSO(request(server()).patch(`/api/sustainability-reports/${saved.report_id}`))
        .send({ metrics: { energyReduction: '-99%' } })
        .expect(400);
      await asSO(request(server()).patch(`/api/sustainability-reports/${saved.report_id}`))
        .send({ period: 'Q1 2020' })
        .expect(400);
    });
  });

  describe('DELETE /api/sustainability-reports/:id', () => {
    it('allows a Sustainability Officer to delete a report', async () => {
      // First create a report to delete
      const createRes = await request(server())
        .post('/api/sustainability-reports')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .send({ title: 'Temporary Test Report', period: 'May 2026', from: '2026-05', to: '2026-05' })
        .expect(201);

      const reportId = createRes.body.data.report_id;
      expect(reportId).toBeDefined();

      // Delete as Sustainability Officer
      await request(server())
        .delete(`/api/sustainability-reports/${reportId}`)
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      // Verify it's gone
      await request(server())
        .get(`/api/sustainability-reports/${reportId}`)
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(404);
    });
  });

  describe('Initiatives: server-set author, saved fields, archive without deleting', () => {
    const asSO = (r: request.Test) =>
      r.set('x-role', 'Sustainability Officer').set('x-org-id', 'org-001');
    const base = {
      title: 'Chiller Plant Retune',
      description: 'Retune chilled water setpoints.',
      status: 'proposed',
      feasible: true,
      target_reduction: '6%',
    };

    it('records the signed-in user as creator and refuses a body created_by_id', async () => {
      await asSO(request(server()).post('/api/initiatives'))
        .send({ ...base, created_by_id: '550e8400-0005-4000-8000-000000000005' })
        .expect(400);
      const res = await asSO(request(server()).post('/api/initiatives')).send(base).expect(201);
      expect(res.body.data.created_by_id).toBe('test-user');
    });

    it('saves capex, start_date and target_date and returns them on reload', async () => {
      const created = (
        await asSO(request(server()).post('/api/initiatives'))
          .send({ ...base, capex: 50000, start_date: '2026-12-01', target_date: '2027-03-31' })
          .expect(201)
      ).body.data;
      const fetched = (
        await asSO(request(server()).get(`/api/initiatives/${created.initiative_id}`)).expect(200)
      ).body.data;
      expect(fetched.capex).toBe(50000);
      expect(fetched.start_date).toBe('2026-12-01');
      expect(fetched.target_date).toBe('2027-03-31');
    });

    it('rejects a target date before the start date, and malformed dates', async () => {
      await asSO(request(server()).post('/api/initiatives'))
        .send({ ...base, start_date: '2026-12-01', target_date: '2026-11-01' })
        .expect(400);
      await asSO(request(server()).post('/api/initiatives'))
        .send({ ...base, target_date: '31/03/2027' })
        .expect(400);
      await asSO(request(server()).post('/api/initiatives'))
        .send({ ...base, capex: -1 })
        .expect(400);
    });

    it('archives only completed or rejected initiatives, and keeps the record', async () => {
      const created = (
        await asSO(request(server()).post('/api/initiatives')).send(base).expect(201)
      ).body.data;
      const id = created.initiative_id;

      await asSO(request(server()).patch(`/api/initiatives/${id}/archive`)).expect(400);

      // The legal path: the Org Admin approves, the SO runs and completes it.
      await request(server())
        .patch(`/api/initiatives/${id}`)
        .set('x-role', 'Organization Admin')
        .set('x-org-id', 'org-001')
        .send({ status: 'approved' })
        .expect(200);
      await asSO(request(server()).patch(`/api/initiatives/${id}`)).send({ status: 'in-progress' }).expect(200);
      await asSO(request(server()).patch(`/api/initiatives/${id}`)).send({ status: 'completed' }).expect(200);
      const archived = (
        await asSO(request(server()).patch(`/api/initiatives/${id}/archive`)).expect(200)
      ).body.data;
      expect(archived.archived_at).toEqual(expect.any(String));

      // Still on the server, with its archive stamp, for any later session.
      const list = (await asSO(request(server()).get('/api/initiatives')).expect(200)).body.data;
      const found = list.find((i: any) => i.initiative_id === id);
      expect(found.archived_at).toBe(archived.archived_at);

      // Archiving again keeps the first timestamp.
      const again = (
        await asSO(request(server()).patch(`/api/initiatives/${id}/archive`)).expect(200)
      ).body.data;
      expect(again.archived_at).toBe(archived.archived_at);

      // archived_at cannot be set or cleared through a normal PATCH.
      await asSO(request(server()).patch(`/api/initiatives/${id}`))
        .send({ archived_at: null })
        .expect(400);
    });

    it('keeps creator and archive stamp through an Org Admin PUT', async () => {
      const list = (await asSO(request(server()).get('/api/initiatives')).expect(200)).body.data;
      const archivedSeed = list.find((i: any) => i.initiative_id === 'iiii0000-0008-4000-8000-000000000000');
      expect(archivedSeed.archived_at).toBeTruthy();

      const res = await request(server())
        .put(`/api/initiatives/${archivedSeed.initiative_id}`)
        .set('x-role', 'Organization Admin')
        .set('x-org-id', 'org-001')
        .send({ ...base, status: 'completed' })
        .expect(200);
      expect(res.body.data.created_by_id).toBe(archivedSeed.created_by_id);
      expect(res.body.data.archived_at).toBe(archivedSeed.archived_at);
    });

    it('seeds a rejected initiative that is visible, not hidden', async () => {
      const list = (await asSO(request(server()).get('/api/initiatives')).expect(200)).body.data;
      expect(list.some((i: any) => i.status === 'rejected' && !i.archived_at)).toBe(true);
    });
  });

  describe('Sustainability metric records are read-only', () => {
    it('keeps the list and summary, and has no write or by-id routes', async () => {
      const asSO = (r: request.Test) =>
        r.set('x-role', 'Sustainability Officer').set('x-org-id', 'org-001');
      await asSO(request(server()).get('/api/sustainability-metrics')).expect(200);
      await asSO(request(server()).get('/api/sustainability-metrics/summary')).expect(200);
      await asSO(request(server()).post('/api/sustainability-metrics')).send({}).expect(404);
      await asSO(request(server()).get('/api/sustainability-metrics/some-id')).expect(404);
      await asSO(request(server()).patch('/api/sustainability-metrics/some-id')).send({}).expect(404);
      await asSO(request(server()).delete('/api/sustainability-metrics/some-id')).expect(404);
    });
  });

  describe('Initiatives with on-site work join the technician workflow', () => {
    const asSO = (r: request.Test) => r.set('x-role', 'Sustainability Officer').set('x-org-id', 'org-001');
    const asAdmin = (r: request.Test) => r.set('x-role', 'Organization Admin').set('x-org-id', 'org-001');
    const asCoord = (r: request.Test) => r.set('x-role', 'Operations Coordinator').set('x-org-id', 'org-001');
    const asFinance = (r: request.Test) => r.set('x-role', 'Financial Analyst').set('x-org-id', 'org-001');
    const targetDate = `${new Date().getFullYear() + 1}-06-30`;
    const tasks = { plumber: 'Fit the sump tank and its pipes.', electrician: 'Wire the pump circuit and an isolator.' };
    const plan = {
      title: 'Solar water heaters (test)',
      description: 'Rooftop tanks, pipework and backup heaters.',
      feasible: true,
      onsite_work: true,
      teams: ['plumber', 'electrician'],
      team_tasks: tasks,
      target_date: targetDate,
      building_ids: ['660e8800-0002-4000-8000-000000000000'],
    };
    const db = () => app.get(DatabaseService);
    const get = async (id: string) => (await asSO(request(server()).get(`/api/initiatives/${id}`)).expect(200)).body.data;
    const propose = (extra: Record<string, unknown> = {}) => asSO(request(server()).post('/api/initiatives')).send({ ...plan, ...extra });
    const decide = (id: string, body: Record<string, unknown>) => asAdmin(request(server()).patch(`/api/initiatives/${id}`)).send(body);

    /** Proposed and approved: approval starts it, so it comes back in progress with its jobs sent. */
    async function running(extra: Record<string, unknown> = {}) {
      const id = (await propose(extra).expect(201)).body.data.initiative_id;
      const approved = (await decide(id, { status: 'approved' }).expect(200)).body.data;
      return { id, approved, jobs: approved.jobs as any[] };
    }
    const complete = (id: string) => asSO(request(server()).patch(`/api/initiatives/${id}`)).send({ status: 'completed' });
    const closeJob = (workOrderId: string) =>
      asCoord(request(server()).patch(`/api/work-orders/${workOrderId}`)).send({ status: 'closed' }).expect(200);
    const jobFor = (jobs: any[], team: string) => jobs.find((j) => j.team === team && !j.rework_of);
    const askRework = (id: string, woId: string, reason: string) =>
      asSO(request(server()).post(`/api/initiatives/${id}/jobs/${woId}/rework-request`)).send({ reason });
    const decideRework = (ticketId: string, body: Record<string, unknown>) =>
      asCoord(request(server()).post(`/api/dispatch/rework-requests/${ticketId}`)).send(body);

    // ── #10 one team list ──
    it('offers the server team list (with General Maintenance) and refuses the old "cleaning"', async () => {
      const cat = (await asSO(request(server()).get('/api/service-requests/catalogue')).expect(200)).body.data;
      expect(cat.teams.map((t: any) => t.id)).toEqual(['electrician', 'plumber', 'general', 'hvac']);
      expect(cat.teams.find((t: any) => t.id === 'general').label).toBe('General Maintenance');
      await propose({ teams: ['cleaning'], team_tasks: { cleaning: 'x' } }).expect(400);
      // Every type the form can offer is accepted.
      for (const t of cat.teams) await propose({ teams: [t.id], team_tasks: { [t.id]: `Do the ${t.label} part.` } }).expect(201);
    });

    // ── #5 a task per type ──
    it('a task per technician type is optional; only tasks for ticked types are kept', async () => {
      const partial = (await propose({ team_tasks: { plumber: 'Only the plumber' } }).expect(201)).body.data;
      expect(partial.team_tasks).toEqual({ plumber: 'Only the plumber' });
      await propose({ team_tasks: { plumber: 'x'.repeat(301), electrician: 'ok' } }).expect(400);
      await propose({ teams: [], team_tasks: {} }).expect(400);
      await propose({ target_date: undefined }).expect(400);
      const made = (await propose({ teams: ['plumber'], team_tasks: { plumber: '  Fit the tank.  ', hvac: 'stray' } }).expect(201)).body.data;
      expect(made.team_tasks).toEqual({ plumber: 'Fit the tank.' });
      const none = (await propose({ onsite_work: false }).expect(201)).body.data;
      expect(none.teams).toEqual([]);
      expect(none.team_tasks).toEqual({});
    });

    // ── #1 decisions ──
    it('rejecting needs a reason; the reason and an approval remark reach the proposer', async () => {
      const id = (await propose().expect(201)).body.data.initiative_id;
      await decide(id, { status: 'rejected' }).expect(400);
      await decide(id, { status: 'rejected', decision_note: '   ' }).expect(400);
      const rejected = (await decide(id, { status: 'rejected', decision_note: 'Not this year' }).expect(200)).body.data;
      expect(rejected.decision_note).toBe('Not this year');
      expect(rejected.decided_by_name).toBeNull(); // the test signer is not a seeded user
      const msgs = () => db().notifications.filter((n) => n.target_id === id).map((n) => n.message);
      expect(msgs()).toContain('Your initiative "Solar water heaters (test)" was not approved: Not this year');

      const id2 = (await propose().expect(201)).body.data.initiative_id;
      await decide(id2, { status: 'approved', decision_note: 'Go ahead, keep within budget' }).expect(200);
      const note = db().notifications.filter((n) => n.target_id === id2).map((n) => n.message).pop()!;
      expect(note).toContain('was approved: Go ahead, keep within budget');
      expect(note).toContain('Work has started: 2 jobs sent to Plumber, Electrician.');
    });

    // ── #3 approval starts the work ──
    it('approval starts the work: in progress at once, start date today, one job per type, each due on the target date', async () => {
      const { approved, jobs } = await running();
      expect(approved.status).toBe('in-progress');
      expect(approved.start_date).toBe(new Date().toISOString().slice(0, 10));
      expect(jobs.map((j) => j.team).sort()).toEqual(['electrician', 'plumber']);
      const due = new Date(`${targetDate}T23:59:59`).toISOString();
      for (const job of jobs) {
        const wo = db().workOrders.find((w) => w.work_order_id === job.work_order_id)!;
        expect(wo.dispatch?.team).toBe(job.team);
        expect(wo.dispatch?.sla?.deadline_at).toBe(due);
        expect(db().users.find((u) => u.user_id === wo.assigned_to_id)?.team).toBe(job.team);
        // #7: its own type; #5: the job carries that type's task.
        expect(wo.details?.type).toBe('initiative');
        const ticket = db().serviceRequests.find((t) => t.service_request_id === wo.source_request_id)!;
        expect(ticket.description).toContain(`Your task: ${(tasks as any)[job.team]}`);
        expect(job.task).toBe((tasks as any)[job.team]);
      }
      const campus = (
        await request(server()).get('/api/service-requests/campus-issues').set('x-role', 'Campus Visitor').set('x-org-id', 'org-001').expect(200)
      ).body.data as any[];
      expect(campus.some((t) => String(t.summary).includes('Solar water heaters (test)'))).toBe(false);
    });

    it('an initiative without on-site work also starts on approval, with no jobs', async () => {
      const { approved, jobs } = await running({ onsite_work: false });
      expect(approved.status).toBe('in-progress');
      expect(jobs).toEqual([]);
    });

    it('approval is refused once the target date has passed (move the date first)', async () => {
      const id = (await propose().expect(201)).body.data.initiative_id;
      db().initiatives.find((i) => i.initiative_id === id)!.target_date = '2020-01-31';
      const res = await decide(id, { status: 'approved' }).expect(400);
      expect(res.body.message).toContain('has passed; move it first');
      expect((await get(id)).status).toBe('proposed');
      await decide(id, { status: 'approved', target_date: targetDate }).expect(200);
      expect((await get(id)).status).toBe('in-progress');
    });

    it('the officer cannot change the technician types or tasks once approved; the admin can', async () => {
      const { id } = await running();
      await asSO(request(server()).patch(`/api/initiatives/${id}`)).send({ teams: ['plumber'] }).expect(409);
      await asSO(request(server()).patch(`/api/initiatives/${id}`)).send({ team_tasks: { ...tasks, plumber: 'Something else' } }).expect(409);
      const changed = (
        await decide(id, { teams: ['plumber', 'electrician', 'hvac'], team_tasks: { ...tasks, hvac: 'Balance the loop.' } }).expect(200)
      ).body.data;
      // A type added later gets its job straight away, with its task.
      expect(changed.jobs.filter((j: any) => j.team === 'hvac')).toHaveLength(1);
      expect(changed.jobs).toHaveLength(3);
      // A type can be added without a task: its job carries the initiative's description only.
      const more = (await decide(id, { teams: ['plumber', 'electrician', 'hvac', 'general'] }).expect(200)).body.data;
      const general = more.jobs.find((j: any) => j.team === 'general');
      expect(general).toBeDefined();
      expect(general.task).toBeNull();
    });

    it('cannot switch on-site work off, or drop a type that has a job, once jobs exist', async () => {
      const { id } = await running();
      await decide(id, { onsite_work: false }).expect(409);
      await decide(id, { teams: ['plumber'], team_tasks: { plumber: tasks.plumber } }).expect(409);
      await complete(id).expect(409);
    });

    it('completes only when every job is closed, and tells the officer when all work is done', async () => {
      const { id, jobs } = await running();
      await closeJob(jobFor(jobs, 'plumber').work_order_id);
      expect(JSON.stringify((await complete(id).expect(409)).body)).toContain('Electrician');
      await closeJob(jobFor(jobs, 'electrician').work_order_id);
      const notices = db().notifications.filter((n) => n.target_id === id).map((n) => n.message);
      expect(notices.some((m) => m.startsWith('All work for'))).toBe(true);
      expect((await get(id)).status).toBe('in-progress');
      expect((await complete(id).expect(200)).body.data.status).toBe('completed');
    });

    // ── #8 rework requests go through the coordinator ──
    it('rework: the officer only asks; the coordinator sends it to the same technician with a finish date', async () => {
      const { id, jobs } = await running();
      const plumbing = jobFor(jobs, 'plumber');
      await askRework(id, plumbing.work_order_id, 'Tank leaks at the inlet').expect(400); // still open
      await closeJob(plumbing.work_order_id);
      await askRework(id, plumbing.work_order_id, 'x').expect(400);
      const asked = (await askRework(id, plumbing.work_order_id, 'Tank leaks at the inlet').expect(201)).body.data;
      expect(jobFor(asked.jobs, 'plumber').rework_request.status).toBe('pending');
      // Nothing was dispatched yet; the coordinator was told and sees it in the queue.
      expect(asked.jobs).toHaveLength(2);
      await askRework(id, plumbing.work_order_id, 'Again').expect(409);
      const queue = (await asCoord(request(server()).get('/api/dispatch/queue')).expect(200)).body.data;
      const req = queue.rework_requests.find((r: any) => r.initiative_id === id);
      expect(req.reason).toBe('Tank leaks at the inlet');
      expect(req.original_technician_name).toBe(plumbing.technician_name);
      await closeJob(jobFor(jobs, 'electrician').work_order_id);
      await complete(id).expect(409); // the request is still waiting

      await decideRework(req.ticket_id, { decision: 'same' }).expect(400); // needs a finish date
      await decideRework(req.ticket_id, { decision: 'same', finish_by: '2020-01-01' }).expect(400);
      const later = `${new Date().getFullYear() + 1}-01-15`;
      await decideRework(req.ticket_id, { decision: 'same', finish_by: later }).expect(201);
      const after = await get(id);
      const rework = after.jobs.find((j: any) => j.rework_of === plumbing.work_order_id);
      expect(rework.technician_name).toBe(plumbing.technician_name); // the same person
      expect(rework.finish_by).toBe(new Date(`${later}T23:59:59`).toISOString());
      expect(jobFor(after.jobs, 'plumber').rework_request.status).toBe('sent');
      const officerNote = db().notifications.filter((n) => n.target_id === id).map((n) => n.message).pop()!;
      expect(officerNote).toContain(`was sent to ${plumbing.technician_name}`);
      await decideRework(req.ticket_id, { decision: 'auto', finish_by: later }).expect(400); // already decided
      await complete(id).expect(409); // rework job open
      await closeJob(rework.work_order_id);
      await complete(id).expect(200);
    });

    it('rework: the coordinator can decline with a note (required), and the officer is told', async () => {
      const { id, jobs } = await running();
      const plumbing = jobFor(jobs, 'plumber');
      await closeJob(plumbing.work_order_id);
      await askRework(id, plumbing.work_order_id, 'Add a second tank').expect(201);
      const ticket = db().serviceRequests.find((t) => t.source_initiative === id && t.team === 'plumber')!;
      await decideRework(ticket.service_request_id, { decision: 'decline' }).expect(400);
      await decideRework(ticket.service_request_id, { decision: 'decline', note: 'New scope: propose a new initiative' }).expect(201);
      const job = jobFor((await get(id)).jobs, 'plumber');
      expect(job.rework_request.status).toBe('declined');
      expect(job.rework_request.note).toBe('New scope: propose a new initiative');
      expect(db().notifications.filter((n) => n.target_id === id).pop()!.message).toContain('was declined: New scope');
    });

    it('rework: the coordinator can hand-pick another technician of any team', async () => {
      const { id, jobs } = await running();
      const plumbing = jobFor(jobs, 'plumber');
      await closeJob(plumbing.work_order_id);
      await askRework(id, plumbing.work_order_id, 'Pipe lagging missing').expect(201);
      const ticket = db().serviceRequests.find((t) => t.source_initiative === id && t.team === 'plumber' && !t.rework_of)!;
      const other = db().users.find((u) => u.role === 'Technician' && u.team === 'plumber' && u.user_id !== plumbing.technician_id)!;
      await decideRework(ticket.service_request_id, { decision: 'pick', finish_by: targetDate }).expect(400); // who?
      await decideRework(ticket.service_request_id, { decision: 'pick', assignee_id: other.user_id, finish_by: targetDate }).expect(201);
      const rework = (await get(id)).jobs.find((j: any) => j.rework_of === plumbing.work_order_id);
      expect(rework.technician_name).toBe(other.name);
    });

    // ── #6 money ──
    it('spend: approved bills on its jobs count against the cost; late bills allowed for 7 days on closed initiative jobs; Finance can read it', async () => {
      const { id, jobs } = await running({ capex: 85000 });
      const plumbing = jobFor(jobs, 'plumber');
      const bill = (woId: string, amount: number) =>
        asAdmin(request(server()).post('/api/expense-bills')).send({
          work_order_id: woId, title: 'Pipes', vendor: 'City Hardware', category: 'materials', bill_date: new Date().toISOString().slice(0, 10), amount,
        });
      await closeJob(plumbing.work_order_id);
      await bill(plumbing.work_order_id, 1200).expect(201); // late, within 7 days: auto-approved under the cap
      await bill(plumbing.work_order_id, 5000).expect(201); // over the cap: waits for Finance
      const seen = (await asFinance(request(server()).get(`/api/initiatives/${id}`)).expect(200)).body.data;
      expect(seen.money.cost).toBe(85000);
      expect(seen.money.spent).toBe(1200);
      expect(seen.money.spend_pending).toBe(5000);
      expect(jobFor(seen.jobs, 'plumber').spent).toBe(1200);
      // Outside the window: refused.
      db().serviceRequests.find((t) => t.service_request_id === db().workOrders.find((w) => w.work_order_id === plumbing.work_order_id)!.source_request_id)!.closed_at =
        new Date(Date.now() - 8 * 86_400_000).toISOString();
      await bill(plumbing.work_order_id, 100).expect(400);
      // A closed job that is not from an initiative: refused as before.
      const ordinary = db().workOrders.find((w) => w.status === 'closed' && !w.dispatch);
      if (ordinary) await bill(ordinary.work_order_id, 100).expect(400);
    });

    it('the record carries who proposed it and when, for the archive card', async () => {
      const { approved } = await running();
      expect(approved.created_at).toBeDefined();
      expect(approved.decided_at).toBeDefined();
      expect(approved.team_labels).toEqual(['Plumber', 'Electrician']);
    });

    it('an initiative with open jobs cannot be deleted, even by the admin', async () => {
      const { id, jobs } = await running();
      await asAdmin(request(server()).delete(`/api/initiatives/${id}`)).expect(409);
      for (const j of jobs) await closeJob(j.work_order_id);
      await asAdmin(request(server()).delete(`/api/initiatives/${id}`)).expect(200);
    });

    it('moving the target date moves the open jobs’ finish date, never into the past', async () => {
      const { id } = await running();
      const later = `${new Date().getFullYear() + 2}-01-31`;
      await asSO(request(server()).patch(`/api/initiatives/${id}`)).send({ target_date: later }).expect(200);
      const due = new Date(`${later}T23:59:59`).toISOString();
      for (const j of (await get(id)).jobs) expect(j.finish_by).toBe(due);
      await asSO(request(server()).patch(`/api/initiatives/${id}`)).send({ target_date: '2020-01-31' }).expect(400);
    });

    // ── #4 "Available today" ──
    it('"Available today" off lasts for today only; the coordinator can put someone back on duty', async () => {
      const dispatch = app.get(DispatchService);
      const tech = db().users.find((u) => u.email === 'meera@gmail.com')!;
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 86_400_000);
      dispatch.setAvailability(tech.user_id, false, today);
      expect(dispatch.availabilityOf(tech, today).switched_on).toBe(false);
      expect(dispatch.availabilityOf(tech, tomorrow).switched_on).toBe(true); // a new day
      expect(dispatch.availabilityOf(tech, tomorrow).available).toBe(true);

      dispatch.setAvailability(tech.user_id, true, today);
      tech.unavailable_on = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      tech.unavailable_reason = 'sick';
      expect(dispatch.availabilityOf(tech, today).off_reason).toBe('sick');
      const back = (await asCoord(request(server()).post(`/api/dispatch/technicians/${tech.user_id}/back-on-duty`)).expect(201)).body.data;
      expect(back.available).toBe(true);
      expect(back.off_for_today).toBe(false);
      await request(server()).post(`/api/dispatch/technicians/${tech.user_id}/back-on-duty`).set('x-role', 'Technician').set('x-org-id', 'org-001').expect(403);
      const noTeam = db().users.find((u) => u.role === 'Technician' && !u.team)!;
      expect(dispatch.availabilityOf(noTeam).has_team).toBe(false);
    });
  });

  describe('Wastage seed normalization', () => {
    it('seeds all wastage cases as "Open"', async () => {
      const res = await request(server())
        .get('/api/wastage-reports')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      for (const report of res.body.data) {
        expect(report.status).toBe('Open');
      }
    });
  });
});
