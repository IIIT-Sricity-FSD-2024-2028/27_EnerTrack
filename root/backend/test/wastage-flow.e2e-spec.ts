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
 * Stage 3: the wastage workflow is enforced on the server (T0) and every
 * move notifies the people concerned through server notifications that the
 * bell reads (T0b).
 */
describe('Wastage workflow and notifications (e2e)', () => {
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

  const idsWithRole = (role: string) =>
    db.users.filter((u) => u.organization_id === ORG && u.role === role).map((u) => u.user_id).sort();
  const notesFor = (reportId: string) =>
    db.notifications.filter((n) => n.target_id === reportId && n.target_type === NotificationTargetType.WASTAGE);

  const file = async () => {
    const res = await http()
      .post('/api/wastage-reports')
      .set(VISITOR)
      .send({
        reporter_id: REPORTER,
        type: 'Water',
        details: { priority: 'High', specificData: { location: 'Library', nature: 'Tap left running' } },
      });
    expect(res.status).toBe(201);
    return body(res).wastage_report_id as string;
  };
  const move = (who: Record<string, string>, id: string, status: string, extra: Record<string, unknown> = {}) =>
    http().patch(`/api/wastage-reports/${id}`).set(who).send({ status, ...extra });

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

  describe('filing a report', () => {
    it('stamps created_at and notifies the organisation\'s Sustainability Officers', async () => {
      const before = Date.now();
      const id = await file();
      const record = db.wastageReports.find((r) => r.wastage_report_id === id)!;
      expect(record.status).toBe('Reported');
      expect(Date.parse(record.created_at!)).toBeGreaterThanOrEqual(before - 1000);

      const notes = notesFor(id);
      expect(notes.map((n) => n.user_id).sort()).toEqual(idsWithRole('Sustainability Officer'));
      expect(notes[0].message).toBe(`New water wastage report ${reportRef(id)} at Library.`);
      expect(notes[0].created_at).toBeDefined();
    });

    it('seeds every wastage report with a filing date', () => {
      expect(db.wastageReports.every((r) => !!r.created_at)).toBe(true);
    });
  });

  describe('illegal moves are refused with 403', () => {
    it.each([
      ['Sustainability Officer', 'Reported', 'Delivered'],
      ['Sustainability Officer', 'Reported', 'Target Set'],
      ['Sustainability Officer', 'Reported', 'Cost Impact Added'],
      ['Financial Analyst', 'Reported', 'Validated'],
      ['Financial Analyst', 'Reported', 'Delivered'],
    ])('%s cannot move %s → %s', async (role, _from, to) => {
      const id = await file();
      const res = await move(as(role), id, to);
      expect(res.status).toBe(403);
      expect(res.body.message).toContain(`to '${to}'`);
      expect(db.wastageReports.find((r) => r.wastage_report_id === id)!.status).toBe('Reported');
    });

    it('Finance cannot set a target on a validated report', async () => {
      const id = await file();
      expect((await move(SO, id, 'Validated')).status).toBe(200);
      const res = await move(FA, id, 'Target Set');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('No move is allowed from here');
    });

    it('the Officer cannot add Finance\'s cost impact, and is told what is allowed', async () => {
      const id = await file();
      await move(SO, id, 'Validated');
      const res = await move(SO, id, 'Cost Impact Added');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Allowed next: 'Forwarded to Finance', 'Target Set', 'Finalized', 'Dismissed'");
      await move(SO, id, 'Forwarded to Finance');
      expect((await move(SO, id, 'Cost Impact Added')).status).toBe(403);
    });

    it('a full replace (PUT) cannot skip the workflow either', async () => {
      const id = await file();
      const res = await http()
        .put(`/api/wastage-reports/${id}`)
        .set(ADMIN)
        .send({ reporter_id: REPORTER, type: 'Water', status: 'Delivered', details: {} });
      expect(res.status).toBe(403);
    });
  });

  describe('the full path through Finance', () => {
    it('allows each legal step and notifies the right people at each one', async () => {
      const id = await file();
      const ref = reportRef(id);
      const after = (n: number) => notesFor(id).slice(n);
      let seen = notesFor(id).length; // the "new report" notes

      const step = async (who: Record<string, string>, status: string, extra = {}) => {
        const res = await move(who, id, status, extra);
        expect(res.status).toBe(200);
        expect(body(res).status).toBe(status);
        const fresh = after(seen);
        seen = notesFor(id).length;
        return fresh;
      };

      let fresh = await step(SO, 'Validated');
      expect(fresh.map((n) => n.user_id)).toEqual([REPORTER]);
      expect(fresh[0].message).toBe(`Your water report ${ref} has been confirmed and is being looked into.`);

      fresh = await step(SO, 'Forwarded to Finance');
      expect(fresh.map((n) => n.user_id).sort()).toEqual(idsWithRole('Financial Analyst'));
      expect(fresh[0].message).toBe(`Wastage report ${ref} needs a cost estimate.`);

      fresh = await step(FA, 'Cost Impact Added', { details: { costImpact: { annual: 1000 } } });
      expect(fresh).toHaveLength(0);

      fresh = await step(FA, 'Returned to SO');
      expect(fresh.map((n) => n.user_id).sort()).toEqual(idsWithRole('Sustainability Officer'));

      fresh = await step(SO, 'Target Set');
      expect(fresh.map((n) => n.user_id)).toEqual([REPORTER]);

      // A target is always checked before the report closes.
      fresh = await step(SO, 'Verify Target');
      expect(fresh.map((n) => n.user_id).sort()).toEqual(idsWithRole('Sustainability Officer'));

      fresh = await step(SO, 'Target Met');
      expect(fresh.map((n) => n.user_id)).toEqual([REPORTER]);
      expect(fresh[0].message).toBe(`Good news: the reduction target for your water report ${ref} was met.`);

      fresh = await step(SO, 'Delivered');
      expect(fresh.map((n) => n.user_id)).toEqual([REPORTER]);
      expect(fresh[0].message).toBe(`The outcome of your water report ${ref} is ready to read.`);
    });

    it('lets the Officer skip Finance and set a target straight after validating', async () => {
      const id = await file();
      await move(SO, id, 'Validated');
      expect((await move(SO, id, 'Target Set')).status).toBe(200);
    });

    it('tells the reporter why a report was dismissed', async () => {
      const id = await file();
      const res = await move(SO, id, 'Dismissed', { details: { dismissReason: 'Duplicate of another report' } });
      expect(res.status).toBe(200);
      const note = notesFor(id).find((n) => n.user_id === REPORTER)!;
      expect(note.message).toBe(`Your water report ${reportRef(id)} was closed without action: Duplicate of another report.`);
    });
  });

  it('deleting a report also removes its notifications', async () => {
    const id = await file();
    expect(notesFor(id).length).toBeGreaterThan(0);
    await http().delete(`/api/wastage-reports/${id}`).set(ADMIN).expect(200);
    expect(notesFor(id)).toHaveLength(0);
  });

  describe('saving without changing the status', () => {
    it('is always allowed and sends no notification', async () => {
      const id = await file();
      const before = notesFor(id).length;
      const res = await move(SO, id, 'Reported', { details: { soArchived: false, note: 'checked sensor' } });
      expect(res.status).toBe(200);
      expect(notesFor(id)).toHaveLength(before);
    });

    it('treats a seeded "pending" report as Reported', async () => {
      const seeded = db.wastageReports.find((r) => r.organization_id === ORG && r.status === 'pending')!;
      const keep = await move(SO, seeded.wastage_report_id, 'Reported', { details: { ...seeded.details } });
      expect(keep.status).toBe(200);
      expect(body(keep).status).toBe('pending'); // stored spelling kept
      const res = await move(SO, seeded.wastage_report_id, 'Validated', { details: { ...seeded.details } });
      expect(res.status).toBe(200);
      expect(body(res).status).toBe('Validated');
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
