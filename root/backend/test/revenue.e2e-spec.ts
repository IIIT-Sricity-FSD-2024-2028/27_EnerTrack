import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { RolesGuard } from '../src/core/guards/roles.guard';
import {
  BillingCycle,
  SubscriptionStatus,
  VerificationStatus,
} from '../src/core/database/database.service';
import {
  adjustBaseline,
  buildInvoice,
  performanceShareLine,
  subscriptionLine,
  verifiedSaving,
} from '../src/modules/billing/pricing';

/**
 * The revenue model, tested at both levels it can go wrong.
 *
 * The pure block checks the arithmetic in pricing.ts directly, because the
 * rules that decide what a client is charged should be readable and provable
 * without a running application.
 *
 * The HTTP block then proves those rules are actually reachable and actually
 * enforced through the real request pipeline — the same reasoning the
 * middleware suite uses. A guard that works in isolation but sits behind a
 * route nobody wired up would pass the first block and fail in production.
 */

/** A plan shaped like the seeded Professional tier. */
const plan: any = {
  plan_id: 'plan-test',
  name: 'Test',
  tagline: '',
  price_per_meter_month: 3500,
  min_monthly_fee: 25000,
  audit_fee_base: 150000,
  audit_fee_per_sqm: 6,
  performance_share_pct: 15,
  share_cap_pct_of_subscription: 300,
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
  performance_share_pct_override: null,
  audit_fee_waived_on: '2025-01-01',
  account_officer_id: null,
  baseline_audit_id: 'audit-test',
};

const acceptedVerification: any = {
  verification_id: 'ver-test',
  period: '2026-07',
  status: VerificationStatus.CLIENT_ACCEPTED,
  finding_ids: ['f1'],
  meter_ids: ['m1'],
  actual_factors: { cooling_degree_days: 145, occupancy_index: 1.03, floor_area_sqm: 42000 },
  raw_baseline_kwh: 97300,
  adjusted_baseline_kwh: 78550,
  actual_kwh: 72965,
  saved_kwh: 5585,
  saved_amount: 47473,
  signed_by: 'auditor',
  signed_on: '2026-08-01',
  accepted_by: 'client',
  accepted_on: '2026-08-05',
  dispute_reason: null,
  disputed_on: null,
};

