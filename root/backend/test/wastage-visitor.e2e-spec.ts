import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';

/**
 * What a Campus Visitor can do to a wastage report after filing it: add a
 * comment and archive it once it is over. Both have their own routes, so the
 * visitor still cannot use PATCH /wastage-reports/:id to change anything else.
 */
describe('Wastage reports: visitor comments and archive (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const ORG = 'org-001';
  const TRISHANK = '550e8400-0006-4000-8000-000000000006';
  const asVisitor = { 'x-role': 'Campus Visitor', 'x-org-id': ORG };
  const asOfficer = { 'x-role': 'Sustainability Officer', 'x-org-id': ORG };
  const body = (res: request.Response) => res.body?.data ?? res.body;

  /** Files a report as the visitor and returns its id. */
  const fileReport = async () => {
    const res = await http()
      .post('/api/wastage-reports')
      .set(asVisitor)
      .send({ reporter_id: TRISHANK, type: 'Water', status: 'Reported', details: { priority: 'Medium' } });
    return body(res).wastage_report_id as string;
  };

  /** Moves a report to a status the way the Sustainability Officer does. */
  const setStatus = (id: string, status: string) =>
    http().patch(`/api/wastage-reports/${id}`).set(asOfficer).send({ status });

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
    it.each(['Delivered', 'Target Set', 'Finalized', 'Dismissed'])(
      'lets a visitor archive a %s report',
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

    it.each(['Reported', 'Validated', 'Forwarded to Finance'])(
      'refuses to archive a report that is still %s',
      async (status) => {
        const id = await fileReport();
        if (status !== 'Reported') await setStatus(id, status);
        const res = await http().patch(`/api/wastage-reports/${id}/archive`).set(asVisitor);
        expect(res.status).toBe(400);
      },
    );

    it('keeps the comments when archiving', async () => {
      const id = await fileReport();
      await http().post(`/api/wastage-reports/${id}/comments`).set(asVisitor).send({ text: 'thanks' });
      await setStatus(id, 'Delivered');
      const res = await http().patch(`/api/wastage-reports/${id}/archive`).set(asVisitor);
      expect(body(res).details.comments).toHaveLength(1);
    });
  });

  it('still refuses a visitor the general PATCH', async () => {
    const id = await fileReport();
    const res = await http().patch(`/api/wastage-reports/${id}`).set(asVisitor).send({ status: 'Delivered' });
    expect(res.status).toBe(403);
  });
});
