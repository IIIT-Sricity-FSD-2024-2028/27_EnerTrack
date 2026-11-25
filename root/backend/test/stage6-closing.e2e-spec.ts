import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { DatabaseService, NotificationTargetType } from '../src/core/database/database.service';
import { lastFullMonth } from '../src/core/utils/period';
import { reportRef } from '../src/modules/wastage-reports/wastage-reports.service';

/**
 * Stage 6: wastage targets are checked after their deadline (T14), and
 * sustainability reports are signed off and kept unchanged once published
 * (T15). e2e tokens are signed for user_id "test-user".
 */
describe('Stage 6: target follow-up and report sign-off (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const http = () => request(app.getHttpServer());
  const body = (res: request.Response) => res.body?.data ?? res.body;

  const ORG = 'org-001';
  const REPORTER = '550e8400-0006-4000-8000-000000000006';
  const as = (role: string) => ({ 'x-role': role, 'x-org-id': ORG });
  const SO = as('Sustainability Officer');
  const FA = as('Financial Analyst');
  const ADMIN = as('Organization Admin');
  const notesFor = (type: NotificationTargetType, id: string) =>
    db.notifications.filter((n) => n.target_type === type && n.target_id === id);

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

  // ─────────────────────── T14 wastage target follow-up ───────────────────────

  describe('wastage target follow-up (T14)', () => {
    const move = (id: string, status: string, details?: Record<string, unknown>) =>
      http().patch(`/api/wastage-reports/${id}`).set(SO).send({ status, ...(details ? { details } : {}) });

    /** An issue REPORTER filed, which the case below grew out of. */
    let t = 0;
    const incident = () => {
      const id = `s6-ticket-${++t}-${Date.now()}`;
      db.serviceRequests.push({
        service_request_id: id, organization_id: 'org-001', reporter_id: REPORTER, reporter_ids: [REPORTER],
        assigned_to_id: null, category: 'Waste', issue_type: 'Lights left on', status: 'closed', created_at: new Date().toISOString(),
      } as any);
      return id;
    };

    /** A case linked to M-001 (whose electricity the seed cuts 12% from March 2026). */
    const fileLinked = async (readingValue = 100) => {
      const res = await http()
        .post('/api/wastage-reports')
        .set(SO)
        .send({
          type: 'Energy',
          sensor_reading_id: 'gen-M001-2026-01',
          source_request_ids: [incident()],
          details: { systemData: { readingValue, readingUnit: 'kW' }, location: 'Block A' },
        })
        .expect(201);
      return body(res).wastage_report_id as string;
    };
    const setTarget = async (id: string, value: number, deadline: string, setAt: string) => {
      const r = db.wastageReports.find((x) => x.wastage_report_id === id)!;
      await move(id, 'Target Set', {
        ...r.details,
        remedy: { type: 'no_cost', description: 'Switch-off rounds' },
        metricTarget: { value, unit: 'kW', deadline, setAt },
        targetSetAt: setAt,
      }).expect(200);
    };

    it('moves a case to Verify Target once its deadline has passed, and asks the officers', async () => {
      const id = await fileLinked();
      await setTarget(id, 95, '2026-06-30', '2026-02-10T00:00:00.000Z');
      const list = body(await http().get('/api/wastage-reports').set(SO).expect(200));
      expect(list.find((r: any) => r.wastage_report_id === id).status).toBe('Verify Target');
      const officerNote = notesFor(NotificationTargetType.WASTAGE, id).pop()!;
      expect(officerNote.message).toBe(`The target deadline for wastage case ${reportRef(id)} has passed; check whether it was met.`);
    });

    it('leaves a case with a future deadline alone', async () => {
      const id = await fileLinked();
      await setTarget(id, 95, '2099-01-01', '2026-02-10T00:00:00.000Z');
      const one = body(await http().get(`/api/wastage-reports/${id}`).set(SO).expect(200));
      expect(one.status).toBe('Target Set');
    });

    it('target-check measures the linked meter like for like and suggests an outcome', async () => {
      const id = await fileLinked(100);
      // A 5% cut (100 → 95) between March and June; the meter fell 12% on last year.
      await setTarget(id, 95, '2026-06-30', '2026-02-10T00:00:00.000Z');
      const c = body(await http().get(`/api/wastage-reports/${id}/target-check`).set(SO).expect(200));
      expect(c.meter.meter_code).toBe('M-001');
      expect(c.required_reduction_pct).toBe(5);
      expect(c.months_compared).toBe(4); // Mar–Jun 2026 vs Mar–Jun 2025
      expect(c.achieved_reduction_pct).toBe(12);
      expect(c.suggested).toBe('Target Met');
      expect(c.reason).toBe('The meter is 12% lower than the same months last year; the target needed a 5% cut.');
    });

    it('suggests Target Missed when the cut was not reached', async () => {
      const id = await fileLinked(100);
      await setTarget(id, 50, '2026-06-30', '2026-02-10T00:00:00.000Z'); // needs 50%
      const c = body(await http().get(`/api/wastage-reports/${id}/target-check`).set(SO).expect(200));
      expect(c.suggested).toBe('Target Missed');
    });

    it('makes no suggestion (and says why) without full months or without a meter', async () => {
      const recent = await fileLinked();
      const now = new Date().toISOString();
      await setTarget(recent, 95, '2099-01-01', now);
      const c1 = body(await http().get(`/api/wastage-reports/${recent}/target-check`).set(SO).expect(200));
      expect(c1.suggested).toBeNull();
      expect(c1.reason).toContain('no full month of readings since the target was set');

      const unlinked = body(
        await http().post('/api/wastage-reports').set(SO).send({ type: 'Water', details: {} }).expect(201),
      ).wastage_report_id;
      await setTarget(unlinked, 10, '2026-06-30', '2026-02-10T00:00:00.000Z');
      const c2 = body(await http().get(`/api/wastage-reports/${unlinked}/target-check`).set(SO).expect(200));
      expect(c2.meter).toBeNull();
      expect(c2.suggested).toBeNull();
      expect(c2.reason).toContain('not linked to a meter');
    });

    it('target-check needs a target (400)', async () => {
      const id = await fileLinked();
      await http().get(`/api/wastage-reports/${id}/target-check`).set(SO).expect(400);
    });

    it("Met and Missed are the officer's record; closing tells the reporter; Missed can retry", async () => {
      const met = await fileLinked();
      await setTarget(met, 95, '2026-06-30', '2026-02-10T00:00:00.000Z');
      await http().get('/api/wastage-reports').set(SO).expect(200); // promotes to Verify Target
      const before = notesFor(NotificationTargetType.WASTAGE, met).length;
      await move(met, 'Target Met').expect(200);
      expect(notesFor(NotificationTargetType.WASTAGE, met)).toHaveLength(before);
      await move(met, 'Closed').expect(200);
      const closing = notesFor(NotificationTargetType.WASTAGE, met).pop()!;
      expect(closing.user_id).toBe(REPORTER);
      expect(closing.message).toBe(
        'Update on the waste you reported at Block A: the Sustainability Officer has acted on it (Switch-off rounds). The reduction target was met.',
      );

      const missed = await fileLinked();
      await setTarget(missed, 50, '2026-06-30', '2026-02-10T00:00:00.000Z');
      await http().get('/api/wastage-reports').set(SO).expect(200);
      await move(missed, 'Target Missed').expect(200);
      await move(missed, 'Target Set').expect(200); // try again with a new target
    });

    it('refuses skipping to an outcome (Open → Target Met is 403), and Finance cannot decide it', async () => {
      const id = await fileLinked();
      await move(id, 'Target Met').expect(403);
      await setTarget(id, 95, '2026-06-30', '2026-02-10T00:00:00.000Z');
      await http().get('/api/wastage-reports').set(SO).expect(200);
      await http().patch(`/api/wastage-reports/${id}`).set(FA).send({ status: 'Target Met' }).expect(403);
    });

    it('the officer can check a target early (Target Set → Verify Target)', async () => {
      const id = await fileLinked();
      await setTarget(id, 95, '2099-01-01', '2026-02-10T00:00:00.000Z');
      await move(id, 'Verify Target').expect(200);
    });

    it.each(['Closed', 'Finalized', 'Delivered'])(
      'a case with a target cannot close without the check (Target Set → %s is 403)',
      async (next) => {
        const id = await fileLinked();
        await setTarget(id, 95, '2099-01-01', '2026-02-10T00:00:00.000Z');
        const res = await move(id, next).expect(403);
        expect(res.body.message).toContain("Allowed next: 'Verify Target'");
      },
    );
  });

  // ─────────────────────── T15 report sign-off ───────────────────────

  describe('report sign-off and immutable archive (T15)', () => {
    const LAST = lastFullMonth();
    const create = async () =>
      body(
        await http()
          .post('/api/sustainability-reports')
          .set(SO)
          .send({ period: 'Test month', from: LAST, to: LAST })
          .expect(201),
      );
    const status = (who: Record<string, string>, id: string, s: string, note?: string) =>
      http().patch(`/api/sustainability-reports/${id}/status`).set(who).send({ status: s, ...(note ? { note } : {}) });

    it('a new report is a draft with the extra sections where data exists', async () => {
      const r = await create();
      expect(r.status).toBe('draft');
      expect(r.buildings.length).toBeGreaterThan(0);
      expect(r.buildings.length).toBeLessThanOrEqual(5);
      expect(r.targets.some((t: any) => t.summary === 'cut electricity by 10% against 2025 by December 2026')).toBe(true);
      expect(r.initiatives).toBeUndefined(); // nothing completed in that month yet
    });

    it('the full path: SO submits, Org Admin approves and publishes; everyone is told', async () => {
      const r = await create();
      await status(SO, r.report_id, 'approved').expect(403); // the SO cannot approve
      const sub = body(await status(SO, r.report_id, 'submitted').expect(200));
      expect(sub.submitted_at).toBeDefined();
      const adminIds = db.users.filter((u) => u.organization_id === ORG && u.role === 'Organization Admin').map((u) => u.user_id).sort();
      expect(notesFor(NotificationTargetType.REPORT, r.report_id).map((n) => n.user_id).sort()).toEqual(adminIds);

      await status(SO, r.report_id, 'published').expect(403); // an SO cannot publish
      const ok = body(await status(ADMIN, r.report_id, 'approved').expect(200));
      expect(ok.approved_by_id).toBe('test-user');
      await status(ADMIN, r.report_id, 'draft').expect(403); // approved cannot be sent back
      const pub = body(await status(ADMIN, r.report_id, 'published').expect(200));
      expect(pub.status).toBe('published');
      expect(pub.published_at).toBeDefined();
      expect(notesFor(NotificationTargetType.REPORT, r.report_id).pop()!.message).toBe(`Your report "${r.title}" was published.`);
    });

    it('the Org Admin can send a submitted report back with a note', async () => {
      const r = await create();
      await status(SO, r.report_id, 'submitted').expect(200);
      const back = body(await status(ADMIN, r.report_id, 'draft', 'Add the water section').expect(200));
      expect(back.status).toBe('draft');
      expect(back.review_note).toBe('Add the water section');
      expect(notesFor(NotificationTargetType.REPORT, r.report_id).pop()!.message).toBe(
        `Your report "${r.title}" was sent back: Add the water section`,
      );
      // Editable again as a draft.
      await http().patch(`/api/sustainability-reports/${r.report_id}`).set(SO).send({ title: 'Renamed' }).expect(200);
    });

    it('a published report cannot be changed or deleted (409)', async () => {
      const r = await create();
      await status(SO, r.report_id, 'submitted').expect(200);
      await status(ADMIN, r.report_id, 'approved').expect(200);
      await status(ADMIN, r.report_id, 'published').expect(200);
      const patch = await http().patch(`/api/sustainability-reports/${r.report_id}`).set(SO).send({ title: 'x' }).expect(409);
      expect(patch.body.message).toContain('Restate it');
      await http().put(`/api/sustainability-reports/${r.report_id}`).set(ADMIN).send({ period: 'x', from: LAST, to: LAST }).expect(409);
      await http().delete(`/api/sustainability-reports/${r.report_id}`).set(ADMIN).expect(409);
    });

    it('a submitted report cannot be edited either', async () => {
      const r = await create();
      await status(SO, r.report_id, 'submitted').expect(200);
      await http().patch(`/api/sustainability-reports/${r.report_id}`).set(SO).send({ title: 'x' }).expect(409);
    });

    it('restating creates a linked draft and leaves the published report unchanged', async () => {
      const r = await create();
      await status(SO, r.report_id, 'submitted').expect(200);
      await status(ADMIN, r.report_id, 'approved').expect(200);
      const before = body(await status(ADMIN, r.report_id, 'published').expect(200));
      const fresh = body(await http().post(`/api/sustainability-reports/${r.report_id}/restate`).set(SO).expect(201));
      expect(fresh.status).toBe('draft');
      expect(fresh.supersedes).toBe(r.report_id);
      expect(fresh.title).toBe(`${r.title} (restated)`);
      const original = body(await http().get(`/api/sustainability-reports/${r.report_id}`).set(SO).expect(200));
      expect(original.superseded_by).toBe(fresh.report_id);
      expect(original.totals).toEqual(before.totals);
      expect(original.status).toBe('published');
      await http().post(`/api/sustainability-reports/${r.report_id}/restate`).set(SO).expect(409); // only once
    });

    it('deleting a restated draft frees the original to be restated again', async () => {
      const r = await create();
      await status(SO, r.report_id, 'submitted').expect(200);
      await status(ADMIN, r.report_id, 'approved').expect(200);
      await status(ADMIN, r.report_id, 'published').expect(200);
      const fresh = body(await http().post(`/api/sustainability-reports/${r.report_id}/restate`).set(SO).expect(201));
      await http().delete(`/api/sustainability-reports/${fresh.report_id}`).set(SO).expect(200);
      const original = body(await http().get(`/api/sustainability-reports/${r.report_id}`).set(SO).expect(200));
      expect(original.superseded_by).toBeNull();
      await http().post(`/api/sustainability-reports/${r.report_id}/restate`).set(SO).expect(201);
    });

    it('only a published report can be restated', async () => {
      const r = await create();
      await http().post(`/api/sustainability-reports/${r.report_id}/restate`).set(SO).expect(409);
    });

    it('drafts: the SO deletes their own; nobody deletes a submitted one', async () => {
      const mine = await create();
      await http().delete(`/api/sustainability-reports/${mine.report_id}`).set(SO).expect(200);

      const sent = await create();
      await status(SO, sent.report_id, 'submitted').expect(200);
      await http().delete(`/api/sustainability-reports/${sent.report_id}`).set(ADMIN).expect(409);

      const someoneElses = await create();
      db.sustainabilityReports.find((x) => x.report_id === someoneElses.report_id)!.generated_by_id = 'someone-else';
      await http().delete(`/api/sustainability-reports/${someoneElses.report_id}`).set(SO).expect(403);
      await http().delete(`/api/sustainability-reports/${someoneElses.report_id}`).set(ADMIN).expect(200);
    });

    it('seeded historical reports are published', async () => {
      const list = body(await http().get('/api/sustainability-reports').set(SO).expect(200));
      const seeded = list.filter((r: any) => r.report_id.startsWith('tttt'));
      expect(seeded.length).toBe(3);
      expect(seeded.every((r: any) => r.status === 'published')).toBe(true);
    });
  });
});
