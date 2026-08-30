import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { BillingCycle, SubscriptionStatus } from '../src/core/database/database.service';
import {
  buildInvoice,
  seatOverageLine,
  seatsOverAllowance,
  subscriptionLine,
} from '../src/modules/billing/pricing';

/**
 * The subscription model, tested at both levels it can go wrong.
 *
 * The pure block checks the arithmetic in pricing.ts directly, because the
 * rule that decides what a client is charged should be readable and provable
 * without a running application. It is a small rule — tier fee, plus staff
 * over the allowance, plus GST — and the tests are correspondingly short.
 *
 * The HTTP block then proves those rules are reachable and enforced through
 * the real pipeline, and covers the two things the arithmetic cannot see:
 * who counts as a billable seat, and who is allowed to do what.
 */

/** A tier shaped like the seeded Growth plan. */
const plan: any = {
  plan_id: 'plan-test',
  name: 'Growth',
  tagline: '',
  base_monthly_fee: 35000,
  included_seats: 20,
  price_per_extra_seat: 1000,
  max_campuses: 3,
  features: [],
  is_active: true,
};

const subscription: any = {
  subscription_id: 'sub-test',
  organization_id: 'org-test',
  plan_id: 'plan-test',
  status: SubscriptionStatus.ACTIVE,
  billing_cycle: BillingCycle.MONTHLY,
  started_on: '2025-01-01',
  renews_on: '2027-01-01',
  cancelled_on: null,
};

describe('Subscription model — pricing engine (unit)', () => {
  describe('seatsOverAllowance', () => {
    it('counts staff beyond the included allowance', () => {
      expect(seatsOverAllowance(plan, 24)).toBe(4);
    });

    it('is zero, never negative, when the client is under its allowance', () => {
      expect(seatsOverAllowance(plan, 12)).toBe(0);
      expect(seatsOverAllowance(plan, 0)).toBe(0);
    });
  });

  describe('subscriptionLine', () => {
    it('bills the flat tier fee monthly', () => {
      const line = subscriptionLine(plan, BillingCycle.MONTHLY, 'sub-test');
      expect(line.amount).toBe(35000);
      expect(line.description).toContain('20 staff seats');
      expect(line.description).toContain('3 campuses');
    });

    it('applies the annual discount over twelve months', () => {
      const line = subscriptionLine(plan, BillingCycle.ANNUAL, 'sub-test');
      expect(line.amount).toBe(Math.round(35000 * 12 * 0.9));
    });

    it('describes an unlimited tier without a campus number', () => {
      const line = subscriptionLine(
        { ...plan, max_campuses: null },
        BillingCycle.MONTHLY,
        'sub-test',
      );
      expect(line.description).toContain('unlimited campuses');
    });
  });

  describe('seatOverageLine', () => {
    it('charges per staff account beyond the allowance', () => {
      const line = seatOverageLine(plan, 24, BillingCycle.MONTHLY, 'sub-test');
      expect(line).not.toBeNull();
      expect(line!.quantity).toBe(4);
      expect(line!.amount).toBe(4000);
    });

    it('produces no line at all when the client is inside its allowance', () => {
      // A small tenant should get a one-line invoice, not a zero-value row.
      expect(seatOverageLine(plan, 20, BillingCycle.MONTHLY, 'sub-test')).toBeNull();
      expect(seatOverageLine(plan, 3, BillingCycle.MONTHLY, 'sub-test')).toBeNull();
    });
  });

  describe('buildInvoice', () => {
    const base = { period: '2026-08', subscription, plan };

    it('is tier fee plus overage plus 18% GST', () => {
      const invoice = buildInvoice({ ...base, billableStaff: 24 });
      expect(invoice.line_items).toHaveLength(2);
      expect(invoice.subtotal).toBe(39000);
      expect(invoice.tax_amount).toBe(Math.round(39000 * 0.18));
      expect(invoice.total).toBe(invoice.subtotal + invoice.tax_amount);
    });

    it('is one line for a client inside its allowance', () => {
      const invoice = buildInvoice({ ...base, billableStaff: 12 });
      expect(invoice.line_items).toHaveLength(1);
      expect(invoice.subtotal).toBe(35000);
    });

    it('moves the total when a tier price changes, with no code change', () => {
      const before = buildInvoice({ ...base, billableStaff: 24 }).total;
      const after = buildInvoice({
        ...base,
        plan: { ...plan, price_per_extra_seat: 1500 },
        billableStaff: 24,
      }).total;
      expect(after).toBeGreaterThan(before);
    });

    it('carries a source_ref on every line, so a figure can be traced back', () => {
      const invoice = buildInvoice({ ...base, billableStaff: 24 });
      for (const line of invoice.line_items) {
        expect(line.source_ref).toBe('sub-test');
      }
    });
  });
});

