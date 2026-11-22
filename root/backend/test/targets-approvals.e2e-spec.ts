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
  NotificationTargetType,
  TargetMetric,
  TargetStatus,
} from '../src/core/database/database.service';
import { addMonths, lastFullMonth, periodsBetween } from '../src/core/utils/period';

/**
 * Stage 4: sustainability targets (T9) and the initiative approval gate (T10).
 * e2e tokens are signed for user_id "test-user", whatever the role.
 */
describe('Targets and approvals (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const http = () => request(app.getHttpServer());
  const body = (res: request.Response) => res.body?.data ?? res.body;

  const ORG = 'org-001';
  const as = (role: string, org = ORG) => ({ 'x-role': role, 'x-org-id': org });
  const SO = as('Sustainability Officer');
  const ADMIN = as('Organization Admin');
  const ADMIN_IDS = () =>
    db.users.filter((u) => u.organization_id === ORG && u.role === 'Organization Admin').map((u) => u.user_id).sort();
  const notes = (type: NotificationTargetType, id: string) =>
    db.notifications.filter((n) => n.target_type === type && n.target_id === id);

  const LAST = lastFullMonth();
  const futureDeadline = addMonths(LAST, 6);
  const propose = (who: Record<string, string>, extra: Record<string, unknown> = {}) =>
    http()
      .post('/api/targets')
      .set(who)
      .send({
        metric: 'gas_m3',
        baseline_from: '2025-01',
        baseline_to: '2025-12',
        reduction_pct: 5,
        deadline: futureDeadline,
        ...extra,
      });

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

  // ─────────────────────────── Targets ───────────────────────────

  describe('seeded targets', () => {
    it('lists both with plain-language summaries and progress', async () => {
      const res = await http().get('/api/targets').set(SO).expect(200);
      const list = body(res);
      const elec = list.find((t: any) => t.target_id === 'tgt00000-0001-4000-8000-000000000000');
      const water = list.find((t: any) => t.target_id === 'tgt00000-0002-4000-8000-000000000000');
      expect(elec.summary).toBe('cut electricity by 10% against 2025 by December 2026');
      expect(water.summary).toBe('cut water by 5% against 2025 by June 2027');
      expect(elec.status).toBe('active');
      expect(water.status).toBe('proposed');
    });

    it('measures the active electricity target like-for-like against 2025', async () => {
      const p = body(await http().get('/api/targets/tgt00000-0001-4000-8000-000000000000/progress').set(SO).expect(200));
      const trackedTo = '2026-12' < LAST ? '2026-12' : LAST;
      expect(p.tracking_from).toBe('2026-01');
      expect(p.months_compared).toBe(periodsBetween('2026-01', trackedTo).length);
      expect(p.months.every((m: any) => m.baseline_period === `2025-${m.period.slice(5)}`)).toBe(true);
      // The seed cuts two meters by 12% from March 2026, so the reduction is real.
      expect(p.achieved_reduction_pct).toBeGreaterThan(5);
      expect(p.current_value).toBeLessThan(p.baseline_value);
      expect(p.target_value).toBe(Math.round(p.baseline_value * 0.9));
      expect(p.required_reduction_pct).toBeGreaterThan(0);
      expect(p.required_reduction_pct).toBeLessThanOrEqual(10);
      expect(p.on_track).toBe(p.achieved_reduction_pct >= p.required_reduction_pct);
      expect(p.meter_count).toBe(2); // live electricity meters; M-006 is decommissioned
    });

    it('gives a proposed target no on-track verdict', async () => {
      const p = body(await http().get('/api/targets/tgt00000-0002-4000-8000-000000000000/progress').set(SO).expect(200));
      expect(p.months_compared).toBeGreaterThan(0);
      expect(p.on_track).toBeNull();
      expect(p.required_reduction_pct).toBeNull();
    });

    it('keeps targets inside their organisation', async () => {
      const res = await http().get('/api/targets').set(as('Sustainability Officer', 'org-002')).expect(200);
      expect(body(res)).toHaveLength(0);
      await http().get('/api/targets/tgt00000-0001-4000-8000-000000000000').set(as('Sustainability Officer', 'org-002')).expect(404);
    });
  });

  describe('propose → approve (the T9 acceptance path)', () => {
    let id: string;

    it('SO proposes: always proposed, author from the token, Org Admins notified', async () => {
      const res = await propose(SO).expect(201);
      const t = body(res);
      id = t.target_id;
      expect(t.status).toBe('proposed');
      expect(t.created_by_id).toBe('test-user');
      expect(t.summary).toBe(`cut natural gas by 5% against 2025 by ${new Date(`${futureDeadline}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`);
      const sent = notes(NotificationTargetType.TARGET, id);
      expect(sent.map((n) => n.user_id).sort()).toEqual(ADMIN_IDS());
      expect(sent[0].message).toMatch(/^New target to approve: cut natural gas by 5%/);
    });

    it('a second open target for the same metric and scope is refused (409)', async () => {
      await propose(SO, { reduction_pct: 8 }).expect(409);
    });

    it('the SO cannot approve it (403)', async () => {
      const res = await http().patch(`/api/targets/${id}/status`).set(SO).send({ status: 'active' }).expect(403);
      expect(res.body.message).toContain("cannot move a target from 'proposed' to 'active'");
    });

    it('the Org Admin approves it; the proposer is told', async () => {
      const before = notes(NotificationTargetType.TARGET, id).length;
      const t = body(await http().patch(`/api/targets/${id}/status`).set(ADMIN).send({ status: 'active' }).expect(200));
      expect(t.status).toBe('active');
      expect(t.approved_by_id).toBe('test-user');
      expect(Date.parse(t.approved_at)).toBeGreaterThan(Date.now() - 60_000);
      const told = notes(NotificationTargetType.TARGET, id).slice(before);
      expect(told).toHaveLength(1);
      expect(told[0].message).toMatch(/was approved and is now being tracked\.$/);
    });

    it('progress comes back with months_compared > 0', async () => {
      const p = body(await http().get(`/api/targets/${id}/progress`).set(SO).expect(200));
      expect(p.months_compared).toBeGreaterThan(0);
      expect(p.unit).toBe('m³');
      expect(typeof p.achieved_reduction_pct).toBe('number');
    });

    it('an approved target cannot be withdrawn (409), but the Admin can close it', async () => {
      await http().delete(`/api/targets/${id}`).set(SO).expect(409);
      const t = body(await http().patch(`/api/targets/${id}/status`).set(ADMIN).send({ status: 'met' }).expect(200));
      expect(t.status).toBe('met');
      expect(t.closed_at).toBeDefined();
      // Closed is final.
      await http().patch(`/api/targets/${id}/status`).set(ADMIN).send({ status: 'active' }).expect(403);
    });
  });

  describe('reject and withdraw', () => {
    it('the Org Admin rejects with a reason the proposer sees', async () => {
      const t = body(await propose(SO, { metric: 'emissions_kg', reduction_pct: 20 }).expect(201));
      const r = body(
        await http().patch(`/api/targets/${t.target_id}/status`).set(ADMIN).send({ status: 'rejected', note: 'Too ambitious for one year' }).expect(200),
      );
      expect(r.status).toBe('rejected');
      expect(r.decision_note).toBe('Too ambitious for one year');
      expect(r.progress.on_track).toBeNull();
      const told = notes(NotificationTargetType.TARGET, t.target_id).pop()!;
      expect(told.message).toMatch(/was not approved: Too ambitious for one year$/);
    });

    it('the proposer can withdraw a proposal, and its notifications go with it', async () => {
      const t = body(await propose(SO, { metric: 'energy_kwh', building_ids: ['660e8800-0002-4000-8000-000000000000'] }).expect(201));
      await http().delete(`/api/targets/${t.target_id}`).set(SO).expect(200);
      expect(db.targets.some((x) => x.target_id === t.target_id)).toBe(false);
      expect(notes(NotificationTargetType.TARGET, t.target_id)).toHaveLength(0);
    });
  });

  describe('building scope', () => {
    it('measures only the meters in the chosen buildings', async () => {
      const m001 = db.meters.find((m) => m.meter_id === 'mmmm0000-0001-4000-8000-000000000000')!;
      const t = body(await propose(SO, { metric: 'energy_kwh', building_ids: [m001.building_id] }).expect(201));
      expect(t.progress.meter_count).toBe(
        db.meters.filter((m) => m.building_id === m001.building_id && m.meter_type === 'electricity' && m.status !== 'decommissioned').length,
      );
      expect(t.summary).toContain(' in Building ');
    });

    it('rejects a building from another organisation', async () => {
      await propose(SO, { metric: 'water_kl', building_ids: ['660e8800-0f02-4000-8000-000000000000'] }).expect(400);
    });
  });

  describe('validation', () => {
    it.each([
      ['a baseline that has not finished', { baseline_to: addMonths(LAST, 1) }],
      ['a baseline that ends before it starts', { baseline_from: '2025-12', baseline_to: '2025-01' }],
      ['a deadline that has already passed', { deadline: LAST }],
      ['a malformed month', { deadline: '2026-13' }],
      ['a zero reduction', { reduction_pct: 0 }],
      ['an unknown metric', { metric: 'happiness' }],
      ['a status in the body', { status: 'active' }],
    ])('refuses %s (400)', async (_label, extra) => {
      await propose(SO, { metric: 'water_kl', building_ids: ['660e8800-0003-4000-8000-000000000000'], ...extra }).expect(400);
    });
  });

  describe('closing at the deadline', () => {
    const add = (id: string, reduction: number) =>
      db.targets.push({
        target_id: id,
        organization_id: ORG,
        created_by_id: 'test-user',
        metric: TargetMetric.ENERGY_KWH,
        baseline_from: '2025-01',
        baseline_to: '2025-12',
        reduction_pct: reduction,
        deadline: '2026-06',
        building_ids: ['660e8800-0001-4000-8000-000000000000'],
        status: TargetStatus.ACTIVE,
        created_at: '2026-01-02T00:00:00.000Z',
        approved_at: '2026-01-05T00:00:00.000Z',
      });

    it('closes an active target as met or missed once its deadline month has finished', async () => {
      add('due-met', 1);
      add('due-missed', 60);
      const list = body(await http().get('/api/targets').set(SO).expect(200));
      const met = list.find((t: any) => t.target_id === 'due-met');
      const missed = list.find((t: any) => t.target_id === 'due-missed');
      expect(met.status).toBe('met');
      expect(missed.status).toBe('missed');
      expect(typeof met.final_reduction_pct).toBe('number');
      expect(met.closed_at).toBeDefined();
      expect(notes(NotificationTargetType.TARGET, 'due-missed').pop()!.message).toMatch(/It was missed, with a .*% reduction\.$/);
    });
  });

  // ──────────────────── Initiative approval gate ────────────────────

  describe('initiative approval gate (T10)', () => {
    const base = { title: 'Chiller retune', description: 'Tune setpoints', feasible: true, target_reduction: '6%' };
    const create = async () => body(await http().post('/api/initiatives').set(SO).send({ ...base, status: 'proposed' }).expect(201));
    const patch = (who: Record<string, string>, id: string, payload: Record<string, unknown>) =>
      http().patch(`/api/initiatives/${id}`).set(who).send(payload);

    it('a new initiative cannot start as approved (400)', async () => {
      await http().post('/api/initiatives').set(SO).send({ ...base, status: 'approved' }).expect(400);
    });

    it('proposing notifies the Org Admins', async () => {
      const i = await create();
      expect(i.status).toBe('proposed');
      const sent = notes(NotificationTargetType.INITIATIVE, i.initiative_id);
      expect(sent.map((n) => n.user_id).sort()).toEqual(ADMIN_IDS());
      expect(sent[0].message).toBe('New initiative to approve: Chiller retune.');
    });

    it('an SO PATCH from proposed to approved is 403', async () => {
      const i = await create();
      const res = await patch(SO, i.initiative_id, { status: 'approved' }).expect(403);
      expect(res.body.message).toContain("cannot move an initiative from 'proposed' to 'approved'");
    });

    it('the Org Admin approves; then the SO runs it to completion, one step at a time', async () => {
      const i = await create();
      const approved = body(await patch(ADMIN, i.initiative_id, { status: 'approved', decision_note: 'Go ahead' }).expect(200));
      expect(approved.decided_by_id).toBe('test-user');
      expect(approved.decision_note).toBe('Go ahead');
      expect(notes(NotificationTargetType.INITIATIVE, i.initiative_id).pop()!.message).toBe('Your initiative "Chiller retune" was approved.');

      await patch(SO, i.initiative_id, { status: 'completed' }).expect(403); // no skipping
      await patch(SO, i.initiative_id, { status: 'in-progress' }).expect(200);
      await patch(SO, i.initiative_id, { status: 'completed' }).expect(200);
      await patch(SO, i.initiative_id, { status: 'proposed' }).expect(403); // no going back
    });

    it('the Org Admin can reject with a reason', async () => {
      const i = await create();
      await patch(ADMIN, i.initiative_id, { status: 'rejected', decision_note: 'No budget this year' }).expect(200);
      expect(notes(NotificationTargetType.INITIATIVE, i.initiative_id).pop()!.message).toBe(
        'Your initiative "Chiller retune" was not approved: No budget this year',
      );
    });

    it('editing other fields of a proposal is still fine for the SO', async () => {
      const i = await create();
      const res = body(await patch(SO, i.initiative_id, { title: 'Chiller retune (phase 1)', status: 'proposed' }).expect(200));
      expect(res.title).toBe('Chiller retune (phase 1)');
    });

    it('a full replace (PUT) cannot skip the gate', async () => {
      const i = await create();
      await http().put(`/api/initiatives/${i.initiative_id}`).set(ADMIN).send({ ...base, status: 'completed' }).expect(403);
    });

    it('the SO can withdraw a proposal but not delete running work; the Admin can', async () => {
      const proposal = await create();
      await http().delete(`/api/initiatives/${proposal.initiative_id}`).set(SO).expect(200);

      const running = await create();
      await patch(ADMIN, running.initiative_id, { status: 'approved' }).expect(200);
      await patch(SO, running.initiative_id, { status: 'in-progress' }).expect(200);
      const refused = await http().delete(`/api/initiatives/${running.initiative_id}`).set(SO).expect(409);
      expect(refused.body.message).toContain('ask the Organization Admin');
      await http().delete(`/api/initiatives/${running.initiative_id}`).set(ADMIN).expect(200);
    });
  });
});
