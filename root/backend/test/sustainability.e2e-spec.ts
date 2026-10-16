import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { GRID_CO2_KG_PER_KWH } from '../src/modules/organizations/organizations.service';

/**
 * End-to-end coverage for the Sustainability Officer endpoints and workflows.
 *
 * Covers:
 * - GET /api/sustainability-metrics/summary: tenant scoping, RBAC, arithmetic,
 *   meter coverage, and zero-data safety.
 * - POST /api/sustainability-reports/generate: period validation, preview shape,
 *   and proving no records are persisted.
 * - DELETE /api/sustainability-reports/:id: Sustainability Officer deletion.
 * - Wastage status normalization in seed.
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

    it('computes emissions exactly as electricity kWh multiplied by 0.82', async () => {
      const res = await request(server())
        .get('/api/sustainability-metrics/summary?from=2026-01&to=2026-08')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      const { totals } = res.body.data;
      expect(totals.energy_kwh).toBeGreaterThan(0);
      const expectedKg = Math.round(totals.energy_kwh * GRID_CO2_KG_PER_KWH);
      expect(totals.emissions_kg).toBe(expectedKg);
      expect(totals.emissions_t).toBe(Number((expectedKg / 1000).toFixed(2)));
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
      expect(preview.metrics.energyReduction).toBeDefined();
      expect(preview.metrics.waterSaved).toBeDefined();
      expect(preview.metrics.carbonOffset).toBeDefined();
      expect(preview.metrics.wasteDiverted).toBeDefined();
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

  describe('DELETE /api/sustainability-reports/:id', () => {
    it('allows a Sustainability Officer to delete a report', async () => {
      // First create a report to delete
      const createRes = await request(server())
        .post('/api/sustainability-reports')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .send({
          title: 'Temporary Test Report',
          period: '2026-05',
          generated_by_id: '550e8400-0005-4000-8000-000000000005',
          metrics: { energyReduction: '-5.0%' },
          generated_at: new Date().toISOString(),
        })
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

  describe('Wastage seed normalization', () => {
    it('seeds all wastage reports with normalized status "pending"', async () => {
      const res = await request(server())
        .get('/api/wastage-reports')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-001')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      for (const report of res.body.data) {
        expect(report.status.toLowerCase()).toBe('pending');
      }
    });
  });
});
