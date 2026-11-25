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