describe('Revenue model — pricing engine (unit)', () => {
  describe('adjustBaseline', () => {
    const baselineFactors = {
      cooling_degree_days: 185,
      occupancy_index: 1.0,
      floor_area_sqm: 42000,
    };

    it('lowers the baseline when the period ran cooler than the window', () => {
      const adjusted = adjustBaseline(97300, baselineFactors, {
        cooling_degree_days: 145,
        occupancy_index: 1.0,
        floor_area_sqm: 42000,
      });
      // A mild month means the estate would have used less anyway, so less
      // of the drop is a saving anyone earned.
      expect(Math.round(adjusted)).toBe(Math.round(97300 * (145 / 185)));
      expect(adjusted).toBeLessThan(97300);
    });

    it('raises the baseline when the period ran hotter', () => {
      const adjusted = adjustBaseline(97300, baselineFactors, {
        cooling_degree_days: 196,
        occupancy_index: 1.0,
        floor_area_sqm: 42000,
      });
      // The correction is not a one-way haircut: a hot month legitimately
      // increases what the client is credited with saving.
      expect(adjusted).toBeGreaterThan(97300);
    });

    it('credits a larger occupancy and a larger floor area', () => {
      const adjusted = adjustBaseline(100000, baselineFactors, {
        cooling_degree_days: 185,
        occupancy_index: 1.1,
        floor_area_sqm: 46200,
      });
      expect(Math.round(adjusted)).toBe(Math.round(100000 * 1.1 * 1.1));
    });

    it('treats an unmeasured baseline factor as neutral rather than dividing by zero', () => {
      const adjusted = adjustBaseline(50000, {
        cooling_degree_days: 0,
        occupancy_index: 0,
        floor_area_sqm: 0,
      }, {
        cooling_degree_days: 200,
        occupancy_index: 1.2,
        floor_area_sqm: 9000,
      });
      expect(adjusted).toBe(50000);
    });
  });

  describe('verifiedSaving', () => {
    it('converts a shortfall against the adjusted baseline into rupees', () => {
      expect(verifiedSaving(78550, 72965, 8.5)).toEqual({
        savedKwh: 5585,
        savedAmount: Math.round(5585 * 8.5),
      });
    });

    it('floors at zero when consumption went up', () => {
      // Overshooting the baseline is the client's downside, not a negative
      // invoice line.
      expect(verifiedSaving(70000, 90000, 8.5)).toEqual({ savedKwh: 0, savedAmount: 0 });
    });
  });

  describe('subscriptionLine', () => {
    it('bills per meter when that beats the floor', () => {
      const line = subscriptionLine(plan, 9, BillingCycle.MONTHLY, 'sub-test');
      expect(line.amount).toBe(9 * 3500);
      expect(line.quantity).toBe(9);
    });

    it('falls back to the minimum monthly fee for a small estate', () => {
      const line = subscriptionLine(plan, 1, BillingCycle.MONTHLY, 'sub-test');
      expect(line.amount).toBe(25000);
      expect(line.description).toContain('minimum monthly fee');
    });

    it('applies the annual discount over twelve months', () => {
      const line = subscriptionLine(plan, 9, BillingCycle.ANNUAL, 'sub-test');
      expect(line.amount).toBe(Math.round(9 * 3500 * 12 * 0.9));
    });
  });

  describe('performanceShareLine — the counter-signature gate', () => {
    const subscriptionAmount = 31500;

    it('bills a share once the client has accepted', () => {
      const line = performanceShareLine(acceptedVerification, 15, subscriptionAmount, 300);
      expect(line).not.toBeNull();
      expect(line!.amount).toBe(Math.round(47473 * 0.15));
    });

    it.each([
      VerificationStatus.DRAFT,
      VerificationStatus.AUDITOR_SIGNED,
      VerificationStatus.DISPUTED,
    ])('bills nothing while the verification is %s', (status) => {
      // The load-bearing rule of the whole model. The auditor who locks the
      // baseline works for the party paid the share, so an unaccepted claim
      // must never reach an invoice — including one the auditor has signed.
      const line = performanceShareLine(
        { ...acceptedVerification, status },
        15,
        subscriptionAmount,
        300,
      );
      expect(line).toBeNull();
    });

    it('bills nothing when there is no verification at all', () => {
      expect(performanceShareLine(null, 15, subscriptionAmount, 300)).toBeNull();
    });

    it('clamps to the cap and says so in the description', () => {
      const line = performanceShareLine(acceptedVerification, 500, subscriptionAmount, 300);
      expect(line!.amount).toBe(subscriptionAmount * 3);
      expect(line!.description).toContain('capped at');
    });
  });

  describe('buildInvoice', () => {
    const base = {
      period: '2026-07',
      subscription,
      plan,
      billedMeterCount: 9,
      floorAreaSqm: 42000,
    };

    it('assembles subscription plus an accepted share, with tax on the subtotal', () => {
      const invoice = buildInvoice({ ...base, verification: acceptedVerification });
      const share = Math.round(47473 * 0.15);

      expect(invoice.line_items).toHaveLength(2);
      expect(invoice.subtotal).toBe(31500 + share);
      expect(invoice.tax_amount).toBe(Math.round((31500 + share) * 0.18));
      expect(invoice.total).toBe(invoice.subtotal + invoice.tax_amount);
    });

    it('still bills the subscription when the savings claim is disputed', () => {
      // The monitoring service was delivered either way; only the outcome
      // component depends on the claim.
      const invoice = buildInvoice({
        ...base,
        verification: { ...acceptedVerification, status: VerificationStatus.DISPUTED },
      });
      expect(invoice.line_items).toHaveLength(1);
      expect(invoice.subtotal).toBe(31500);
    });

    it('suppresses the audit fee once it has been waived', () => {
      const invoice = buildInvoice({
        ...base,
        period: '2025-01', // the period the contract started
        verification: null,
      });
      expect(invoice.line_items.some((l) => l.type === 'audit-fee')).toBe(false);
    });

    it('bills the audit fee on the first period when it was not waived', () => {
      const invoice = buildInvoice({
        ...base,
        period: '2025-01',
        subscription: { ...subscription, audit_fee_waived_on: null },
        verification: null,
      });
      const audit = invoice.line_items.find((l) => l.type === 'audit-fee');
      expect(audit).toBeDefined();
      expect(audit!.amount).toBe(150000 + 42000 * 6);
    });

    it('does not repeat the audit fee on later periods', () => {
      const invoice = buildInvoice({
        ...base,
        period: '2025-02',
        subscription: { ...subscription, audit_fee_waived_on: null },
        verification: null,
      });
      expect(invoice.line_items.some((l) => l.type === 'audit-fee')).toBe(false);
    });

    it('moves the total when a plan price changes, with no code change', () => {
      const before = buildInvoice({ ...base, verification: null }).total;
      const after = buildInvoice({
        ...base,
        plan: { ...plan, price_per_meter_month: 4200 },
        verification: null,
      }).total;
      expect(after).toBeGreaterThan(before);
    });
  });
});

