import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';

/**
 * What a new service request and a new wastage report must look like when a
 * Campus Visitor files one: valid fields, and always starting at the first
 * status. Later statuses are set by staff through PATCH.
 */
describe('Campus visitor: create rules (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const ORG = 'org-001';
  const TRISHANK = '550e8400-0006-4000-8000-000000000006';
  const asVisitor = { 'x-role': 'Campus Visitor', 'x-org-id': ORG };
  const asTechAdmin = { 'x-role': 'Operations Coordinator', 'x-org-id': ORG };
  const asOfficer = { 'x-role': 'Sustainability Officer', 'x-org-id': ORG };
  const asAdmin = { 'x-role': 'Organization Admin', 'x-org-id': ORG };
  const body = (res: request.Response) => res.body?.data ?? res.body;

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

  describe('service requests', () => {
    // What the Report an Issue page sends
    const valid = () => ({
      reporter_id: TRISHANK,
      category: 'General',
      issue_type: 'General',
      description: '[General] Tap leaking — Location: Block B',
      priority: 'medium',
      status: 'open',
    });
    const file = (changes: object) =>
      http().post('/api/service-requests').set(asTechAdmin).send({ ...valid(), ...changes });

    it('accepts what the Report an Issue page sends, as open', async () => {
      const res = await file({});
      expect(res.status).toBe(201);
      expect(body(res).status).toBe('open');
    });

    it('starts open when no status is sent', async () => {
      const { status, ...noStatus } = valid();
      const res = await http().post('/api/service-requests').set(asTechAdmin).send(noStatus);
      expect(res.status).toBe(201);
      expect(body(res).status).toBe('open');
    });

    it('records when the request was filed', async () => {
      const before = Date.now();
      const res = await file({});
      const filed = new Date(body(res).created_at).getTime();
      expect(filed).toBeGreaterThanOrEqual(before - 1000);
      expect(filed).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('keeps the filing date through a full replace (PUT)', async () => {
      const created = body(await file({}));
      const res = await http()
        .put(`/api/service-requests/${created.service_request_id}`)
        .set(asAdmin)
        .send({ ...valid(), description: 'Replaced' });
      expect(res.status).toBe(200);
      expect(body(res).created_at).toBe(created.created_at);
    });

    it.each(['low', 'medium', 'high', 'High'])('accepts priority %s', async (priority) => {
      expect((await file({ priority })).status).toBe(201);
    });

    it.each(['banana', 'urgent', ''])('rejects priority %j', async (priority) => {
      expect((await file({ priority })).status).toBe(400);
    });

    it.each(['closed', 'in_progress'])('rejects a new request that starts as %s', async (status) => {
      expect((await file({ status })).status).toBe(400);
    });

    it.each(['', '   '])('rejects description %j', async (description) => {
      expect((await file({ description })).status).toBe(400);
    });

    it('rejects a missing description', async () => {
      const { description, ...none } = valid();
      const res = await http().post('/api/service-requests').set(asTechAdmin).send(none);
      expect(res.status).toBe(400);
    });

    it('still lets a Operations Coordinator move a request on afterwards', async () => {
      const id = body(await file({})).service_request_id;
      const res = await http()
        .patch(`/api/service-requests/${id}`)
        .set(asTechAdmin)
        .send({ status: 'in_progress' });
      expect(res.status).toBe(200);
      expect(body(res).status).toBe('in_progress');
    });
  });

  describe('wastage', () => {
    // Occupants report waste as an issue (e.g. lights left on); only the
    // Sustainability Officer opens a wastage case, for a pattern of waste.
    it('an occupant cannot file a wastage report any more (403)', async () => {
      const res = await http()
        .post('/api/wastage-reports')
        .set(asVisitor)
        .send({ reporter_id: TRISHANK, type: 'Water', details: { specificData: { location: 'Cafeteria Kitchen' } } });
      expect(res.status).toBe(403);
    });

    it('the Sustainability Officer opens a case, which starts Open', async () => {
      const res = await http().post('/api/wastage-reports').set(asOfficer).send({ type: 'Water', details: { location: 'Cafeteria Kitchen' } });
      expect(res.status).toBe(201);
      expect(body(res).status).toBe('Open');
    });

    it.each(['Closed', 'Target Set', 'Dismissed'])('a new case cannot start as %s', async (status) => {
      const res = await http().post('/api/wastage-reports').set(asOfficer).send({ type: 'Water', status, details: {} });
      expect(res.status).toBe(400);
    });
  });
});