describe('Subscription model (e2e)', () => {
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

  describe('Seat billing', () => {
    it('bills org-001 a tier fee plus an overage for its extra staff', async () => {
      const res = await request(server())
        .get('/api/platform-invoices/preview?organization_id=org-001&period=2026-08')
        .set('x-role', 'Super Admin')
        .expect(200);

      const p = res.body.data;
      expect(p.billable_staff).toBe(24);
      expect(p.included_seats).toBe(20);
      expect(p.seats_over_allowance).toBe(4);
      expect(p.line_items.map((l: any) => l.type)).toEqual([
        'subscription',
        'seat-overage',
      ]);
      expect(p.subtotal).toBe(39000);
    });

    it('bills org-002 the flat fee, with no overage line', async () => {
      const res = await request(server())
        .get('/api/platform-invoices/preview?organization_id=org-002&period=2026-08')
        .set('x-role', 'Super Admin')
        .expect(200);

      expect(res.body.data.seats_over_allowance).toBe(0);
      expect(res.body.data.line_items).toHaveLength(1);
      expect(res.body.data.subtotal).toBe(12000);
    });

    it('does not count a Campus Visitor as a billable seat', async () => {
      // The one carve-out in the whole model. A campus may have thousands of
      // students reporting faults; billing per student would be absurd.
      const before = await request(server())
        .get('/api/platform-invoices/preview?organization_id=org-001&period=2026-08')
        .set('x-role', 'Super Admin');

      await request(server())
        .post('/api/users')
        .set('x-role', 'Super Admin')
        .send({
          organization_id: 'org-001',
          name: 'A Student',
          email: 'student.seat.test@example.com',
          password: 'Student@123',
          role: 'Campus Visitor',
        })
        .expect(201);

      const after = await request(server())
        .get('/api/platform-invoices/preview?organization_id=org-001&period=2026-08')
        .set('x-role', 'Super Admin');

      expect(after.body.data.billable_staff).toBe(before.body.data.billable_staff);
      expect(after.body.data.total).toBe(before.body.data.total);
    });

    it('counts a new staff account as one more billable seat', async () => {
      const before = await request(server())
        .get('/api/platform-invoices/preview?organization_id=org-001&period=2026-08')
        .set('x-role', 'Super Admin');

      await request(server())
        .post('/api/users')
        .set('x-role', 'Super Admin')
        .send({
          organization_id: 'org-001',
          name: 'A Technician',
          email: 'tech.seat.test@example.com',
          password: 'Tech@123',
          role: 'Technician',
        })
        .expect(201);

      const after = await request(server())
        .get('/api/platform-invoices/preview?organization_id=org-001&period=2026-08')
        .set('x-role', 'Super Admin');

      expect(after.body.data.billable_staff).toBe(
        before.body.data.billable_staff + 1,
      );
      expect(after.body.data.subtotal).toBe(before.body.data.subtotal + 1000);
    });
  });

  describe('Campus limit', () => {
    it('refuses a campus past the tier limit, naming the tier', async () => {
      // org-002 is on Starter, which covers one campus, and already has one.
      const res = await request(server())
        .post('/api/campus')
        .set('x-role', 'Super Admin')
        .set('x-org-id', 'org-002')
        .send({
          organization_id: 'org-002',
          name: 'Second Campus',
          location: 'Nowhere',
          total_budget: 100000,
        })
        .expect(409);

      expect(res.body.message).toContain('Starter');
    });
  });

  describe('Savings reporting', () => {
    it('compares a month against the same month a year earlier', async () => {
      const res = await request(server())
        .get('/api/organizations/org-001/savings?period=2026-07')
        .set('x-role', 'Financial Analyst')
        .set('x-org-id', 'org-001')
        .expect(200);

      const s = res.body.data;
      expect(s.has_comparison).toBe(true);
      expect(s.kwh).toBeLessThan(s.kwh_year_ago);
      expect(s.saved_kwh).toBeGreaterThan(0);
      expect(s.change_pct).toBeLessThan(0);
    });

    it('reports a materially larger change after the measures than before', async () => {
      // org-001 implemented two recommendations in February 2026. January
      // should be roughly flat; July should show the drop. That contrast is
      // the check that this figure tracks the work, not the calendar.
      const jan = await request(server())
        .get('/api/organizations/org-001/savings?period=2026-01')
        .set('x-role', 'Super Admin')
        .expect(200);
      const jul = await request(server())
        .get('/api/organizations/org-001/savings?period=2026-07')
        .set('x-role', 'Super Admin')
        .expect(200);

      expect(Math.abs(jan.body.data.change_pct)).toBeLessThan(5);
      expect(Math.abs(jul.body.data.change_pct)).toBeGreaterThan(10);
    });

    it('rolls a range of months up', async () => {
      const res = await request(server())
        .get('/api/organizations/org-001/savings?from=2026-03&to=2026-08')
        .set('x-role', 'Super Admin')
        .expect(200);

      expect(res.body.data.months_compared).toBe(6);
      expect(res.body.data.months).toHaveLength(6);
      expect(res.body.data.saved_amount).toBeGreaterThan(0);
    });

    it('rejects a request with neither a period nor a range', async () => {
      await request(server())
        .get('/api/organizations/org-001/savings')
        .set('x-role', 'Super Admin')
        .expect(400);
    });
  });

  describe('Impersonation', () => {
    const husaam = '550e8400-0002-4000-8000-000000000002';

    it('lets a Super Admin open another user session, without the password', async () => {
      const res = await request(server())
        .post(`/api/users/${husaam}/impersonate`)
        .set('x-role', 'Super Admin')
        .send({ actor: 'Priya Nair' })
        .expect(201);

      expect(res.body.data.user_id).toBe(husaam);
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('writes the switch to the activity log, naming both parties', async () => {
      await request(server())
        .post(`/api/users/${husaam}/impersonate`)
        .set('x-role', 'Super Admin')
        .send({ actor: 'Priya Nair' })
        .expect(201);

      const logs = await request(server())
        .get('/api/activity-logs')
        .set('x-role', 'Super Admin')
        .expect(200);

      const entry = logs.body.data.find(
        (l: any) => l.action_type === 'impersonation',
      );
      expect(entry).toBeDefined();
      expect(entry.title).toContain('Priya Nair');
      expect(entry.title).toContain('Husaam');
    });

    it('refuses anyone who is not a Super Admin', async () => {
      await request(server())
        .post(`/api/users/${husaam}/impersonate`)
        .set('x-role', 'Financial Analyst')
        .set('x-org-id', 'org-001')
        .send({})
        .expect(403);

      await request(server())
        .post(`/api/users/${husaam}/impersonate`)
        .set('x-role', 'Organization Admin')
        .set('x-org-id', 'org-001')
        .send({})
        .expect(403);
    });
  });

  describe('Tenancy', () => {
    it('gives platform staff the cross-tenant contract list', async () => {
      const res = await request(server())
        .get('/api/subscriptions')
        .set('x-role', 'Super Admin')
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(1);
    });

    it('narrows a client to its own contract', async () => {
      const res = await request(server())
        .get('/api/subscriptions')
        .set('x-role', 'Organization Admin')
        .set('x-org-id', 'org-001')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].organization_id).toBe('org-001');
    });

    it('keeps the platform revenue summary away from a client', async () => {
      await request(server())
        .get('/api/platform-invoices/revenue-summary')
        .set('x-role', 'Financial Analyst')
        .set('x-org-id', 'org-001')
        .expect(403);
    });

    it('lets a client read the tier catalogue but not change it', async () => {
      await request(server())
        .get('/api/subscription-plans')
        .set('x-role', 'Financial Analyst')
        .set('x-org-id', 'org-001')
        .expect(200);

      await request(server())
        .delete('/api/subscription-plans/plan-starter')
        .set('x-role', 'Organization Admin')
        .set('x-org-id', 'org-001')
        .expect(403);
    });

    it('serves the public catalogue with no credentials and no internal state', async () => {
      const res = await request(server())
        .get('/api/subscription-plans/public')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('included_seats');
      expect(res.body.data[0]).not.toHaveProperty('is_active');
    });
  });

  describe('Audits carry no billing', () => {
    it('exposes surveys and recommendations, and nothing about money', async () => {
      const res = await request(server())
        .get('/api/energy-audits/audit-001')
        .set('x-role', 'Certified Energy Auditor')
        .expect(200);

      const audit = res.body.data;
      expect(audit.survey).toBeDefined();
      expect(audit.findings.length).toBeGreaterThan(0);
      // The whole point of the simplification: an audit is a service, not a
      // priced instrument.
      expect(audit).not.toHaveProperty('baseline');
      expect(audit).not.toHaveProperty('verifications');
    });

    it('lets the client team mark a recommendation implemented', async () => {
      const res = await request(server())
        .patch('/api/energy-audits/audit-002/findings/find-011')
        .set('x-role', 'Sustainability Officer')
        .set('x-org-id', 'org-002')
        .send({ status: 'implemented' })
        .expect(200);

      expect(res.body.data.status).toBe('implemented');
      // Stamped server-side rather than trusted from the body.
      expect(res.body.data.implemented_on).toBeTruthy();
    });
  });
});