describe('Revenue model (e2e)', () => {
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

  describe('Baseline adjustment', () => {
    it('claims far less than a naive baseline-minus-actual would', async () => {
      const res = await request(server())
        .get('/api/energy-audits/audit-001/verification-suggestion?period=2026-07')
        .set('x-role', 'Certified Energy Auditor')
        .expect(200);

      const v = res.body.data;
      expect(v.adjusted_baseline_kwh).toBeLessThan(v.raw_baseline_kwh);
      expect(v.saved_kwh).toBeLessThan(v.unadjusted_saved_kwh);
      expect(v.saved_kwh).toBeGreaterThan(0);
    });

    it('scopes the baseline to the meters the implemented findings cover', async () => {
      const res = await request(server())
        .get('/api/energy-audits/audit-001/verification-suggestion?period=2026-07')
        .set('x-role', 'Certified Energy Auditor')
        .expect(200);

      // Both findings are implemented in the seed, so the credited meters
      // account for the whole estate baseline.
      expect(res.body.data.scope_share).toBeCloseTo(1, 2);
      expect(res.body.data.meter_ids).toHaveLength(2);
    });

    it('excludes a decommissioned meter from the credited set', async () => {
      const res = await request(server())
        .get('/api/energy-audits/audit-001/verification-suggestion?period=2026-07')
        .set('x-role', 'Certified Energy Auditor')
        .expect(200);

      // M-006 sits in the same building as M-001 but is decommissioned.
      // Counting it would drag actual consumption down and inflate the claim.
      expect(res.body.data.meter_ids).not.toContain(
        'mmmm0000-0006-4000-8000-000000000000',
      );
    });
  });

  describe('Counter-signature gate', () => {
    it('omits the performance share while the claim is only auditor-signed', async () => {
      // ver-003 (2026-06) is seeded auditor-signed and never accepted.
      const res = await request(server())
        .get('/api/platform-invoices/preview?organization_id=org-001&period=2026-06')
        .set('x-role', 'Account Officer')
        .expect(200);

      expect(res.body.data.line_items.some((l: any) => l.type === 'performance-share')).toBe(
        false,
      );
      expect(res.body.data.performance_share_note).toContain('not yet accepted');
    });

    it('omits the performance share for a disputed claim', async () => {
      const res = await request(server())
        .get('/api/platform-invoices/preview?organization_id=org-001&period=2026-05')
        .set('x-role', 'Account Officer')
        .expect(200);

      expect(res.body.data.line_items.some((l: any) => l.type === 'performance-share')).toBe(
        false,
      );
      expect(res.body.data.performance_share_note).toContain('Disputed');
    });

    it('includes the performance share once the client accepted it', async () => {
      const res = await request(server())
        .get('/api/platform-invoices/preview?organization_id=org-001&period=2026-04')
        .set('x-role', 'Account Officer')
        .expect(200);

      expect(res.body.data.line_items.some((l: any) => l.type === 'performance-share')).toBe(
        true,
      );
    });

    it('refuses a client accepting another tenant’s verification', async () => {
      await request(server())
        .patch('/api/energy-audits/audit-001/verifications/ver-003/accept')
        .set('x-role', 'Economic Buyer')
        .set('x-org-id', 'org-002')
        .send({ accepted_by: 'someone-else' })
        .expect(404);
    });

    it('refuses an auditor accepting on the client’s behalf', async () => {
      // The whole point of the gate: EnerTrack staff cannot supply the
      // client's signature, however senior they are.
      await request(server())
        .patch('/api/energy-audits/audit-001/verifications/ver-003/accept')
        .set('x-role', 'Certified Energy Auditor')
        .send({ accepted_by: 'auditor' })
        .expect(403);
    });
  });

  describe('Tenancy', () => {
    it('gives platform staff the cross-tenant subscription list', async () => {
      const res = await request(server())
        .get('/api/subscriptions')
        .set('x-role', 'Super Admin')
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(1);
    });

    it('narrows a client to its own contract', async () => {
      const res = await request(server())
        .get('/api/subscriptions')
        .set('x-role', 'System Administrator')
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

    it('lets a client read the price catalogue but not change it', async () => {
      await request(server())
        .get('/api/subscription-plans')
        .set('x-role', 'Financial Analyst')
        .set('x-org-id', 'org-001')
        .expect(200);

      await request(server())
        .delete('/api/subscription-plans/plan-essential')
        .set('x-role', 'System Administrator')
        .set('x-org-id', 'org-001')
        .expect(403);
    });

    it('serves the public catalogue with no credentials and no internal fields', async () => {
      const res = await request(server())
        .get('/api/subscription-plans/public')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).not.toHaveProperty('audit_fee_base');
      expect(res.body.data[0]).not.toHaveProperty('share_cap_pct_of_subscription');
    });
  });

  describe('Baseline integrity', () => {
    it('refuses to re-lock a baseline that savings have been claimed against', async () => {
      await request(server())
        .patch('/api/energy-audits/audit-001/baseline')
        .set('x-role', 'Certified Energy Auditor')
        .send({
          period_from: '2025-03',
          period_to: '2025-08',
          baseline_kwh: 10,
          factors: { cooling_degree_days: 185, occupancy_index: 1, floor_area_sqm: 42000 },
          locked_by: 'auditor',
        })
        .expect(409);
    });

    it('refuses to verify against an audit with no locked baseline', async () => {
      // audit-003 is the in-progress prospect engagement.
      await request(server())
        .get('/api/energy-audits/audit-003/verification-suggestion?period=2026-07')
        .set('x-role', 'Certified Energy Auditor')
        .expect(409);
    });
  });
});
