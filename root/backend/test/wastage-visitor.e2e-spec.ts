import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { DatabaseService } from '../src/core/database/database.service';

/**
 * What a Campus Visitor can do with wastage records.
 *
 * Their own older reports (filed before waste went through Report an Issue):
 * add a comment and archive it once it is over. Both have their own routes,
 * so the visitor still cannot use PATCH /wastage-reports/:id to change
 * anything else.
 *
 * A case the officer opened from an issue they reported: read only, and only
 * what came of it — never Finance's figures, notes or comments.
 */
describe('Wastage reports: visitor comments and archive (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const ORG = 'org-001';
  const TRISHANK = '550e8400-0006-4000-8000-000000000006';
  const asVisitor = { 'x-role': 'Campus Visitor', 'x-org-id': ORG };
  const asOfficer = { 'x-role': 'Sustainability Officer', 'x-org-id': ORG };
  const body = (res: request.Response) => res.body?.data ?? res.body;

  let db: DatabaseService;
  let n = 0;
  /**
   * Opens a case (as the officer) behind an issue the visitor reported, and
   * returns its id. Tokens in e2e are signed for user_id "test-user".
   */
  const fileReport = async () => {
    const ticket = `wv-ticket-${++n}-${Date.now()}`;
    db.serviceRequests.push({
      service_request_id: ticket,
      organization_id: ORG,
      reporter_id: 'test-user',
      reporter_ids: ['test-user', TRISHANK],
      assigned_to_id: null,
      category: 'Waste',
      issue_type: 'Tap left open',
      status: 'closed',
      created_at: new Date().toISOString(),
    } as any);
    const res = await http()
      .post('/api/wastage-reports')
      .set(asOfficer)
      .send({ type: 'Water', source_request_ids: [ticket], details: { priority: 'Medium', remedy: { type: 'no_cost', description: 'Signage' } } });
    const id = body(res).wastage_report_id as string;
    // An older report the visitor filed themselves (the case record is reused).
    db.wastageReports.find((r) => r.wastage_report_id === id)!.reporter_id = 'test-user';
    return id;
  };

  /** A case behind an issue the visitor reported, opened by the officer. */
  const linkedCase = async () => {
    const ticket = `wv-linked-${++n}-${Date.now()}`;
    db.serviceRequests.push({
      service_request_id: ticket,
      organization_id: ORG,
      reporter_id: 'test-user',
      reporter_ids: ['test-user'],
      assigned_to_id: null,
      category: 'Waste',
      issue_type: 'Tap left open',
      status: 'closed',
      created_at: new Date().toISOString(),
    } as any);
    const other = `wv-other-${n}-${Date.now()}`;
    db.serviceRequests.push({ ...db.serviceRequests[db.serviceRequests.length - 1], service_request_id: other, reporter_id: TRISHANK, reporter_ids: [TRISHANK] } as any);
    const res = await http()
      .post('/api/wastage-reports')
      .set(asOfficer)
      .send({
        type: 'Water',
        source_request_ids: [ticket, other],
        details: {
          title: 'Taps left open in Block B',
          location: 'Block B',
          notes: 'internal officer note',
          remedy: { type: 'spend', description: 'Push taps', estimate: 9000 },
          costImpact: { estimatedLoss: 1, remediationCost: 9000, projectedSavings: 5 },
          comments: [{ author: 'Viksa', role: 'Sustainability Officer', text: 'internal comment' }],
        },
      });
    return { id: body(res).wastage_report_id as string, ticket, other };
  };

  /**
   * Moves a report to a status the way the Sustainability Officer does: one
   * legal step at a time, since the server refuses skipped steps.
   */
  const PATH: Record<string, string[]> = {
    Open: [],
    'Target Set': ['Target Set'],
    'Verify Target': ['Target Set', 'Verify Target'],
    'Target Met': ['Target Set', 'Verify Target', 'Target Met'],
    Closed: ['Target Set', 'Verify Target', 'Target Met', 'Closed'],
    Dismissed: ['Dismissed'],
  };
  const setStatus = async (id: string, status: string) => {
    for (const step of PATH[status]) {
      const res = await http().patch(`/api/wastage-reports/${id}`).set(asOfficer).send({ status: step });
      expect(res.status).toBe(200);
    }
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
    db = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('comments', () => {
    it('lets a visitor add a comment', async () => {
      const id = await fileReport();
      const res = await http()
        .post(`/api/wastage-reports/${id}/comments`)
        .set(asVisitor)
        .send({ text: '  Still leaking today  ', author: 'Trishank' });
      expect(res.status).toBe(201);
      const comments = body(res).details.comments;
      expect(comments).toHaveLength(1);
      expect(comments[0]).toMatchObject({
        author: 'Trishank',
        role: 'Campus Visitor',
        text: 'Still leaking today',
      });
      expect(comments[0].timestamp).toBeDefined();
    });

    it('appends, keeping earlier comments', async () => {
      const id = await fileReport();
      await http().post(`/api/wastage-reports/${id}/comments`).set(asVisitor).send({ text: 'first' });
      const res = await http()
        .post(`/api/wastage-reports/${id}/comments`)
        .set(asOfficer)
        .send({ text: 'second' });
      expect(body(res).details.comments.map((c: any) => c.text)).toEqual(['first', 'second']);
    });

    it.each(['', '   '])('rejects an empty comment %j', async (text) => {
      const id = await fileReport();
      const res = await http().post(`/api/wastage-reports/${id}/comments`).set(asVisitor).send({ text });
      expect(res.status).toBe(400);
    });

    it('rejects a comment over 1000 characters', async () => {
      const id = await fileReport();
      const res = await http()
        .post(`/api/wastage-reports/${id}/comments`)
        .set(asVisitor)
        .send({ text: 'x'.repeat(1001) });
      expect(res.status).toBe(400);
    });

    it('refuses extra fields, so it cannot be used to change the report', async () => {
      const id = await fileReport();
      const res = await http()
        .post(`/api/wastage-reports/${id}/comments`)
        .set(asVisitor)
        .send({ text: 'hi', status: 'Delivered' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown report', async () => {
      const res = await http()
        .post('/api/wastage-reports/00000000-0000-4000-8000-000000000000/comments')
        .set(asVisitor)
        .send({ text: 'hi' });
      expect(res.status).toBe(404);
    });
  });

  describe('archive', () => {
    it.each(['Closed', 'Target Set', 'Target Met', 'Dismissed'])(
      'lets a visitor archive a %s case',
      async (status) => {
        const id = await fileReport();
        await setStatus(id, status);
        const res = await http().patch(`/api/wastage-reports/${id}/archive`).set(asVisitor);
        expect(res.status).toBe(200);
        expect(body(res).details.archived).toBe(true);
        expect(body(res).details.archivedAt).toBeDefined();
        expect(body(res).status).toBe(status); // archiving does not change the status
      },
    );

    it.each(['Open', 'Verify Target'])(
      'refuses to archive a case that is still %s',
      async (status) => {
        const id = await fileReport();
        await setStatus(id, status);
        const res = await http().patch(`/api/wastage-reports/${id}/archive`).set(asVisitor);
        expect(res.status).toBe(400);
      },
    );

    it('keeps the comments when archiving', async () => {
      const id = await fileReport();
      await http().post(`/api/wastage-reports/${id}/comments`).set(asVisitor).send({ text: 'thanks' });
      await setStatus(id, 'Closed');
      const res = await http().patch(`/api/wastage-reports/${id}/archive`).set(asVisitor);
      expect(body(res).details.comments).toHaveLength(1);
    });
  });

  describe('a case behind an issue the visitor reported', () => {
    it('shows only what came of it: no figures, notes, comments or other people\'s reports', async () => {
      const { id, ticket } = await linkedCase();
      const one = body(await http().get(`/api/wastage-reports/${id}`).set(asVisitor).expect(200));
      expect(one.details).toEqual({ title: 'Taps left open in Block B', location: 'Block B', remedy: { description: 'Push taps' } });
      expect(one.source_request_ids).toEqual([ticket]);
      const list = body(await http().get('/api/wastage-reports').set(asVisitor).expect(200)) as any[];
      expect(JSON.stringify(list.find((r) => r.wastage_report_id === id))).not.toMatch(/costImpact|internal|estimate|9000/);
    });

    it.each([
      ['comment', (id: string) => http().post(`/api/wastage-reports/${id}/comments`).set(asVisitor).send({ text: 'hi' })],
      ['archive', (id: string) => http().patch(`/api/wastage-reports/${id}/archive`).set(asVisitor)],
      ['view a photo', (id: string) => http().get(`/api/wastage-reports/${id}/photos/x.jpg`).set(asVisitor)],
    ])('cannot %s on it (404, like a missing id)', async (_what, call) => {
      const { id } = await linkedCase();
      expect((await call(id)).status).toBe(404);
    });

    it('a Department Head (treated as a visitor) gets the same limited view', async () => {
      const { id } = await linkedCase();
      const asHead = { 'x-role': 'Department Head', 'x-org-id': ORG };
      const list = body(await http().get('/api/wastage-reports').set(asHead).expect(200)) as any[];
      const seen = list.find((r) => r.wastage_report_id === id);
      expect(seen.details.notes).toBeUndefined();
      expect(seen.details.costImpact).toBeUndefined();
    });
  });

  it('still refuses a visitor the general PATCH', async () => {
    const id = await fileReport();
    const res = await http().patch(`/api/wastage-reports/${id}`).set(asVisitor).send({ status: 'Closed' });
    expect(res.status).toBe(403);
  });
});
