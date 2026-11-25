import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { DatabaseService, NotificationTargetType } from '../src/core/database/database.service';
import { reportRef } from '../src/modules/wastage-reports/wastage-reports.service';

/**
 * Wastage cases: a pattern of waste the Sustainability Officer tackles.
 * Single incidents are issue reports and never come here. The workflow is
 * enforced on the server, Finance is involved only for a remedy that needs
 * spending, and closing a case tells the people who reported the incidents
 * behind it.
 */
describe('Wastage case workflow and notifications (e2e)', () => {
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
  const VISITOR = as('Campus Visitor');

  const NO_COST = { type: 'no_cost', description: 'Housekeeping switch-off round at 6 pm' };
  const SPEND = { type: 'spend', description: 'Motion-sensor lights in LH-2', estimate: 40000 };

  const idsWithRole = (role: string) =>
    db.users.filter((u) => u.organization_id === ORG && u.role === role).map((u) => u.user_id).sort();
  const notesFor = (caseId: string) =>
    db.notifications.filter((n) => n.target_id === caseId && n.target_type === NotificationTargetType.WASTAGE);

  /** A waste incident as an occupant would have reported it, straight into the store. */
  let t = 0;
  const incident = (reporters: string[] = [REPORTER]) => {
    const id = `wf-ticket-${++t}-${Date.now()}`;
    db.serviceRequests.push({
      service_request_id: id,
      organization_id: ORG,
      reporter_id: reporters[0],
      reporter_ids: reporters,
      assigned_to_id: null,
      category: 'Waste',
      issue_type: 'Lights left on',
      status: 'closed',
      created_at: new Date().toISOString(),
      part: 'LH-2',
    } as any);
    return id;
  };

  const open = async (extra: Record<string, unknown> = {}) => {
    const res = await http()
      .post('/api/wastage-reports')
      .set(SO)
      .send({ type: 'Energy', details: { title: 'Lights left on in LH-2', location: 'LH-2' }, ...extra });
    expect(res.status).toBe(201);
    return body(res).wastage_report_id as string;
  };
  const move = (who: Record<string, string>, id: string, status: string, extra: Record<string, unknown> = {}) =>
    http().patch(`/api/wastage-reports/${id}`).set(who).send({ status, ...extra });
  const statusOf = (id: string) => db.wastageReports.find((r) => r.wastage_report_id === id)!.status;

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

  describe('opening a case', () => {
    it('is done by the Sustainability Officer, starts Open, links its incidents and notifies nobody', async () => {
      const ticket = incident();
      const before = Date.now();
      const id = await open({ source_request_ids: [ticket, ticket] });
      const record = db.wastageReports.find((r) => r.wastage_report_id === id)!;
      expect(record.status).toBe('Open');
      expect(record.source_request_ids).toEqual([ticket]); // duplicates dropped
      expect(Date.parse(record.created_at!)).toBeGreaterThanOrEqual(before - 1000);
      expect(notesFor(id)).toHaveLength(0);
    });

    it.each(['Campus Visitor', 'Financial Analyst', 'Technician'])('is refused to %s (403)', async (role) => {
      const res = await http().post('/api/wastage-reports').set(as(role)).send({ type: 'Water', details: {} });
      expect(res.status).toBe(403);
    });

    it('refuses a case that does not start Open', async () => {
      const res = await http().post('/api/wastage-reports').set(SO).send({ type: 'Water', status: 'Target Set', details: {} });
      expect(res.status).toBe(400);
    });

    it('refuses an unknown linked issue (404)', async () => {
      const res = await http()
        .post('/api/wastage-reports')
        .set(SO)
        .send({ type: 'Water', details: {}, source_request_ids: ['no-such-ticket'] });
      expect(res.status).toBe(404);
    });

    it('seeds every case Open, owned by the officer, with a date', () => {
      const seeded = db.wastageReports.filter((r) => r.wastage_report_id.startsWith('wwww'));
      expect(seeded.length).toBeGreaterThan(0);
      for (const r of seeded) {
        expect(r.status).toBe('Open');
        expect(idsWithRole('Sustainability Officer')).toContain(r.reporter_id);
        expect(r.created_at).toBeTruthy();
      }
    });
  });

  describe('illegal moves are refused with 403', () => {
    it.each([
      ['Sustainability Officer', 'Closed'],
      ['Sustainability Officer', 'Verify Target'],
      ['Sustainability Officer', 'Cost Impact Added'],
      ['Financial Analyst', 'Target Set'],
      ['Financial Analyst', 'Closed'],
    ])('%s cannot move Open → %s', async (role, to) => {
      const id = await open({ details: { remedy: NO_COST } });
      const res = await move(as(role), id, to);
      expect(res.status).toBe(403);
      expect(res.body.message).toContain(`to '${to}'`);
      expect(statusOf(id)).toBe('Open');
    });

    it("the Officer cannot add Finance's cost impact, and is told what is allowed", async () => {
      const id = await open({ details: { remedy: SPEND } });
      const res = await move(SO, id, 'Cost Impact Added');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Allowed next: 'Target Set', 'Forwarded to Finance', 'Dismissed'");
    });

    it('a full replace (PUT) cannot skip the workflow either', async () => {
      const id = await open();
      const res = await http()
        .put(`/api/wastage-reports/${id}`)
        .set(ADMIN)
        .send({ reporter_id: REPORTER, type: 'Water', status: 'Closed', details: {} });
      expect(res.status).toBe(403);
    });
  });

  describe('Finance only for a remedy that needs spending', () => {
    it('needs a remedy before the case can leave Open (400)', async () => {
      const id = await open();
      expect((await move(SO, id, 'Target Set')).status).toBe(400);
      expect((await move(SO, id, 'Forwarded to Finance')).status).toBe(400);
      expect(statusOf(id)).toBe('Open');
    });

    it('a no-cost remedy goes straight to a target, and Finance hears nothing', async () => {
      const id = await open();
      const res = await move(SO, id, 'Target Set', { details: { remedy: NO_COST } });
      expect(res.status).toBe(200);
      const analysts = idsWithRole('Financial Analyst');
      expect(notesFor(id).some((n) => analysts.includes(n.user_id))).toBe(false);
    });

    it('a no-cost remedy cannot be sent to Finance (403)', async () => {
      const id = await open({ details: { remedy: NO_COST } });
      const res = await move(SO, id, 'Forwarded to Finance');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Only a remedy that needs spending');
    });

    it('a remedy that needs spending cannot skip Finance (403)', async () => {
      const id = await open({ details: { remedy: SPEND } });
      const res = await move(SO, id, 'Target Set');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('costed by Finance');
    });

    it('a remedy that needs spending must say how much (400)', async () => {
      const id = await open({ details: { remedy: { type: 'spend', description: 'Timers' } } });
      expect((await move(SO, id, 'Forwarded to Finance')).status).toBe(400);
    });
  });

  describe('the full path through Finance', () => {
    it('allows each legal step, notifies the right people, and closes the loop with the reporters', async () => {
      const other = '550e8400-0004-4000-8000-000000000004';
      const id = await open({
        source_request_ids: [incident([REPORTER]), incident([other, REPORTER])],
        details: { title: 'LH-2 lights', location: 'LH-2', remedy: SPEND },
      });
      const ref = reportRef(id);
      let seen = 0;
      const step = async (who: Record<string, string>, status: string, extra = {}) => {
        const res = await move(who, id, status, extra);
        expect(res.status).toBe(200);
        expect(body(res).status).toBe(status);
        const fresh = notesFor(id).slice(seen);
        seen = notesFor(id).length;
        return fresh;
      };

      let fresh = await step(SO, 'Forwarded to Finance');
      expect(fresh.map((n) => n.user_id).sort()).toEqual(idsWithRole('Financial Analyst'));
      expect(fresh[0].message).toBe(`Wastage case ${ref} needs a cost estimate for its remedy.`);

      fresh = await step(FA, 'Cost Impact Added', { details: { location: 'LH-2', remedy: SPEND, costImpact: { annual: 1000 } } });
      expect(fresh).toHaveLength(0);

      fresh = await step(FA, 'Returned to SO');
      expect(fresh.map((n) => n.user_id).sort()).toEqual(idsWithRole('Sustainability Officer'));

      fresh = await step(SO, 'Target Set'); // costed now, so a spending remedy may have a target
      expect(fresh).toHaveLength(0);

      fresh = await step(SO, 'Verify Target');
      expect(fresh.map((n) => n.user_id).sort()).toEqual(idsWithRole('Sustainability Officer'));

      fresh = await step(SO, 'Target Met');
      expect(fresh).toHaveLength(0);

      fresh = await step(SO, 'Closed');
      expect(fresh.map((n) => n.user_id).sort()).toEqual([other, REPORTER].sort());
      expect(fresh[0].message).toBe(
        'Update on the waste you reported at LH-2: the Sustainability Officer has acted on it (Motion-sensor lights in LH-2). The reduction target was met.',
      );
    });

    it('a missed target can be tried again, or closed', async () => {
      const id = await open({ source_request_ids: [incident()], details: { remedy: NO_COST, location: 'LH-2' } });
      for (const s of ['Target Set', 'Verify Target', 'Target Missed', 'Target Set', 'Verify Target', 'Target Missed', 'Closed'])
        expect((await move(SO, id, s)).status).toBe(200);
      expect(notesFor(id).pop()!.message).toContain('The reduction target was not fully met.');
    });

    it('a case can be dismissed while Open, without telling anyone', async () => {
      const id = await open({ source_request_ids: [incident()] });
      const res = await move(SO, id, 'Dismissed', { details: { dismissReason: 'One-off, not a pattern' } });
      expect(res.status).toBe(200);
      expect(notesFor(id)).toHaveLength(0);
    });
  });

  describe('who can read a case', () => {
    it('a visitor sees only cases that grew from an issue they reported', async () => {
      // Tokens in e2e are signed for user_id "test-user".
      const mine = await open({ source_request_ids: [incident(['test-user'])] });
      const theirs = await open({ source_request_ids: [incident([REPORTER])] });
      const list = body(await http().get('/api/wastage-reports').set(VISITOR).expect(200)) as any[];
      expect(list.map((r) => r.wastage_report_id)).toContain(mine);
      expect(list.map((r) => r.wastage_report_id)).not.toContain(theirs);
      await http().get(`/api/wastage-reports/${theirs}`).set(VISITOR).expect(404);
      await http().get(`/api/wastage-reports/${mine}`).set(VISITOR).expect(200);
    });
  });

  it('deleting a case also removes its notifications', async () => {
    const id = await open({ details: { remedy: SPEND } });
    await move(SO, id, 'Forwarded to Finance').expect(200);
    expect(notesFor(id).length).toBeGreaterThan(0);
    await http().delete(`/api/wastage-reports/${id}`).set(ADMIN).expect(200);
    expect(notesFor(id)).toHaveLength(0);
  });

  describe('saving without changing the status', () => {
    it('is always allowed and sends no notification', async () => {
      const id = await open();
      const res = await move(SO, id, 'Open', { details: { note: 'checked the meter' } });
      expect(res.status).toBe(200);
      expect(notesFor(id)).toHaveLength(0);
    });

    it('reads older spellings ("pending", "Validated") as Open and keeps the stored spelling', async () => {
      const id = await open();
      const record = db.wastageReports.find((r) => r.wastage_report_id === id)!;
      record.status = 'pending';
      const keep = await move(SO, id, 'Open', { details: { remedy: NO_COST } });
      expect(keep.status).toBe(200);
      expect(body(keep).status).toBe('pending');
      record.status = 'Validated';
      const res = await move(SO, id, 'Target Set', { details: { remedy: NO_COST } });
      expect(res.status).toBe(200);
      expect(body(res).status).toBe('Target Set');
    });
  });

  describe('notifications are private to their recipient', () => {
    const mine = (who: Record<string, string>) => http().get('/api/notifications/mine').set(who);

    it('GET /notifications/mine returns only the signed-in user\'s, newest first', async () => {
      // Tokens in e2e are signed for user_id "test-user".
      db.notifications.push(
        { notification_id: 'n-old', organization_id: ORG, user_id: 'test-user', target_type: NotificationTargetType.WASTAGE, target_id: 'x', message: 'older', is_read: false, created_at: '2026-01-01T00:00:00.000Z' },
        { notification_id: 'n-new', organization_id: ORG, user_id: 'test-user', target_type: NotificationTargetType.WASTAGE, target_id: 'x', message: 'newer', is_read: false, created_at: '2026-02-01T00:00:00.000Z' },
        { notification_id: 'n-other', organization_id: ORG, user_id: REPORTER, target_type: NotificationTargetType.WASTAGE, target_id: 'x', message: 'someone else', is_read: false, created_at: '2026-03-01T00:00:00.000Z' },
      );
      const res = await mine(SO).expect(200);
      expect(body(res).map((n: any) => n.notification_id)).toEqual(['n-new', 'n-old']);
    });

    it('works for every signed-in role, including roles beyond the original five', async () => {
      await mine(as('Facility Manager')).expect(200);
      await mine(as('Campus Visitor')).expect(200);
    });

    it('PATCH /notifications/mine/read marks only the caller\'s as read', async () => {
      const res = await http().patch('/api/notifications/mine/read').set(SO).expect(200);
      expect(body(res).updated).toBeGreaterThanOrEqual(2);
      expect(db.notifications.find((n) => n.notification_id === 'n-new')!.is_read).toBe(true);
      expect(db.notifications.find((n) => n.notification_id === 'n-other')!.is_read).toBe(false);
    });

    it('cannot mark someone else\'s notification read (404, like a missing id)', async () => {
      await http().patch('/api/notifications/n-other/mark-read').set(SO).expect(404);
      expect(db.notifications.find((n) => n.notification_id === 'n-other')!.is_read).toBe(false);
    });

    it('GET /notifications lists only your own, unless you are the Organization Admin', async () => {
      const own = (res: any) => body(res).every((n: any) => n.user_id === 'test-user');
      expect(own(await http().get('/api/notifications').set(SO).expect(200))).toBe(true);
      expect(own(await http().get('/api/notifications').set(VISITOR).expect(200))).toBe(true);
      const all = body(await http().get('/api/notifications').set(ADMIN).expect(200));
      expect(all.some((n: any) => n.notification_id === 'n-other')).toBe(true);
    });

    it('GET /users/:id/notifications shows nothing of someone else\'s (unless Admin)', async () => {
      const other = await http().get(`/api/users/${REPORTER}/notifications`).set(SO).expect(200);
      expect(body(other)).toEqual([]);
      await http().get('/api/users/test-user/notifications').set(SO).expect(200);
      const admin = await http().get(`/api/users/${REPORTER}/notifications`).set(ADMIN).expect(200);
      expect(body(admin).length).toBeGreaterThan(0);
    });

    it('refuses an anonymous caller', async () => {
      await http().get('/api/notifications/mine').expect(403);
    });
  });
});
