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
 * "Still broken": the reporter says a fixed issue is not fixed. They must say
 * what is still wrong and may add a photo. The new job goes first to the
 * technician who did the fix; if they cannot take it, it is ranked as usual
 * and the coordinator is told.
 */
describe('Still broken (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const http = () => request(app.getHttpServer());
  const body = (res: request.Response) => res.body?.data ?? res.body;

  const ORG = 'org-001';
  const BUILDING = '660e8800-0001-4000-8000-000000000000';
  const asVisitor = { 'x-role': 'Campus Visitor', 'x-org-id': ORG };
  const asCoordinator = { 'x-role': 'Operations Coordinator', 'x-org-id': ORG };
  // A 1×1 PNG, so the file-signature check sees a real image.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalGuards(new RolesGuard(app.get(Reflector)));
    await app.init();
    db = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  /** A plumber who can take a small job right now. */
  const freePlumber = async (except?: string) => {
    const queue = body(await http().get('/api/dispatch/queue').set(asCoordinator));
    const p = queue.team_status.find(
      (t: any) => t.team === 'plumber' && t.available && t.open_points + 1 <= t.max_load && t.user_id !== except,
    );
    expect(p).toBeDefined();
    return p.user_id as string;
  };

  let floor = 1;
  /** Files a tap report as the visitor, then marks it fixed by `technicianId`. Returns the ticket id. */
  const fixedReport = async (technicianId: string) => {
    floor += 1;
    const res = await http()
      .post('/api/service-requests/reports')
      .set(asVisitor)
      .send({ building_id: BUILDING, floor: String(floor), area: 'restroom', part: 'end_of_corridor', item_id: 'tap', problem_id: 'dripping', how_many: 'one' });
    expect(res.status).toBe(201);
    expect(body(res).outcome).toBe('created');
    const id = body(res).ticket.id as string;
    const ticket = db.serviceRequests.find((t) => t.service_request_id === id)!;
    const wo = db.workOrders.find((w) => w.source_request_id === id)!;
    wo.assigned_to_id = technicianId;
    wo.status = 'closed' as any;
    ticket.status = 'closed';
    ticket.closed_at = new Date().toISOString();
    return id;
  };
  const newTicketFrom = (id: string) => db.serviceRequests.find((t) => t.reopened_from === id)!;
  const workOrderOf = (ticketId: string) => db.workOrders.find((w) => w.source_request_id === ticketId && w.status !== 'closed');

  it('needs a reason', async () => {
    const id = await fixedReport(await freePlumber());
    const res = await http().post(`/api/service-requests/${id}/still-broken`).set(asVisitor).send({});
    expect(res.status).toBe(400);
    const short = await http().post(`/api/service-requests/${id}/still-broken`).set(asVisitor).send({ reason: 'no' });
    expect(short.status).toBe(400);
    expect(JSON.stringify(short.body)).toContain('what is still wrong');
  });

  it('goes back first to the technician who fixed it, with the reason on the job', async () => {
    const plumber = await freePlumber();
    const id = await fixedReport(plumber);
    const res = await http()
      .post(`/api/service-requests/${id}/still-broken`)
      .set(asVisitor)
      .send({ reason: 'Still drips when turned off' });
    expect(res.status).toBe(201);
    const t = newTicketFrom(id);
    expect(t.reopen_reason).toBe('Still drips when turned off');
    expect(t.description).toBe('Still broken: Still drips when turned off');
    expect(workOrderOf(t.service_request_id)!.assigned_to_id).toBe(plumber);
    // Asked once only: a later decline is ranked as usual.
    expect(t.prefer_technician_id).toBeNull();
  });

  it('when that technician cannot take it, ranks as usual and tells the coordinator', async () => {
    const plumber = await freePlumber();
    const id = await fixedReport(plumber);
    const user = db.users.find((u) => u.user_id === plumber)!;
    const was = { available: user.available, switched_off_on: user.switched_off_on };
    user.available = false;
    user.switched_off_on = new Date().toISOString().slice(0, 10);
    try {
      const before = db.notifications.length;
      const res = await http().post(`/api/service-requests/${id}/still-broken`).set(asVisitor).send({ reason: 'Handle came loose again' });
      expect(res.status).toBe(201);
      const t = newTicketFrom(id);
      expect(workOrderOf(t.service_request_id)?.assigned_to_id ?? null).not.toBe(plumber);
      const told = db.notifications.slice(before).map((n: any) => n.message);
      expect(told.some((m: string) => m.includes('who fixed it before') && m.includes('is not available today'))).toBe(true);
    } finally {
      Object.assign(user, was);
    }
  });

  it('takes an optional photo, which staff and the reporter can view', async () => {
    const id = await fixedReport(await freePlumber());
    const res = await http()
      .post(`/api/service-requests/${id}/still-broken`)
      .set(asVisitor)
      .field('reason', 'Water on the floor again')
      .attach('photo', PNG, { filename: 'tap.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const t = newTicketFrom(id);
    expect(t.reopen_photo).toBeTruthy();
    const view = await http().get(`/api/service-requests/${t.service_request_id}/reopen-photo`).set(asCoordinator);
    expect(view.status).toBe(200);
    expect(view.headers['content-type']).toContain('image/png');
    // The list staff load never carries the file's place on disk.
    const list = body(await http().get('/api/service-requests').set(asCoordinator));
    const row = list.find((x: any) => x.service_request_id === t.service_request_id);
    expect(row.has_reopen_photo).toBe(true);
    expect(row.reopen_photo).toBeUndefined();
    const one = body(await http().get(`/api/service-requests/${t.service_request_id}`).set(asCoordinator));
    expect(one.reopen_photo).toBeUndefined();
  });

  it('My Reports gives the reporter their form back exactly as filed; campus issues never show it', async () => {
    floor += 1;
    const sent = { building_id: BUILDING, floor: String(floor), area: 'restroom', part: 'near_lift', item_id: 'tap', problem_id: 'running', how_many: 'one', since: 'hours', in_danger: false };
    const res = await http().post('/api/service-requests/reports').set(asVisitor).send(sent);
    const id = body(res).ticket.id;
    const mine = body(await http().get('/api/service-requests/mine').set(asVisitor)).find((t: any) => t.id === id);
    expect(mine.form).toMatchObject({ ...sent, floor: String(floor) });
    const campus = body(await http().get('/api/service-requests/campus-issues').set({ 'x-role': 'Technician', 'x-org-id': ORG }));
    for (const t of campus) expect(t.form).toBeNull();
  });

  it('a still-broken report shows its reason in My Reports', async () => {
    const id = await fixedReport(await freePlumber());
    await http().post(`/api/service-requests/${id}/still-broken`).set(asVisitor).send({ reason: 'Leaks under the sink' });
    const t = newTicketFrom(id);
    const mine = body(await http().get('/api/service-requests/mine').set(asVisitor)).find((x: any) => x.id === t.service_request_id);
    expect(mine.reopen_reason).toBe('Leaks under the sink');
    expect(mine.form.description).toBe('Still broken: Leaks under the sink');
  });

  it('refuses a photo that is not really an image', async () => {
    const id = await fixedReport(await freePlumber());
    const res = await http()
      .post(`/api/service-requests/${id}/still-broken`)
      .set(asVisitor)
      .field('reason', 'Still dripping')
      .attach('photo', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });
});
