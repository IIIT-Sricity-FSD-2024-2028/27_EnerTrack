import { Injectable, Scope } from "@nestjs/common";

export enum UserRole {
  // ── Legacy roles (still fully supported) ─────────────────
  SYSTEM_ADMINISTRATOR = "System Administrator",
  FINANCIAL_ANALYST = "Financial Analyst",
  TECHNICIAN = "Technician",
  TECHNICIAN_ADMINISTRATOR = "Technician Administrator",
  SUSTAINABILITY_OFFICER = "Sustainability Officer",
  CAMPUS_VISITOR = "Campus Visitor",

  // ── EnerTrack-side roles (B2B model) ─────────────────────
  SUPER_ADMIN = "Super Admin",
  CERTIFIED_ENERGY_AUDITOR = "Certified Energy Auditor",
  ACCOUNT_OFFICER = "Account Officer",

  // ── Client-side roles (B2B model) ────────────────────────
  ECONOMIC_BUYER = "Economic Buyer",
  FACILITY_MANAGER = "Facility Manager",
  DEPARTMENT_HEAD = "Department Head",
}

/**
 * Maps each new B2B role onto the legacy role(s) it replaces.
 *
 * The RolesGuard expands an incoming role through this table, so a caller
 * sending "Facility Manager" satisfies a controller that still declares
 * @Roles("Technician Administrator"). This lets the SRS role model land
 * without touching 127 @Roles decorators or breaking the existing frontend.
 *
 * Legacy roles are deliberately absent: they expand to themselves only, so
 * their behaviour is byte-for-byte unchanged.
 */
export const ROLE_EQUIVALENTS: Record<string, string[]> = {
  [UserRole.SUPER_ADMIN]: [UserRole.SYSTEM_ADMINISTRATOR],
  [UserRole.ACCOUNT_OFFICER]: [
    UserRole.FINANCIAL_ANALYST,
    UserRole.SUSTAINABILITY_OFFICER,
  ],
  [UserRole.CERTIFIED_ENERGY_AUDITOR]: [UserRole.TECHNICIAN],
  [UserRole.ECONOMIC_BUYER]: [UserRole.FINANCIAL_ANALYST],
  [UserRole.FACILITY_MANAGER]: [UserRole.TECHNICIAN_ADMINISTRATOR],
  [UserRole.DEPARTMENT_HEAD]: [UserRole.CAMPUS_VISITOR],
};

/** Roles that belong to EnerTrack itself and may work across all tenants. */
export const PLATFORM_SIDE_ROLES: string[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CERTIFIED_ENERGY_AUDITOR,
  UserRole.ACCOUNT_OFFICER,
  // System Administrator is deliberately absent. It is a *client's* own admin,
  // scoped to one organisation. While it sat here, any System Administrator
  // record with a null organization_id received the full cross-tenant view,
  // which made the tenant boundary depend on seed data rather than on the role.
];

/**
 * The only roles a visitor may give themselves through public sign-up.
 *
 * An allowlist rather than "anything not in PLATFORM_SIDE_ROLES". A denylist
 * silently opens a hole whenever a role leaves PLATFORM_SIDE_ROLES for an
 * unrelated reason, which is exactly what happened when System Administrator
 * was removed above. Anything not named here is refused, so a role added to
 * the enum later is safe by default.
 */
export const SELF_REGISTERABLE_ROLES: string[] = [
  UserRole.CAMPUS_VISITOR,
  UserRole.FINANCIAL_ANALYST,
  UserRole.TECHNICIAN,
  UserRole.TECHNICIAN_ADMINISTRATOR,
  UserRole.SUSTAINABILITY_OFFICER,
  UserRole.FACILITY_MANAGER,
  UserRole.ECONOMIC_BUYER,
  UserRole.DEPARTMENT_HEAD,
];

export enum OrganizationStatus {
  PROSPECT = "prospect",
  AUDITED = "audited",
  ACTIVE = "active",
  CHURNED = "churned",
}

export enum DataSourceTier {
  BMS_INTEGRATION = "bms-integration",
  MANUAL_UPLOAD = "manual-upload",
  NO_METERING = "no-metering",
}

export enum NotificationTargetType {
  WASTAGE = "wastage",
  ALERT = "alert",
  REQUEST = "request",
}

export enum MeterType {
  ELECTRICITY = "electricity",
  GAS = "gas",
  WATER = "water",
  EMISSIONS = "emissions",
  FOOD = "food",
}

export enum MeterStatus {
  ACTIVE = "active",
  FAULTY = "faulty",
  CALIBRATING = "calibrating",
  DECOMMISSIONED = "decommissioned",
}

export enum WastageType {
  ENERGY = "Energy",
  WATER = "Water",
  EMISSIONS = "Emissions",
  FOOD = "Food",
}

export enum AlertStatus {
  OPEN = "open",
  ACKNOWLEDGED = "acknowledged",
  RESOLVED = "resolved",
}

export enum FaultSeverity {
  LOW = "low",
  MODERATE = "moderate",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum FaultStatus {
  ACTIVE = "active",
  PENDING = "pending",
  RESOLVED = "resolved",
}

export enum WorkOrderPriority {
  IMMEDIATE = "immediate",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export enum WorkOrderStatus {
  NEW = "new",
  INPROGRESS = "inprogress",
  APPROVAL = "approval",
  REVIEW = "review",
  CLOSED = "closed",
}

export enum EnergyCostStatus {
  UNDER_BUDGET = "under-budget",
  ON_BUDGET = "on-budget",
  OVER_BUDGET = "over-budget",
}

export enum InvoiceStatus {
  PENDING = "pending",
  APPROVED = "approved",
  OVERDUE = "overdue",
  PAID = "paid",
}

export enum InitiativeStatus {
  PROPOSED = "proposed",
  IN_PROGRESS = "in-progress",
  APPROVED = "approved",
  COMPLETED = "completed",
  REJECTED = "rejected",
}

/**
 * A client organisation (tenant). Sits above Campus, so Building,
 * Department and Meter inherit their tenant through the campus chain.
 */
export interface Organization {
  organization_id: string;
  name: string;
  type: string;
  location: string | null;
  status: OrganizationStatus;
  data_source_tier: DataSourceTier | null;
  floor_area_sqm: number | null;
  tariff_rate: number | null;
  contract_start: string | null;
}

export interface User {
  user_id: string;
  /** null for EnerTrack staff, who are not tied to any single tenant. */
  organization_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  password: string;
  role: UserRole;
  specialization: string | null;
}
export interface Campus {
  campus_id: string;
  organization_id: string;
  name: string;
  location: string | null;
  total_budget: number;
}
export interface Building {
  building_id: string;
  organization_id: string;
  campus_id: string;
  name: string;
  budget: number | null;
}
export interface Department {
  department_id: string;
  organization_id: string;
  building_id: string;
  name: string;
  budget: number | null;
}
export interface Meter {
  meter_id: string;
  organization_id: string;
  building_id: string;
  meter_code: string;
  meter_type: MeterType;
  zone: string | null;
  status: MeterStatus;
}
export interface MeterReading {
  reading_id: string;
  organization_id: string;
  meter_id: string;
  value: number;
  unit: string;
  timestamp: string;
}
export interface WastageReport {
  wastage_report_id: string;
  organization_id: string;
  reporter_id: string;
  type: WastageType;
  status: string;
  details: Record<string, any>;
  sensor_reading_id: string | null;
}
export interface AlertMessage {
  sender_role: string;
  content: string;
  timestamp: string;
}
export interface Alert {
  alert_id: string;
  organization_id: string;
  meter_id: string;
  triggering_reading_id: string | null;
  title: string;
  severity: string;
  status: AlertStatus;
  messages: AlertMessage[];
}
export interface Fault {
  fault_id: string;
  organization_id: string;
  alert_id: string | null;
  assigned_to_id: string | null;
  asset_name: string;
  fault_type: string;
  severity: FaultSeverity;
  status: FaultStatus;
}
export interface ServiceRequest {
  service_request_id: string;
  organization_id: string;
  reporter_id: string;
  assigned_to_id: string | null;
  category: string;
  issue_type: string;
  status: string;
}
export interface WorkOrder {
  work_order_id: string;
  organization_id: string;
  assigned_to_id: string | null;
  linked_fault_id: string | null;
  source_request_id: string | null;
  title: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  details?: Record<string, any>;
}
export interface EnergyCost {
  energy_cost_id: string;
  organization_id: string;
  building_id: string | null;
  department_id: string | null;
  period: string;
  electricity: number;
  gas: number;
  water: number;
  status: EnergyCostStatus;
  wastewater?: number;
  demand?: number;
  total?: number;
  budget?: number;
  variance?: number;
  scope?: string;
  scope_label?: string;
}
export interface Invoice {
  invoice_id: string;
  organization_id: string;
  department_id: string;
  approved_by_id: string | null;
  invoice_number: string;
  vendor: string;
  amount: number;
  status: InvoiceStatus;
  type?: string;
  due_date?: string | null;
  issued_date?: string | null;
  department_label?: string;
  archived?: boolean;
}
export interface FinancialReport {
  financial_report_id: string;
  organization_id: string;
  generated_by_id: string;
  building_id: string | null;
  department_id: string | null;
  title: string;
  period: string;
  roi: string | null;
  npv: number | null;
  category?: string;
  format?: string;
  status?: string;
  scope?: string;
  scope_label?: string;
  payback_years?: number | null;
  notes?: string;
  archived?: boolean;
}
export interface SustainabilityMetric {
  sustainability_metric_id: string;
  organization_id: string;
  period: string;
  energy_consumed: number;
  water_usage: number;
  emissions: number;
}
export interface Initiative {
  initiative_id: string;
  organization_id: string;
  created_by_id: string;
  title: string;
  description?: string;
  status: InitiativeStatus;
  feasible: boolean;
  onTrack?: boolean;
  target_reduction: string;
  outcomes: string[];
}
export interface ActivityLog {
  activity_log_id: string;
  organization_id: string;
  user_id: string | null;
  action_type: string;
  title: string;
  timestamp: string;
}
export interface SustainabilityReport {
  report_id: string;
  organization_id: string;
  generated_by_id: string;
  title: string;
  period: string;
  metrics: Record<string, any>;
  generated_at: string;
}
export interface Notification {
  notification_id: string;
  organization_id: string;
  user_id: string;
  target_type: NotificationTargetType;
  target_id: string;
  message: string;
  is_read: boolean;
}


/* ══════════════════════════════════════════════════════════════════════
   B2B REVENUE MODEL — EnerTrack's own business, not the client's

   Everything from here to the end of the interfaces describes the
   commercial relationship between EnerTrack and a client organisation:
   what we audited, what they subscribe to, and what we bill them.

   Read one distinction before anything else. PlatformInvoice is NOT
   Invoice. Invoice (above) is the client's utility bill from their
   electricity supplier — a cost their Financial Analyst manages.
   PlatformInvoice is what EnerTrack charges the client for the service.
   Two money flows, opposite directions; they never share a page.
   ══════════════════════════════════════════════════════════════════════ */

export enum SubscriptionStatus {
  TRIAL = "trial",
  ACTIVE = "active",
  PAST_DUE = "past-due",
  CANCELLED = "cancelled",
}

export enum BillingCycle {
  MONTHLY = "monthly",
  ANNUAL = "annual",
}

export enum AuditStatus {
  SCHEDULED = "scheduled",
  IN_PROGRESS = "in-progress",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export enum FindingSeverity {
  LOW = "low",
  MODERATE = "moderate",
  HIGH = "high",
}

/**
 * A recommendation's journey. IMPLEMENTED is the one that matters
 * commercially: the landing page promises the performance share is
 * payable "only where recommendations were implemented", so a finding
 * that has not reached this state contributes nothing to a bill.
 */
export enum FindingStatus {
  PROPOSED = "proposed",
  ACCEPTED = "accepted",
  IMPLEMENTED = "implemented",
  VERIFIED = "verified",
  REJECTED = "rejected",
}

/**
 * Lifecycle of a savings verification, and the reason the performance
 * share is billable at all.
 *
 * The auditor who locks the baseline works for EnerTrack, and EnerTrack
 * is paid a share of the gap between that baseline and actual
 * consumption. Left alone that is a self-dealing loop with no
 * counterparty: lower the baseline, raise the invoice.
 *
 * CLIENT_ACCEPTED is the counterparty. The pricing engine refuses to
 * emit a performance-share line for a verification in any other state,
 * so no EnerTrack employee can enlarge their own employer's invoice
 * without the client agreeing to that specific number first.
 */
export enum VerificationStatus {
  DRAFT = "draft",
  AUDITOR_SIGNED = "auditor-signed",
  CLIENT_ACCEPTED = "client-accepted",
  DISPUTED = "disputed",
}

export enum PlatformInvoiceStatus {
  DRAFT = "draft",
  ISSUED = "issued",
  PAID = "paid",
  OVERDUE = "overdue",
}

export enum InvoiceLineType {
  SUBSCRIPTION = "subscription",
  AUDIT_FEE = "audit-fee",
  PERFORMANCE_SHARE = "performance-share",
}

/**
 * The three things that move consumption for reasons EnerTrack had
 * nothing to do with. Held together because a baseline is only
 * comparable to a later period once all three have been equalised.
 */
export interface PeriodFactorValues {
  cooling_degree_days: number;
  occupancy_index: number;
  floor_area_sqm: number;
}

/**
 * A price tier in EnerTrack's catalogue.
 *
 * The only entity in the system with NO organization_id. It is a global
 * catalogue, identical for every tenant, so scopeToTenant() must never
 * be applied to it — the same exception already made for
 * GET /api/organizations/public.
 *
 * Every knob the billing engine reads lives on this row, and that is the
 * whole scalability argument: adding a tier is a new row, changing a
 * price is a PATCH, and neither needs a code change or a redeploy.
 */
export interface SubscriptionPlan {
  plan_id: string;
  name: string;
  tagline: string;
  /** Recurring fee per billed meter per month. */
  price_per_meter_month: number;
  /** Floor, so a very small estate still covers the cost to serve it. */
  min_monthly_fee: number;
  /** One-time site audit: a fixed component plus a per-square-metre one. */
  audit_fee_base: number;
  audit_fee_per_sqm: number;
  /** Share of *verified* savings EnerTrack invoices, as a percentage. */
  performance_share_pct: number;
  /**
   * Ceiling on the performance share, as a percentage of that period's
   * subscription fee. Stops an unusual season producing an invoice the
   * client cannot budget for, and encodes the honest position that the
   * subscription is the primary revenue and the share is an alignment
   * signal — EnerTrack measures and reports, the client's own
   * technicians do the implementing.
   */
  share_cap_pct_of_subscription: number;
  features: string[];
  is_active: boolean;
}

export interface Subscription {
  subscription_id: string;
  organization_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  started_on: string | null;
  renews_on: string | null;
  cancelled_on: string | null;
  /** Negotiated share percentage. Falls back to the plan's when null. */
  performance_share_pct_override: number | null;
  /** Set when the fee was waived on signature; suppresses the audit line. */
  audit_fee_waived_on: string | null;
  /** EnerTrack Account Officer who owns this relationship. */
  account_officer_id: string | null;
  /** The audit whose locked baseline this contract measures against. */
  baseline_audit_id: string | null;
}

/**
 * Normalisation figures for one organisation in one month.
 *
 * Consumption moves for reasons that have nothing to do with EnerTrack: a
 * milder summer, a bigger intake, a new block coming online. Billing a
 * share of raw baseline-minus-actual would charge the client for the
 * weather. These are the figures adjustBaseline() uses to strip that out
 * before anything is claimed as a saving.
 */
export interface PeriodFactors extends PeriodFactorValues {
  organization_id: string;
  /** "YYYY-MM" */
  period: string;
}

export interface AuditFinding {
  finding_id: string;
  title: string;
  category: string;
  severity: FindingSeverity;
  est_annual_saving: number;
  capex: number;
  payback_months: number;
  status: FindingStatus;
  /** Null until the client's own team actually does the work. */
  implemented_on: string | null;
  /** Buildings this measure touches. Scopes which meters may be credited. */
  building_ids: string[];
}

export interface SavingsVerification {
  verification_id: string;
  /** "YYYY-MM" — matches the PlatformInvoice period it can be billed on. */
  period: string;
  status: VerificationStatus;
  /** Implemented findings being credited. Empty means nothing is claimable. */
  finding_ids: string[];
  /** Meters those findings cover, after decommissioned ones are dropped. */
  meter_ids: string[];
  actual_factors: PeriodFactorValues;
  /**
   * Both baselines are stored on purpose. The raw figure is what a naive
   * calculation would have claimed; the adjusted one is what is actually
   * billable. Keeping the pair makes the size of the adjustment visible
   * to the client who has to sign it, instead of hiding it inside a
   * single number they cannot check.
   */
  raw_baseline_kwh: number;
  adjusted_baseline_kwh: number;
  actual_kwh: number;
  saved_kwh: number;
  saved_amount: number;
  signed_by: string | null;
  signed_on: string | null;
  accepted_by: string | null;
  accepted_on: string | null;
  dispute_reason: string | null;
  disputed_on: string | null;
}

export interface AuditBaseline {
  /** "YYYY-MM" bounds of the window the baseline was measured over. */
  period_from: string;
  period_to: string;
  /** Once locked the figures are frozen: the contract measures against them. */
  locked: boolean;
  locked_on: string | null;
  locked_by: string | null;
  /** Average monthly consumption across the baseline window. */
  baseline_kwh: number;
  baseline_water_kl: number;
  baseline_cost: number;
  baseline_co2_kg: number;
  /** Averages across the same window, so any later period normalises to it. */
  factors: PeriodFactorValues;
}

export interface AuditSurvey {
  buildings_surveyed: number;
  meters_found: number;
  data_source_tier: DataSourceTier | null;
  floor_area_sqm: number | null;
  notes: string | null;
}

/**
 * A certified auditor's site visit and everything that flows from it.
 *
 * Findings and verifications are folded in as JSON arrays rather than
 * given their own tables, matching how Alert.messages and
 * Initiative.outcomes already work in this schema.
 */
export interface EnergyAudit {
  audit_id: string;
  organization_id: string;
  auditor_id: string;
  status: AuditStatus;
  scheduled_on: string | null;
  conducted_on: string | null;
  approved_on: string | null;
  survey: AuditSurvey;
  baseline: AuditBaseline | null;
  findings: AuditFinding[];
  verifications: SavingsVerification[];
  recommended_plan_id: string | null;
  projected_annual_saving: number;
  summary: string | null;
}

export interface PlatformInvoiceLine {
  type: InvoiceLineType;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  /** Record this line was derived from, so any figure on a bill is traceable. */
  source_ref: string | null;
}

export interface PlatformInvoice {
  platform_invoice_id: string;
  organization_id: string;
  subscription_id: string;
  /** "YYYY-MM" */
  period: string;
  line_items: PlatformInvoiceLine[];
  subtotal: number;
  tax_pct: number;
  tax_amount: number;
  total: number;
  status: PlatformInvoiceStatus;
  issued_on: string | null;
  due_on: string | null;
  paid_on: string | null;
}

/* ── Seed generators ──────────────────────────────────────────────────

   The revenue model only means something against a run of history: a
   baseline window, an implementation date, and enough months after it to
   verify savings against. Writing ~60 reading literals by hand would bury
   the rest of the seed, so the monthly series is generated instead —
   deterministically, with no Math.random, so every demo produces the same
   figures and the numbers quoted in the docs stay true.
   ───────────────────────────────────────────────────────────────────── */

/**
 * Cooling degree days by calendar month for Sri City / coastal Andhra.
 * The Mar–Jun peak is what actually drives campus electricity demand
 * here, which is why CDD is the normalisation factor that matters most.
 */
const BASE_CDD_BY_MONTH: Record<number, number> = {
  1: 60, 2: 90, 3: 150, 4: 200, 5: 230, 6: 200,
  7: 170, 8: 160, 9: 150, 10: 120, 11: 80, 12: 60,
};

/**
 * Two things happened to org-001 in 2026, and both are seeded on purpose.
 *
 * The hot season ran ~15% milder than 2025, which makes the post-retrofit
 * consumption drop look larger than the retrofit earned. Intake grew ~3%,
 * which pushes the other way. Seeding both is what lets the baseline
 * adjustment be shown moving in each direction rather than looking like a
 * decorative multiplier — the mild weather is clawed back, the extra
 * students are credited.
 */
const MILD_YEAR_FACTOR = 0.85;
const OCCUPANCY_2026 = 1.03;

/** How strongly consumption tracks cooling degree days, per CDD. */
const CDD_SENSITIVITY = 0.006;
/** CDD at which a meter runs at exactly its base demand. */
const CDD_REFERENCE = 120;

/** Inclusive bounds of the generated monthly series. */
const SERIES_FROM = { year: 2025, month: 1 };
const SERIES_TO = { year: 2026, month: 8 };

/** Floor area per tenant, used as the third normalisation factor. */
const ORG_FLOOR_AREA: Record<string, number> = {
  "org-001": 42000,
  "org-002": 68000,
  "org-004": 24000,
};

/**
 * Meters whose monthly electricity series is generated, and the base
 * demand each runs at before weather and occupancy are applied.
 *
 * Only meters that are actually live. M-006 sits in the same building as
 * M-001 but is DECOMMISSIONED, and is deliberately excluded so the
 * attribution code has to filter on meter status rather than trusting
 * the building alone.
 */
const GENERATED_SERIES: {
  meter_id: string;
  code: string;
  organization_id: string;
  base_kwh: number;
}[] = [
  {
    meter_id: "mmmm0000-0001-4000-8000-000000000000",
    code: "M001",
    organization_id: "org-001",
    base_kwh: 42000,
  },
  {
    meter_id: "mmmm0000-000a-4000-8000-000000000000",
    code: "M010",
    organization_id: "org-001",
    base_kwh: 28000,
  },
  {
    meter_id: "mmmm0000-0f02-4000-8000-000000000000",
    code: "CVM001",
    organization_id: "org-002",
    base_kwh: 55000,
  },
  {
    meter_id: "mmmm0000-0f04-4000-8000-000000000000",
    code: "HPM001",
    organization_id: "org-004",
    base_kwh: 31000,
  },
  {
    meter_id: "mmmm0000-0f05-4000-8000-000000000000",
    code: "HPM002",
    organization_id: "org-004",
    base_kwh: 19000,
  },
];

/**
 * org-001 implemented its two accepted findings at the end of February
 * 2026, cutting real demand on the affected meters by 12%. org-002 has an
 * approved audit but has implemented nothing, so it has no claimable
 * saving at all — which is the case the billing engine has to handle
 * without producing a performance-share line.
 */
const RETROFIT_FROM_PERIOD = "2026-03";
const RETROFIT_FACTOR = 0.88;
const RETROFIT_METER_IDS = [
  "mmmm0000-0001-4000-8000-000000000000",
  "mmmm0000-000a-4000-8000-000000000000",
];

/** Every "YYYY-MM" in the generated series, in order. */
function eachSeriesMonth(): { year: number; month: number; period: string }[] {
  const months: { year: number; month: number; period: string }[] = [];
  let year = SERIES_FROM.year;
  let month = SERIES_FROM.month;
  while (year < SERIES_TO.year || (year === SERIES_TO.year && month <= SERIES_TO.month)) {
    months.push({ year, month, period: `${year}-${String(month).padStart(2, "0")}` });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** Cooling degree days for a month, with 2026's mild hot season applied. */
function cddFor(year: number, month: number): number {
  const base = BASE_CDD_BY_MONTH[month];
  return year === 2026 && month >= 3 ? Math.round(base * MILD_YEAR_FACTOR) : base;
}

/** Occupancy index for a year, relative to the 2025 baseline of 1.0. */
function occupancyFor(year: number): number {
  return year === 2026 ? OCCUPANCY_2026 : 1.0;
}

function buildPeriodFactors(): PeriodFactors[] {
  const rows: PeriodFactors[] = [];
  for (const orgId of Object.keys(ORG_FLOOR_AREA)) {
    for (const { year, month, period } of eachSeriesMonth()) {
      rows.push({
        organization_id: orgId,
        period,
        cooling_degree_days: cddFor(year, month),
        occupancy_index: occupancyFor(year),
        floor_area_sqm: ORG_FLOOR_AREA[orgId],
      });
    }
  }
  return rows;
}

/**
 * One monthly electricity reading per generated meter.
 *
 * Consumption is a deterministic function of the same factors the
 * adjustment later divides back out, which is what makes the whole
 * demonstration honest: the savings the engine reports are exactly the
 * part of the drop that weather and occupancy cannot explain.
 */
function buildMonthlyElectricityReadings(): MeterReading[] {
  const readings: MeterReading[] = [];
  for (const meter of GENERATED_SERIES) {
    for (const { year, month, period } of eachSeriesMonth()) {
      const cdd = cddFor(year, month);
      const weather = 1 + CDD_SENSITIVITY * (cdd - CDD_REFERENCE);
      const occupancy = occupancyFor(year);
      const retrofit =
        period >= RETROFIT_FROM_PERIOD && RETROFIT_METER_IDS.includes(meter.meter_id)
          ? RETROFIT_FACTOR
          : 1;

      readings.push({
        reading_id: `gen-${meter.code}-${period}`,
        organization_id: meter.organization_id,
        meter_id: meter.meter_id,
        value: Math.round(meter.base_kwh * weather * occupancy * retrofit),
        unit: "kWh",
        // Month-end stamp: these are monthly totals, not spot readings.
        timestamp: new Date(Date.UTC(year, month, 0, 23, 59, 0)).toISOString(),
      });
    }
  }
  return readings;
}

@Injectable({ scope: Scope.DEFAULT })
export class DatabaseService {
  /**
   * Client organisations (tenants). org-001 owns all of the original
   * single-campus demo data; org-002 is a second live client used to prove
   * tenant isolation; org-003 is a prospect that has not been onboarded yet.
   */
  public organizations: Organization[] = [
    {
      organization_id: "org-001",
      name: "Sri City Institute of Technology",
      type: "University",
      location: "Sri City, Andhra Pradesh",
      status: OrganizationStatus.ACTIVE,
      data_source_tier: DataSourceTier.BMS_INTEGRATION,
      floor_area_sqm: 42000,
      tariff_rate: 8.5,
      contract_start: "2025-01-01",
    },
    {
      organization_id: "org-002",
      name: "Coastal Valley University",
      type: "University",
      location: "Visakhapatnam, Andhra Pradesh",
      status: OrganizationStatus.ACTIVE,
      data_source_tier: DataSourceTier.MANUAL_UPLOAD,
      floor_area_sqm: 68000,
      tariff_rate: 9.2,
      contract_start: "2025-06-01",
    },
    {
      organization_id: "org-003",
      name: "Northgate Business Park",
      type: "Corporate Campus",
      location: "Hyderabad, Telangana",
      status: OrganizationStatus.PROSPECT,
      data_source_tier: DataSourceTier.NO_METERING,
      floor_area_sqm: 31000,
      tariff_rate: null,
      contract_start: null,
    },
    {
      // Mid-onboarding: metered and reporting, but not yet baselined. This is
      // the state an auditor actually works in — org-003 above is a genuine
      // no-metering prospect, where a baseline is impossible until meters
      // exist, and the API correctly refuses to invent one.
      organization_id: "org-004",
      name: "Harbour Point Polytechnic",
      type: "Polytechnic",
      location: "Kakinada, Andhra Pradesh",
      status: OrganizationStatus.AUDITED,
      data_source_tier: DataSourceTier.MANUAL_UPLOAD,
      floor_area_sqm: 24000,
      tariff_rate: 8.9,
      contract_start: null,
    },
  ];

  public users: User[] = [
    {
      user_id: "550e8400-0001-4000-8000-000000000001",
      organization_id: "org-001",
      name: "Aadithya",
      email: "aadi@gmail.com",
      phone: "9876543210",
      password: "Aadi@123",
      role: UserRole.SYSTEM_ADMINISTRATOR,
      specialization: null,
    },
    {
      user_id: "550e8400-0002-4000-8000-000000000002",
      organization_id: "org-001",
      name: "Husaam",
      email: "husaam@gmail.com",
      phone: "9876543211",
      password: "Husaam@123",
      role: UserRole.FINANCIAL_ANALYST,
      specialization: null,
    },
    {
      user_id: "550e8400-0003-4000-8000-000000000003",
      organization_id: "org-001",
      name: "Chirag",
      email: "chirag@gmail.com",
      phone: "9876543212",
      password: "Chirag@123",
      role: UserRole.TECHNICIAN_ADMINISTRATOR,
      specialization: "Electrical",
    },
    {
      user_id: "550e8400-0004-4000-8000-000000000004",
      organization_id: "org-001",
      name: "Teja",
      email: "teja@gmail.com",
      phone: "9876543214",
      password: "Teja@123",
      role: UserRole.TECHNICIAN,
      specialization: "Solar Installation",
    },
    {
      user_id: "550e8400-0005-4000-8000-000000000005",
      organization_id: "org-001",
      name: "Viksa",
      email: "viksa@gmail.com",
      phone: "9876543213",
      password: "Viksa@123",
      role: UserRole.SUSTAINABILITY_OFFICER,
      specialization: null,
    },
    {
      user_id: "550e8400-0006-4000-8000-000000000006",
      organization_id: "org-001",
      name: "Trishank",
      email: "trishank@gmail.com",
      phone: "9876543215",
      password: "Trishank@123",
      role: UserRole.CAMPUS_VISITOR,
      specialization: null,
    },
    {
      user_id: "550e8400-0007-4000-8000-000000000007",
      organization_id: "org-001",
      name: "Elena Park",
      email: "elena@gmail.com",
      phone: "9876543216",
      password: "Elena@123",
      role: UserRole.TECHNICIAN,
      specialization: "Electrical",
    },
    {
      user_id: "550e8400-0008-4000-8000-000000000008",
      organization_id: "org-001",
      name: "Marcus Reed",
      email: "marcus@gmail.com",
      phone: "9876543217",
      password: "Marcus@123",
      role: UserRole.TECHNICIAN,
      specialization: "HVAC",
    },
    {
      user_id: "550e8400-0009-4000-8000-000000000009",
      organization_id: "org-001",
      name: "Noah Smith",
      email: "noah@gmail.com",
      phone: "9876543218",
      password: "Noah@123",
      role: UserRole.TECHNICIAN,
      specialization: "General Maintenance",
    },
    {
      user_id: "550e8400-000a-4000-8000-00000000000a",
      organization_id: "org-001",
      name: "Rina Das",
      email: "rina@gmail.com",
      phone: "9876543219",
      password: "Rina@123",
      role: UserRole.TECHNICIAN,
      specialization: "Plumbing",
    },

    // ── EnerTrack staff: no organization_id, they work across tenants ──
    {
      user_id: "550e8400-00f1-4000-8000-0000000000f1",
      organization_id: null,
      name: "Priya Nair",
      email: "priya@enertrack.com",
      phone: "9800000001",
      password: "Priya@123",
      role: UserRole.SUPER_ADMIN,
      specialization: null,
    },
    {
      user_id: "550e8400-00f2-4000-8000-0000000000f2",
      organization_id: null,
      name: "Arun Menon",
      email: "arun@enertrack.com",
      phone: "9800000002",
      password: "Arun@123",
      role: UserRole.CERTIFIED_ENERGY_AUDITOR,
      specialization: "Energy Audit (BEE Certified)",
    },
    {
      user_id: "550e8400-00f3-4000-8000-0000000000f3",
      organization_id: null,
      name: "Divya Rao",
      email: "divya@enertrack.com",
      phone: "9800000003",
      password: "Divya@123",
      role: UserRole.ACCOUNT_OFFICER,
      specialization: null,
    },

    // ── Client-side staff for the second tenant (proves isolation) ──
    {
      user_id: "550e8400-00b1-4000-8000-0000000000b1",
      organization_id: "org-002",
      name: "Kavya Iyer",
      email: "kavya@coastalvalley.edu",
      phone: "9811000001",
      password: "Kavya@123",
      role: UserRole.FACILITY_MANAGER,
      specialization: "Facilities",
    },
    {
      user_id: "550e8400-00b2-4000-8000-0000000000b2",
      organization_id: "org-002",
      name: "Rahul Verma",
      email: "rahul@coastalvalley.edu",
      phone: "9811000002",
      password: "Rahul@123",
      role: UserRole.ECONOMIC_BUYER,
      specialization: null,
    },
  ];
  public notifications: Notification[] = [
    {
      notification_id: "660e8400-0001-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0002-4000-8000-000000000002",
      target_type: NotificationTargetType.ALERT,
      target_id: "target1",
      message: "Notif 1",
      is_read: false,
    },
    {
      notification_id: "660e8400-0002-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0003-4000-8000-000000000003",
      target_type: NotificationTargetType.REQUEST,
      target_id: "target2",
      message: "Notif 2",
      is_read: false,
    },
    {
      notification_id: "660e8400-0003-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0004-4000-8000-000000000004",
      target_type: NotificationTargetType.WASTAGE,
      target_id: "target3",
      message: "Notif 3",
      is_read: false,
    },
    {
      notification_id: "660e8400-0004-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0005-4000-8000-000000000005",
      target_type: NotificationTargetType.ALERT,
      target_id: "target4",
      message: "Notif 4",
      is_read: false,
    },
    {
      notification_id: "660e8400-0005-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0006-4000-8000-000000000006",
      target_type: NotificationTargetType.REQUEST,
      target_id: "target5",
      message: "Notif 5",
      is_read: false,
    },
    {
      notification_id: "660e8400-0006-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0007-4000-8000-000000000007",
      target_type: NotificationTargetType.WASTAGE,
      target_id: "target6",
      message: "Notif 6",
      is_read: false,
    },
    {
      notification_id: "660e8400-0007-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0008-4000-8000-000000000008",
      target_type: NotificationTargetType.ALERT,
      target_id: "target7",
      message: "Notif 7",
      is_read: false,
    },
    {
      notification_id: "660e8400-0008-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0001-4000-8000-000000000001",
      target_type: NotificationTargetType.REQUEST,
      target_id: "target8",
      message: "Notif 8",
      is_read: false,
    },
    {
      notification_id: "660e8400-0009-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0002-4000-8000-000000000002",
      target_type: NotificationTargetType.WASTAGE,
      target_id: "target9",
      message: "Notif 9",
      is_read: false,
    },
    {
      notification_id: "660e8400-000a-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0003-4000-8000-000000000003",
      target_type: NotificationTargetType.ALERT,
      target_id: "target10",
      message: "Notif 10",
      is_read: false,
    },
  ];
  public campus: Campus[] = [
    {
      campus_id: "660e8700-0001-4000-8000-000000000000",
      organization_id: "org-001",
      name: "Campus 1",
      location: "Location 1",
      total_budget: 1000000,
    },
    {
      campus_id: "660e8700-0002-4000-8000-000000000000",
      organization_id: "org-001",
      name: "Campus 2",
      location: "Location 2",
      total_budget: 2000000,
    },
    {
      campus_id: "660e8700-0f02-4000-8000-000000000000",
      organization_id: "org-002",
      name: "Coastal Valley Main Campus",
      location: "Visakhapatnam",
      total_budget: 2400000,
    },
    {
      campus_id: "660e8700-0f04-4000-8000-000000000000",
      organization_id: "org-004",
      name: "Harbour Point Campus",
      location: "Kakinada",
      total_budget: 1400000,
    },
  ];
  public buildings: Building[] = [
    {
      building_id: "660e8800-0001-4000-8000-000000000000",
      organization_id: "org-001",
      campus_id: "660e8700-0002-4000-8000-000000000000",
      name: "Building 1",
      budget: 200000,
    },
    {
      building_id: "660e8800-0002-4000-8000-000000000000",
      organization_id: "org-001",
      campus_id: "660e8700-0001-4000-8000-000000000000",
      name: "Building 2",
      budget: 400000,
    },
    {
      building_id: "660e8800-0003-4000-8000-000000000000",
      organization_id: "org-001",
      campus_id: "660e8700-0002-4000-8000-000000000000",
      name: "Building 3",
      budget: 600000,
    },
    {
      building_id: "660e8800-0004-4000-8000-000000000000",
      organization_id: "org-001",
      campus_id: "660e8700-0001-4000-8000-000000000000",
      name: "Building 4",
      budget: 800000,
    },
    {
      building_id: "660e8800-0005-4000-8000-000000000000",
      organization_id: "org-001",
      campus_id: "660e8700-0002-4000-8000-000000000000",
      name: "Building 5",
      budget: 1000000,
    },
    {
      building_id: "660e8800-0f02-4000-8000-000000000000",
      organization_id: "org-002",
      campus_id: "660e8700-0f02-4000-8000-000000000000",
      name: "Marine Sciences Block",
      budget: 900000,
    },
    {
      building_id: "660e8800-0f04-4000-8000-000000000000",
      organization_id: "org-004",
      campus_id: "660e8700-0f04-4000-8000-000000000000",
      name: "Engineering Workshop",
      budget: 520000,
    },
    {
      building_id: "660e8800-0f05-4000-8000-000000000000",
      organization_id: "org-004",
      campus_id: "660e8700-0f04-4000-8000-000000000000",
      name: "Central Library",
      budget: 380000,
    },
  ];
  public departments: Department[] = [
    {
      department_id: "dddd0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0002-4000-8000-000000000000",
      name: "Department 1",
      budget: 50000,
    },
    {
      department_id: "dddd0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0003-4000-8000-000000000000",
      name: "Department 2",
      budget: 100000,
    },
    {
      department_id: "dddd0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0004-4000-8000-000000000000",
      name: "Department 3",
      budget: 150000,
    },
    {
      department_id: "dddd0000-0004-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0005-4000-8000-000000000000",
      name: "Department 4",
      budget: 200000,
    },
    {
      department_id: "dddd0000-0005-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0001-4000-8000-000000000000",
      name: "Department 5",
      budget: 250000,
    },
    {
      department_id: "dddd0000-0006-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0002-4000-8000-000000000000",
      name: "Department 6",
      budget: 300000,
    },
    {
      department_id: "dddd0000-0007-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0003-4000-8000-000000000000",
      name: "Department 7",
      budget: 350000,
    },
    {
      department_id: "dddd0000-0008-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0004-4000-8000-000000000000",
      name: "Department 8",
      budget: 400000,
    },
  ];
  public meters: Meter[] = [
    {
      meter_id: "mmmm0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0002-4000-8000-000000000000",
      meter_code: "M-001",
      meter_type: MeterType.ELECTRICITY,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0003-4000-8000-000000000000",
      meter_code: "M-002",
      meter_type: MeterType.GAS,
      zone: "Zone 3",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0004-4000-8000-000000000000",
      meter_code: "M-003",
      meter_type: MeterType.WATER,
      zone: "Zone 1",
      status: MeterStatus.FAULTY,
    },
    {
      meter_id: "mmmm0000-0004-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0005-4000-8000-000000000000",
      meter_code: "M-004",
      meter_type: MeterType.EMISSIONS,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0005-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0001-4000-8000-000000000000",
      meter_code: "M-005",
      meter_type: MeterType.FOOD,
      zone: "Zone 3",
      status: MeterStatus.CALIBRATING,
    },
    {
      meter_id: "mmmm0000-0006-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0002-4000-8000-000000000000",
      meter_code: "M-006",
      meter_type: MeterType.ELECTRICITY,
      zone: "Zone 1",
      status: MeterStatus.DECOMMISSIONED,
    },
    {
      meter_id: "mmmm0000-0007-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0003-4000-8000-000000000000",
      meter_code: "M-007",
      meter_type: MeterType.WATER,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0008-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0004-4000-8000-000000000000",
      meter_code: "M-008",
      meter_type: MeterType.GAS,
      zone: "Zone 3",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0009-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0005-4000-8000-000000000000",
      meter_code: "M-009",
      meter_type: MeterType.EMISSIONS,
      zone: "Zone 1",
      status: MeterStatus.FAULTY,
    },
    {
      meter_id: "mmmm0000-000a-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0001-4000-8000-000000000000",
      meter_code: "M-010",
      meter_type: MeterType.ELECTRICITY,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0f02-4000-8000-000000000000",
      organization_id: "org-002",
      building_id: "660e8800-0f02-4000-8000-000000000000",
      meter_code: "CV-M-001",
      meter_type: MeterType.ELECTRICITY,
      zone: "Block A",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0f04-4000-8000-000000000000",
      organization_id: "org-004",
      building_id: "660e8800-0f04-4000-8000-000000000000",
      meter_code: "HP-M-001",
      meter_type: MeterType.ELECTRICITY,
      zone: "Workshop",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0f05-4000-8000-000000000000",
      organization_id: "org-004",
      building_id: "660e8800-0f05-4000-8000-000000000000",
      meter_code: "HP-M-002",
      meter_type: MeterType.ELECTRICITY,
      zone: "Library",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0f06-4000-8000-000000000000",
      organization_id: "org-004",
      building_id: "660e8800-0f05-4000-8000-000000000000",
      meter_code: "HP-M-003",
      meter_type: MeterType.WATER,
      zone: "Library",
      status: MeterStatus.ACTIVE,
    },
  ];
  public meterReadings: MeterReading[] = [
    {
      reading_id: "rrrr0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0002-4000-8000-000000000000",
      value: 105.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0003-4000-8000-000000000000",
      value: 111.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0004-4000-8000-000000000000",
      value: 116.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0004-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0005-4000-8000-000000000000",
      value: 122.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0005-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0006-4000-8000-000000000000",
      value: 127.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0006-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0007-4000-8000-000000000000",
      value: 133.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0007-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0008-4000-8000-000000000000",
      value: 138.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0008-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0009-4000-8000-000000000000",
      value: 144.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0009-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-000a-4000-8000-000000000000",
      value: 149.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000a-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0001-4000-8000-000000000000",
      value: 155.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000b-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0002-4000-8000-000000000000",
      value: 160.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000c-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0003-4000-8000-000000000000",
      value: 166.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000d-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0004-4000-8000-000000000000",
      value: 171.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000e-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0005-4000-8000-000000000000",
      value: 177.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000f-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0006-4000-8000-000000000000",
      value: 182.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0010-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0007-4000-8000-000000000000",
      value: 188.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0011-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0008-4000-8000-000000000000",
      value: 193.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0012-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0009-4000-8000-000000000000",
      value: 199.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0013-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-000a-4000-8000-000000000000",
      value: 204.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0014-4000-8000-000000000000",
      organization_id: "org-001",
      meter_id: "mmmm0000-0001-4000-8000-000000000000",
      value: 210.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
  ];
  public wastageReports: WastageReport[] = [
    {
      wastage_report_id: "wwww0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      reporter_id: "550e8400-0002-4000-8000-000000000002",
      type: WastageType.WATER,
      status: "Forwarded to Finance",
      details: { 
        specificData: {
          nature: "Sprinkler system leaking heavily near the pathway.", 
          location: "Main Courtyard, East Wing"
        },
        priority: "High",
        systemData: {
          sensorId: "FLOW-CW-01",
          readingValue: 45.5,
          readingUnit: "L/min",
          baselineValue: 20.0,
          confidence: "High",
          status: "abnormal"
        }
      },
      sensor_reading_id: "rrrr0000-0001-4000-8000-000000000000",
    },
    {
      wastage_report_id: "wwww0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      reporter_id: "550e8400-0003-4000-8000-000000000003",
      type: WastageType.FOOD,
      status: "reported",
      details: { 
        specificData: {
          typeOfWastage: "Unserved catered buffet food.",
          estimatedAmount: "25",
          cafeteria: "North Campus Cafeteria"
        },
        priority: "Medium",
        systemData: {
          sensorId: "WEIGHT-BIN-04",
          readingValue: 35.2,
          readingUnit: "kg",
          baselineValue: 10.0,
          confidence: "Medium",
          status: "abnormal"
        }
      },
      sensor_reading_id: "rrrr0000-0003-4000-8000-000000000000",
    },
    {
      wastage_report_id: "wwww0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      reporter_id: "550e8400-0004-4000-8000-000000000004",
      type: WastageType.ENERGY,
      status: "reported",
      details: { 
        specificData: {
          observation: "AC left running at 18C in empty conference rooms.",
          building: "Science Block B, Floor 3"
        },
        priority: "Low",
        systemData: {
          sensorId: "HVAC-PWR-B3",
          readingValue: 12.4,
          readingUnit: "kW",
          baselineValue: 3.5,
          confidence: "High",
          status: "abnormal"
        }
      },
      sensor_reading_id: null,
    }
  ];
  public alerts: Alert[] = [
    {
      alert_id: "ALT-001",
      organization_id: "org-001",
      meter_id: "mmmm0000-0002-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0002-4000-8000-000000000000",
      title: "Abnormal Water Flow: Science Lab 4",
      severity: "critical",
      status: AlertStatus.OPEN,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Flow rate 40L/min detected outside operating hours.",
          timestamp: "2026-05-05T08:00:00.000Z",
        },
      ],
    },
    {
      alert_id: "ALT-002",
      organization_id: "org-001",
      meter_id: "mmmm0000-0003-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0003-4000-8000-000000000000",
      title: "Transformer Overheating: Substation A",
      severity: "high",
      status: AlertStatus.ACKNOWLEDGED,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Temperature reached 95°C. Cooling system may be failing.",
          timestamp: "2026-05-05T09:30:00.000Z",
        },
      ],
    },
    {
      alert_id: "ALT-003",
      organization_id: "org-001",
      meter_id: "mmmm0000-0004-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0004-4000-8000-000000000000",
      title: "Phase Unbalance: Engineering Block",
      severity: "moderate",
      status: AlertStatus.OPEN,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Current unbalance detected on Phase B. Potential load issue.",
          timestamp: "2026-05-05T10:15:00.000Z",
        },
      ],
    },
    {
      alert_id: "ALT-004",
      organization_id: "org-001",
      meter_id: "mmmm0000-0005-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0005-4000-8000-000000000000",
      title: "Suspicious Energy Surge: IT Server Room",
      severity: "critical",
      status: AlertStatus.OPEN,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Spike of 50kW detected in Server Room 101. Verify UPS status.",
          timestamp: "2026-05-05T11:45:00.000Z",
        },
      ],
    },
    {
      alert_id: "ALT-005",
      organization_id: "org-001",
      meter_id: "mmmm0000-0006-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0006-4000-8000-000000000000",
      title: "HVAC Communication Loss: Admin Building",
      severity: "low",
      status: AlertStatus.OPEN,
      messages: [
        {
          sender_role: "System Administrator",
          content: "BMS lost connectivity with floor 2 thermostats.",
          timestamp: "2026-05-05T12:00:00.000Z",
        },
      ],
    },
    {
      alert_id: "ALT-006",
      organization_id: "org-001",
      meter_id: "mmmm0000-0007-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0007-4000-8000-000000000000",
      title: "Gas Leak Sensor Trigger: Chemistry Wing",
      severity: "critical",
      status: AlertStatus.RESOLVED,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Low-level gas detection. Auto-shutoff valves engaged.",
          timestamp: "2026-05-05T06:00:00.000Z",
        },
      ],
    },
  ];
  public faults: Fault[] = [
    {
      fault_id: "FLT-001",
      organization_id: "org-001",
      alert_id: null,
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Chiller Unit C-12",
      fault_type: "Mechanical",
      severity: FaultSeverity.MODERATE,
      status: FaultStatus.PENDING,
    },
    {
      fault_id: "FLT-002",
      organization_id: "org-001",
      alert_id: "ALT-003",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Main Breaker MB-01",
      fault_type: "Electrical",
      severity: FaultSeverity.HIGH,
      status: FaultStatus.RESOLVED,
    },
    {
      fault_id: "FLT-003",
      organization_id: "org-001",
      alert_id: null,
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Solar Inverter INV-5",
      fault_type: "Electronics",
      severity: FaultSeverity.CRITICAL,
      status: FaultStatus.ACTIVE,
    },
    {
      fault_id: "FLT-004",
      organization_id: "org-001",
      alert_id: "ALT-005",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Cooling Tower CT-2",
      fault_type: "Plumbing",
      severity: FaultSeverity.LOW,
      status: FaultStatus.PENDING,
    },
    {
      fault_id: "FLT-005",
      organization_id: "org-001",
      alert_id: null,
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Backup Generator GEN-1",
      fault_type: "Engine",
      severity: FaultSeverity.MODERATE,
      status: FaultStatus.RESOLVED,
    },
    {
      fault_id: "FLT-006",
      organization_id: "org-001",
      alert_id: "ALT-001",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Lab 4 Main Supply Pipe",
      fault_type: "Plumbing",
      severity: FaultSeverity.HIGH,
      status: FaultStatus.ACTIVE,
    },
    {
      fault_id: "FLT-007",
      organization_id: "org-001",
      alert_id: null,
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Elevator E-2 Control Board",
      fault_type: "Electronics",
      severity: FaultSeverity.CRITICAL,
      status: FaultStatus.PENDING,
    },
  ];
  public serviceRequests: ServiceRequest[] = [];
  public workOrders: WorkOrder[] = [
    {
      work_order_id: "660e8600-0001-4000-8000-000000000000",
      organization_id: "org-001",
      assigned_to_id: "550e8400-0004-4000-8000-000000000004",
      linked_fault_id: null,
      source_request_id: "660e8500-0002-4000-8000-000000000000",
      title: "HVAC Filter Replacement – Block A",
      priority: WorkOrderPriority.HIGH,
      status: WorkOrderStatus.APPROVAL,
    },
    {
      work_order_id: "660e8600-0002-4000-8000-000000000000",
      organization_id: "org-001",
      assigned_to_id: "550e8400-0004-4000-8000-000000000004",
      linked_fault_id: "FLT-003",
      source_request_id: null,
      title: "Solar Panel Inspection – Roof Level 3",
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.INPROGRESS,
    },
    {
      work_order_id: "660e8600-0003-4000-8000-000000000000",
      organization_id: "org-001",
      assigned_to_id: "550e8400-0004-4000-8000-000000000004",
      linked_fault_id: null,
      source_request_id: "660e8500-0004-4000-8000-000000000000",
      title: "Lighting Circuit Fault – Corridor B2",
      priority: WorkOrderPriority.LOW,
      status: WorkOrderStatus.REVIEW,
    },
    {
      work_order_id: "660e8600-0004-4000-8000-000000000000",
      organization_id: "org-001",
      assigned_to_id: "550e8400-0004-4000-8000-000000000004",
      linked_fault_id: "660e8900-0005-4000-8000-000000000000",
      source_request_id: null,
      title: "Emergency Generator Test – Block D",
      priority: WorkOrderPriority.IMMEDIATE,
      status: WorkOrderStatus.CLOSED,
    },
    {
      work_order_id: "660e8600-0005-4000-8000-000000000000",
      organization_id: "org-001",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      linked_fault_id: null,
      source_request_id: "660e8500-0006-4000-8000-000000000000",
      title: "Electrical Panel Maintenance – Substation 2",
      priority: WorkOrderPriority.HIGH,
      status: WorkOrderStatus.NEW,
    },
    {
      work_order_id: "660e8600-0006-4000-8000-000000000000",
      organization_id: "org-001",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      linked_fault_id: "660e8900-0007-4000-8000-000000000000",
      source_request_id: null,
      title: "Water Pump Overhaul – Basement Level",
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.INPROGRESS,
    },
    {
      work_order_id: "660e8600-0007-4000-8000-000000000000",
      organization_id: "org-001",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      linked_fault_id: null,
      source_request_id: "660e8500-0008-4000-8000-000000000000",
      title: "Fire Suppression System Check – Block C",
      priority: WorkOrderPriority.HIGH,
      status: WorkOrderStatus.REVIEW,
    },
    {
      work_order_id: "660e8600-0008-4000-8000-000000000000",
      organization_id: "org-001",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      linked_fault_id: "660e8900-0002-4000-8000-000000000000",
      source_request_id: null,
      title: "Smart Meter Calibration – Energy Lab",
      priority: WorkOrderPriority.IMMEDIATE,
      status: WorkOrderStatus.CLOSED,
    },
  ];

  public energyCosts: EnergyCost[] = [
    {
      energy_cost_id: "eeee0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0002-4000-8000-000000000000",
      department_id: "dddd0000-0002-4000-8000-000000000000",
      period: "2025-02",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.ON_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0003-4000-8000-000000000000",
      department_id: "dddd0000-0003-4000-8000-000000000000",
      period: "2025-03",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.OVER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0004-4000-8000-000000000000",
      department_id: "dddd0000-0004-4000-8000-000000000000",
      period: "2025-01",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.UNDER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0004-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0005-4000-8000-000000000000",
      department_id: "dddd0000-0005-4000-8000-000000000000",
      period: "2025-02",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.ON_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0005-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0001-4000-8000-000000000000",
      department_id: "dddd0000-0006-4000-8000-000000000000",
      period: "2025-03",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.OVER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0006-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0002-4000-8000-000000000000",
      department_id: "dddd0000-0007-4000-8000-000000000000",
      period: "2025-01",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.UNDER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0007-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0003-4000-8000-000000000000",
      department_id: "dddd0000-0008-4000-8000-000000000000",
      period: "2025-02",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.ON_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0008-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0004-4000-8000-000000000000",
      department_id: "dddd0000-0001-4000-8000-000000000000",
      period: "2025-03",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.OVER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0009-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0005-4000-8000-000000000000",
      department_id: "dddd0000-0002-4000-8000-000000000000",
      period: "2025-01",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.UNDER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-000a-4000-8000-000000000000",
      organization_id: "org-001",
      building_id: "660e8800-0001-4000-8000-000000000000",
      department_id: "dddd0000-0003-4000-8000-000000000000",
      period: "2025-02",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.ON_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0f02-4000-8000-000000000000",
      organization_id: "org-002",
      building_id: "660e8800-0f02-4000-8000-000000000000",
      department_id: null,
      period: "2025-02",
      electricity: 2610.0,
      gas: 340.0,
      water: 280.0,
      status: EnergyCostStatus.OVER_BUDGET,
    },
  ];
  public invoices: Invoice[] = [
    {
      invoice_id: "vvvv0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      department_id: "dddd0000-0002-4000-8000-000000000000",
      department_label: "Academic Affairs",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0001",
      vendor: "City Power Corp",
      amount: 500,
      type: "electricity",
      issued_date: "2025-02-01",
      due_date: "2025-03-15",
      status: InvoiceStatus.APPROVED,
      archived: false,
    },
    {
      invoice_id: "vvvv0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      department_id: "dddd0000-0003-4000-8000-000000000000",
      department_label: "Computer Science",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0002",
      vendor: "National Gas Grid",
      amount: 1000,
      type: "gas",
      issued_date: "2025-02-05",
      due_date: "2025-03-20",
      status: InvoiceStatus.OVERDUE,
      archived: false,
    },
    {
      invoice_id: "vvvv0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      department_id: "dddd0000-0004-4000-8000-000000000000",
      department_label: "Mechanical Engineering",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0003",
      vendor: "Aqua Pure Water",
      amount: 1500,
      type: "water",
      issued_date: "2025-02-10",
      due_date: "2025-03-25",
      status: InvoiceStatus.PAID,
      archived: false,
    },
    {
      invoice_id: "vvvv0000-0004-4000-8000-000000000000",
      organization_id: "org-001",
      department_id: "dddd0000-0005-4000-8000-000000000000",
      department_label: "Civil Engineering",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0004",
      vendor: "Power Grid Solutions",
      amount: 2000,
      type: "electricity",
      issued_date: "2025-02-12",
      due_date: "2025-03-28",
      status: InvoiceStatus.PENDING,
      archived: false,
    },
    {
      invoice_id: "vvvv0000-0005-4000-8000-000000000000",
      organization_id: "org-001",
      department_id: "dddd0000-0006-4000-8000-000000000000",
      department_label: "Biotechnology",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0005",
      vendor: "City Gas Services",
      amount: 2500,
      type: "gas",
      issued_date: "2025-02-15",
      due_date: "2025-04-01",
      status: InvoiceStatus.APPROVED,
      archived: false,
    },
    {
      invoice_id: "vvvv0000-0006-4000-8000-000000000000",
      organization_id: "org-001",
      department_id: "dddd0000-0007-4000-8000-000000000000",
      department_label: "Chemical Engineering",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0006",
      vendor: "Municipal Water Board",
      amount: 3000,
      type: "water",
      issued_date: "2025-02-18",
      due_date: "2025-04-05",
      status: InvoiceStatus.OVERDUE,
      archived: false,
    },
    {
      invoice_id: "vvvv0000-0007-4000-8000-000000000000",
      organization_id: "org-001",
      department_id: "dddd0000-0008-4000-8000-000000000000",
      department_label: "Student Affairs",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0007",
      vendor: "Eco Energy Tech",
      amount: 3500,
      type: "demand",
      issued_date: "2025-02-20",
      due_date: "2025-04-10",
      status: InvoiceStatus.PAID,
      archived: false,
    },
    {
      invoice_id: "vvvv0000-0008-4000-8000-000000000000",
      organization_id: "org-001",
      department_id: "dddd0000-0001-4000-8000-000000000000",
      department_label: "Administration",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0008",
      vendor: "State Electricity Board",
      amount: 4000,
      type: "electricity",
      issued_date: "2025-02-22",
      due_date: "2025-04-15",
      status: InvoiceStatus.PENDING,
      archived: false,
    },
  ];
  public financialReports: FinancialReport[] = [
    {
      financial_report_id: "pppp0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      generated_by_id: "550e8400-0002-4000-8000-000000000002",
      building_id: "660e8800-0002-4000-8000-000000000000",
      department_id: "dddd0000-0002-4000-8000-000000000000",
      title: "Report 1",
      period: "Q1 2025",
      roi: "15%",
      npv: 10000.0,
    },
    {
      financial_report_id: "pppp0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      generated_by_id: "550e8400-0002-4000-8000-000000000002",
      building_id: "660e8800-0003-4000-8000-000000000000",
      department_id: "dddd0000-0003-4000-8000-000000000000",
      title: "Report 2",
      period: "Q1 2025",
      roi: "15%",
      npv: 10000.0,
    },
    {
      financial_report_id: "pppp0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      generated_by_id: "550e8400-0002-4000-8000-000000000002",
      building_id: "660e8800-0004-4000-8000-000000000000",
      department_id: "dddd0000-0004-4000-8000-000000000000",
      title: "Report 3",
      period: "Q1 2025",
      roi: "15%",
      npv: 10000.0,
    },
    {
      financial_report_id: "pppp0000-0004-4000-8000-000000000000",
      organization_id: "org-001",
      generated_by_id: "550e8400-0002-4000-8000-000000000002",
      building_id: "660e8800-0005-4000-8000-000000000000",
      department_id: "dddd0000-0005-4000-8000-000000000000",
      title: "Report 4",
      period: "Q1 2025",
      roi: "15%",
      npv: 10000.0,
    },
    {
      financial_report_id: "pppp0000-0005-4000-8000-000000000000",
      organization_id: "org-001",
      generated_by_id: "550e8400-0002-4000-8000-000000000002",
      building_id: "660e8800-0001-4000-8000-000000000000",
      department_id: "dddd0000-0006-4000-8000-000000000000",
      title: "Report 5",
      period: "Q1 2025",
      roi: "15%",
      npv: 10000.0,
    },
  ];
  public sustainabilityMetrics: SustainabilityMetric[] = [
    {
      sustainability_metric_id: "kkkk0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      period: "2024-11",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      period: "2024-12",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      period: "2024-10",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0004-4000-8000-000000000000",
      organization_id: "org-001",
      period: "2024-11",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0005-4000-8000-000000000000",
      organization_id: "org-001",
      period: "2024-12",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0006-4000-8000-000000000000",
      organization_id: "org-001",
      period: "2024-10",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0f02-4000-8000-000000000000",
      organization_id: "org-002",
      period: "2024-10",
      energy_consumed: 28400.0,
      water_usage: 3600.0,
      emissions: 910.0,
    },
  ];
  public initiatives: Initiative[] = [
    {
      initiative_id: "iiii0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      created_by_id: "550e8400-0005-4000-8000-000000000005",
      title: "LED Campus-Wide Retrofit",
      description: "Replace all remaining fluorescent and incandescent bulbs with high-efficiency LED lighting in all administrative and academic buildings to lower baseline energy consumption.",
      status: InitiativeStatus.COMPLETED,
      feasible: true,
      target_reduction: "15%",
      outcomes: ["Reduced lighting energy load by 18%", "Decreased maintenance costs for replacements"],
    },
    {
      initiative_id: "iiii0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      created_by_id: "550e8400-0005-4000-8000-000000000005",
      title: "Smart HVAC Automation",
      description: "Implement occupancy-based smart thermostats and automated scheduling for the campus HVAC system to prevent heating/cooling in unoccupied zones.",
      status: InitiativeStatus.IN_PROGRESS,
      feasible: true,
      target_reduction: "12%",
      outcomes: [],
    },
    {
      initiative_id: "iiii0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      created_by_id: "550e8400-0005-4000-8000-000000000005",
      title: "Cafeteria Food Waste Composting",
      description: "Establish a dedicated composting stream for pre-consumer and post-consumer food waste in all main dining halls to divert organic waste from landfills.",
      status: InitiativeStatus.APPROVED,
      feasible: true,
      target_reduction: "40%",
      outcomes: [],
    },
    {
      initiative_id: "iiii0000-0004-4000-8000-000000000000",
      organization_id: "org-001",
      created_by_id: "550e8400-0005-4000-8000-000000000005",
      title: "Greywater Harvesting System",
      description: "Install greywater collection and filtration systems in the dormitories to reuse water for landscaping and non-potable campus needs.",
      status: InitiativeStatus.PROPOSED,
      feasible: true,
      target_reduction: "25%",
      outcomes: [],
    },
    {
      initiative_id: "iiii0000-0005-4000-8000-000000000000",
      organization_id: "org-001",
      created_by_id: "550e8400-0005-4000-8000-000000000005",
      title: "Solar Panel Expansion (South Lot)",
      description: "Construct a 500kW solar canopy over the South Parking Lot to generate on-site renewable energy and provide shaded parking.",
      status: InitiativeStatus.REJECTED,
      feasible: false,
      target_reduction: "5%",
      outcomes: ["Determined cost-prohibitive due to grid interconnection upgrades required"],
    },
    {
      initiative_id: "iiii0000-0006-4000-8000-000000000000",
      organization_id: "org-001",
      created_by_id: "550e8400-0005-4000-8000-000000000005",
      title: "Water Pressure Optimization",
      description: "Install pressure reducing valves (PRVs) across the campus water distribution network to minimize leakage rates and fixture wear.",
      status: InitiativeStatus.PROPOSED,
      feasible: true,
      target_reduction: "8%",
      outcomes: [],
    },
  ];
  public activityLogs: ActivityLog[] = [
    {
      activity_log_id: "llll0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0002-4000-8000-000000000002",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0003-4000-8000-000000000003",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0004-4000-8000-000000000004",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0004-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0005-4000-8000-000000000005",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0005-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0006-4000-8000-000000000006",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0006-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0007-4000-8000-000000000007",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0007-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0008-4000-8000-000000000008",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0008-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0001-4000-8000-000000000001",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0009-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0002-4000-8000-000000000002",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-000a-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0003-4000-8000-000000000003",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-000b-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0004-4000-8000-000000000004",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-000c-4000-8000-000000000000",
      organization_id: "org-001",
      user_id: "550e8400-0005-4000-8000-000000000005",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
  ];
  public sustainabilityReports: SustainabilityReport[] = [
    {
      report_id: "tttt0000-0001-4000-8000-000000000000",
      organization_id: "org-001",
      generated_by_id: "550e8400-0005-4000-8000-000000000005",
      title: "Q1 Sustainability Performance",
      period: "Q1 2025",
      metrics: {
        energyReduction: "-4.2%",
        wasteDiverted: "68%",
        carbonOffset: "124 tCO2e",
        waterSaved: "1.2 ML"
      },
      generated_at: "2025-04-01T10:00:00.000Z",
    },
    {
      report_id: "tttt0000-0002-4000-8000-000000000000",
      organization_id: "org-001",
      generated_by_id: "550e8400-0005-4000-8000-000000000005",
      title: "Q4 Year-End Sustainability Review",
      period: "Q4 2024",
      metrics: {
        energyReduction: "-3.8%",
        wasteDiverted: "62%",
        carbonOffset: "110 tCO2e",
        waterSaved: "0.9 ML"
      },
      generated_at: "2025-01-05T14:30:00.000Z",
    },
    {
      report_id: "tttt0000-0003-4000-8000-000000000000",
      organization_id: "org-001",
      generated_by_id: "550e8400-0005-4000-8000-000000000005",
      title: "Annual Campus Emissions Report",
      period: "FY 2024",
      metrics: {
        energyReduction: "-5.1%",
        wasteDiverted: "70%",
        carbonOffset: "450 tCO2e",
        waterSaved: "4.5 ML"
      },
      generated_at: "2024-12-10T09:15:00.000Z",
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     REVENUE MODEL SEED

     Read the three streams in the order a client meets them: an audit
     produces a locked baseline, a contract picks a plan, and monthly
     invoices bill the subscription plus whatever savings the client has
     agreed were real.
     ══════════════════════════════════════════════════════════════════ */

  /**
   * The price catalogue. Global — no organization_id, so scopeToTenant()
   * must never touch it.
   *
   * Note the two ends of the range behave differently on purpose, and
   * both cases are live in this seed. org-001 has nine billed meters on
   * Professional, so its per-meter price is what binds. org-002 has one
   * meter on Essential, so its floor is what binds. Any pricing change
   * either client sees is a PATCH to a row below, never a code change.
   */
  public subscriptionPlans: SubscriptionPlan[] = [
    {
      plan_id: "plan-essential",
      name: "Essential",
      tagline: "Metered monitoring and monthly variance reporting.",
      price_per_meter_month: 1800,
      min_monthly_fee: 15000,
      audit_fee_base: 75000,
      audit_fee_per_sqm: 4,
      performance_share_pct: 10,
      share_cap_pct_of_subscription: 200,
      features: [
        "Consumption dashboards",
        "Monthly variance report",
        "Email anomaly alerts",
      ],
      is_active: true,
    },
    {
      plan_id: "plan-professional",
      name: "Professional",
      tagline: "Full workflow, verified savings and account management.",
      price_per_meter_month: 3500,
      min_monthly_fee: 25000,
      audit_fee_base: 150000,
      audit_fee_per_sqm: 6,
      performance_share_pct: 15,
      share_cap_pct_of_subscription: 300,
      features: [
        "Everything in Essential",
        "Fault and work order workflow",
        "Verified savings reporting",
        "Named account officer",
      ],
      is_active: true,
    },
    {
      plan_id: "plan-enterprise",
      name: "Enterprise",
      tagline: "Multi-campus estates with compliance reporting obligations.",
      price_per_meter_month: 5200,
      min_monthly_fee: 60000,
      audit_fee_base: 300000,
      audit_fee_per_sqm: 9,
      performance_share_pct: 20,
      share_cap_pct_of_subscription: 300,
      features: [
        "Everything in Professional",
        "Multi-campus rollup",
        "BRSR and ESG report packs",
        "Quarterly on-site review",
      ],
      is_active: true,
    },
  ];

  /**
   * Live contracts. org-003 deliberately has none: it is a prospect whose
   * audit is still in progress, which is the state the auditor dashboard
   * opens on.
   */
  public subscriptions: Subscription[] = [
    {
      subscription_id: "sub-001",
      organization_id: "org-001",
      plan_id: "plan-professional",
      status: SubscriptionStatus.ACTIVE,
      billing_cycle: BillingCycle.MONTHLY,
      started_on: "2025-01-01",
      renews_on: "2027-01-01",
      cancelled_on: null,
      performance_share_pct_override: null,
      // Waived on signature, so no audit-fee line appears on their invoices.
      audit_fee_waived_on: "2025-01-01",
      account_officer_id: "550e8400-00f3-4000-8000-0000000000f3",
      baseline_audit_id: "audit-001",
    },
    {
      subscription_id: "sub-002",
      organization_id: "org-002",
      plan_id: "plan-essential",
      status: SubscriptionStatus.ACTIVE,
      billing_cycle: BillingCycle.MONTHLY,
      started_on: "2025-06-01",
      renews_on: "2026-12-01",
      cancelled_on: null,
      performance_share_pct_override: null,
      // Not waived: this client paid the audit fee up front.
      audit_fee_waived_on: null,
      account_officer_id: "550e8400-00f3-4000-8000-0000000000f3",
      baseline_audit_id: "audit-002",
    },
  ];

  /** Weather and occupancy per tenant per month. Generated, see below. */
  public periodFactors: PeriodFactors[] = buildPeriodFactors();

  /**
   * Certified auditor engagements.
   *
   * audit-001 is the fully worked example: baseline locked, two findings
   * implemented, and three verifications sitting in three different
   * states so the billing gate is visible without touching anything —
   * one accepted and already invoiced, one disputed, one waiting on the
   * client. A fourth period (2026-07) is deliberately left unverified so
   * there is real work to do in a demo.
   */
  public energyAudits: EnergyAudit[] = [
    {
      audit_id: "audit-001",
      organization_id: "org-001",
      auditor_id: "550e8400-00f2-4000-8000-0000000000f2",
      status: AuditStatus.APPROVED,
      scheduled_on: "2025-09-05",
      conducted_on: "2025-09-12",
      approved_on: "2025-09-30",
      survey: {
        buildings_surveyed: 5,
        meters_found: 10,
        data_source_tier: DataSourceTier.BMS_INTEGRATION,
        floor_area_sqm: 42000,
        notes:
          "BMS already in place across all five blocks. Chiller plant runs on a fixed schedule with no load feedback; lighting in Buildings 1 and 2 is still fluorescent.",
      },
      baseline: {
        period_from: "2025-03",
        period_to: "2025-08",
        locked: true,
        locked_on: "2025-09-30",
        locked_by: "550e8400-00f2-4000-8000-0000000000f2",
        // Average monthly electricity across the six-month window, over
        // the two live meters in the buildings the findings touch.
        baseline_kwh: 97300,
        baseline_water_kl: 3200,
        baseline_cost: 827050,
        baseline_co2_kg: 79786,
        factors: {
          cooling_degree_days: 185,
          occupancy_index: 1.0,
          floor_area_sqm: 42000,
        },
      },
      findings: [
        {
          finding_id: "find-001",
          title: "Chiller plant sequencing on return-water temperature",
          category: "HVAC",
          severity: FindingSeverity.HIGH,
          est_annual_saving: 620000,
          capex: 850000,
          payback_months: 17,
          status: FindingStatus.IMPLEMENTED,
          implemented_on: "2026-02-24",
          building_ids: ["660e8800-0002-4000-8000-000000000000"],
        },
        {
          finding_id: "find-002",
          title: "LED retrofit, Building 1 corridors and lecture halls",
          category: "Lighting",
          severity: FindingSeverity.MODERATE,
          est_annual_saving: 240000,
          capex: 310000,
          payback_months: 16,
          status: FindingStatus.IMPLEMENTED,
          implemented_on: "2026-02-27",
          building_ids: ["660e8800-0001-4000-8000-000000000000"],
        },
        {
          finding_id: "find-003",
          title: "Rooftop solar, 180 kWp across Buildings 3 and 5",
          category: "Generation",
          severity: FindingSeverity.HIGH,
          est_annual_saving: 1450000,
          capex: 9200000,
          payback_months: 76,
          // Accepted but not done, so it credits nothing. Flipping this to
          // IMPLEMENTED is the fastest way to show attribution working.
          status: FindingStatus.ACCEPTED,
          implemented_on: null,
          building_ids: [
            "660e8800-0003-4000-8000-000000000000",
            "660e8800-0005-4000-8000-000000000000",
          ],
        },
      ],
      verifications: [
        {
          verification_id: "ver-001",
          period: "2026-04",
          status: VerificationStatus.CLIENT_ACCEPTED,
          finding_ids: ["find-001", "find-002"],
          meter_ids: [
            "mmmm0000-0001-4000-8000-000000000000",
            "mmmm0000-000a-4000-8000-000000000000",
          ],
          actual_factors: {
            cooling_degree_days: 170,
            occupancy_index: 1.03,
            floor_area_sqm: 42000,
          },
          // A naive baseline-minus-actual would have claimed 14,818 kWh
          // here. April 2026 ran cooler than the baseline average, and
          // that difference is not a saving anyone earned.
          raw_baseline_kwh: 97300,
          adjusted_baseline_kwh: 92093,
          actual_kwh: 82482,
          saved_kwh: 9611,
          saved_amount: 81694,
          signed_by: "550e8400-00f2-4000-8000-0000000000f2",
          signed_on: "2026-05-04",
          accepted_by: "550e8400-0002-4000-8000-000000000002",
          accepted_on: "2026-05-09",
          dispute_reason: null,
          disputed_on: null,
        },
        {
          verification_id: "ver-002",
          period: "2026-05",
          status: VerificationStatus.DISPUTED,
          finding_ids: ["find-001", "find-002"],
          meter_ids: [
            "mmmm0000-0001-4000-8000-000000000000",
            "mmmm0000-000a-4000-8000-000000000000",
          ],
          actual_factors: {
            cooling_degree_days: 196,
            occupancy_index: 1.03,
            floor_area_sqm: 42000,
          },
          // The adjustment runs the other way in May: the month was
          // hotter than the baseline average, so the adjusted baseline
          // rises and the claim is larger than a naive one would be.
          // That is exactly the case a client pushes back on, and it is
          // seeded disputed to prove a disputed claim never reaches a bill.
          raw_baseline_kwh: 97300,
          adjusted_baseline_kwh: 106178,
          actual_kwh: 92380,
          saved_kwh: 13798,
          saved_amount: 117283,
          signed_by: "550e8400-00f2-4000-8000-0000000000f2",
          signed_on: "2026-06-03",
          accepted_by: null,
          accepted_on: null,
          dispute_reason:
            "Two lecture blocks were closed for exams in May; we do not accept the occupancy index of 1.03 for this period.",
          disputed_on: "2026-06-08",
        },
        {
          verification_id: "ver-003",
          period: "2026-06",
          status: VerificationStatus.AUDITOR_SIGNED,
          finding_ids: ["find-001", "find-002"],
          meter_ids: [
            "mmmm0000-0001-4000-8000-000000000000",
            "mmmm0000-000a-4000-8000-000000000000",
          ],
          actual_factors: {
            cooling_degree_days: 170,
            occupancy_index: 1.03,
            floor_area_sqm: 42000,
          },
          raw_baseline_kwh: 97300,
          adjusted_baseline_kwh: 92093,
          actual_kwh: 82482,
          saved_kwh: 9611,
          saved_amount: 81694,
          signed_by: "550e8400-00f2-4000-8000-0000000000f2",
          signed_on: "2026-07-02",
          // Signed but not accepted, so it is worth nothing on an invoice
          // until the client agrees. This is the Account Officer's worklist.
          accepted_by: null,
          accepted_on: null,
          dispute_reason: null,
          disputed_on: null,
        },
      ],
      recommended_plan_id: "plan-professional",
      projected_annual_saving: 2310000,
      summary:
        "Well instrumented estate with no control strategy behind the instrumentation. Chiller sequencing and the Building 1 lighting retrofit pay back inside eighteen months; solar is sound but long-dated.",
    },
    {
      audit_id: "audit-002",
      organization_id: "org-002",
      auditor_id: "550e8400-00f2-4000-8000-0000000000f2",
      status: AuditStatus.APPROVED,
      scheduled_on: "2026-01-15",
      conducted_on: "2026-01-22",
      approved_on: "2026-02-05",
      survey: {
        buildings_surveyed: 1,
        meters_found: 1,
        data_source_tier: DataSourceTier.MANUAL_UPLOAD,
        floor_area_sqm: 68000,
        notes:
          "Single sub-meter for the whole Marine Sciences Block. Readings are uploaded monthly from a spreadsheet; sub-metering is the precondition for anything else.",
      },
      baseline: {
        period_from: "2025-03",
        period_to: "2025-08",
        locked: true,
        locked_on: "2026-02-05",
        locked_by: "550e8400-00f2-4000-8000-0000000000f2",
        baseline_kwh: 76450,
        baseline_water_kl: 2600,
        baseline_cost: 703340,
        baseline_co2_kg: 62689,
        factors: {
          cooling_degree_days: 185,
          occupancy_index: 1.0,
          floor_area_sqm: 68000,
        },
      },
      findings: [
        {
          finding_id: "find-011",
          title: "Sub-meter the four wings of the Marine Sciences Block",
          category: "Metering",
          severity: FindingSeverity.HIGH,
          est_annual_saving: 0,
          capex: 480000,
          payback_months: 0,
          status: FindingStatus.PROPOSED,
          implemented_on: null,
          building_ids: ["660e8800-0f02-4000-8000-000000000000"],
        },
      ],
      // Nothing implemented, so nothing verifiable and no share to bill.
      // The engine has to produce a clean subscription-only invoice here.
      verifications: [],
      recommended_plan_id: "plan-essential",
      projected_annual_saving: 0,
      summary:
        "Cannot recommend savings measures against a single whole-block meter. Sub-metering first, then re-baseline after two quarters of clean data.",
    },
    {
      audit_id: "audit-003",
      organization_id: "org-003",
      auditor_id: "550e8400-00f2-4000-8000-0000000000f2",
      status: AuditStatus.IN_PROGRESS,
      scheduled_on: "2026-08-24",
      conducted_on: "2026-08-27",
      approved_on: null,
      survey: {
        buildings_surveyed: 0,
        meters_found: 0,
        data_source_tier: null,
        floor_area_sqm: null,
        notes: null,
      },
      // No baseline, and none is possible: a site with no metering has no
      // readings to establish one from, and the API refuses to invent a
      // figure rather than letting an auditor type one in. Metering is the
      // first finding on an engagement like this.
      baseline: null,
      findings: [],
      verifications: [],
      recommended_plan_id: null,
      projected_annual_saving: 0,
      summary: null,
    },
    {
      // The engagement the auditor dashboard is meant to be worked through
      // end to end: metered and reporting, surveyed, but not yet baselined.
      // Survey → suggest baseline from readings → lock → add findings →
      // submit for approval.
      audit_id: "audit-004",
      organization_id: "org-004",
      auditor_id: "550e8400-00f2-4000-8000-0000000000f2",
      status: AuditStatus.IN_PROGRESS,
      scheduled_on: "2026-08-10",
      conducted_on: "2026-08-18",
      approved_on: null,
      survey: {
        buildings_surveyed: 2,
        meters_found: 3,
        data_source_tier: DataSourceTier.MANUAL_UPLOAD,
        floor_area_sqm: 24000,
        notes:
          "Workshop extraction runs continuously regardless of occupancy. Library HVAC has no setback schedule outside term time.",
      },
      baseline: null,
      findings: [],
      verifications: [],
      recommended_plan_id: null,
      projected_annual_saving: 0,
      summary: null,
    },
  ];

  /**
   * What EnerTrack has billed so far. Again: this is not Invoice, which
   * is the client's electricity bill from their utility.
   *
   * Every line carries the record it came from in source_ref, so any
   * figure on a bill can be traced back to the meter count or the
   * verification that produced it.
   */
  public platformInvoices: PlatformInvoice[] = [
    {
      platform_invoice_id: "pinv-001",
      organization_id: "org-001",
      subscription_id: "sub-001",
      period: "2026-04",
      line_items: [
        {
          type: InvoiceLineType.SUBSCRIPTION,
          description: "Professional — monitoring subscription, 9 metered points",
          quantity: 9,
          unit_price: 3500,
          amount: 31500,
          source_ref: "sub-001",
        },
        {
          type: InvoiceLineType.PERFORMANCE_SHARE,
          description:
            "Performance share, 15% of verified savings (9,611 kWh, weather-adjusted)",
          quantity: 1,
          unit_price: 12254,
          amount: 12254,
          source_ref: "ver-001",
        },
      ],
      subtotal: 43754,
      tax_pct: 18,
      tax_amount: 7876,
      total: 51630,
      status: PlatformInvoiceStatus.PAID,
      issued_on: "2026-05-10",
      due_on: "2026-06-09",
      paid_on: "2026-05-28",
    },
    {
      platform_invoice_id: "pinv-002",
      organization_id: "org-001",
      subscription_id: "sub-001",
      period: "2026-05",
      // The May verification is disputed, so no performance-share line.
      // Subscription still bills: the service was delivered either way.
      line_items: [
        {
          type: InvoiceLineType.SUBSCRIPTION,
          description: "Professional — monitoring subscription, 9 metered points",
          quantity: 9,
          unit_price: 3500,
          amount: 31500,
          source_ref: "sub-001",
        },
      ],
      subtotal: 31500,
      tax_pct: 18,
      tax_amount: 5670,
      total: 37170,
      status: PlatformInvoiceStatus.PAID,
      issued_on: "2026-06-10",
      due_on: "2026-07-10",
      paid_on: "2026-06-24",
    },
    {
      platform_invoice_id: "pinv-003",
      organization_id: "org-001",
      subscription_id: "sub-001",
      period: "2026-06",
      // June is signed but not yet accepted, so it is not billable either.
      line_items: [
        {
          type: InvoiceLineType.SUBSCRIPTION,
          description: "Professional — monitoring subscription, 9 metered points",
          quantity: 9,
          unit_price: 3500,
          amount: 31500,
          source_ref: "sub-001",
        },
      ],
      subtotal: 31500,
      tax_pct: 18,
      tax_amount: 5670,
      total: 37170,
      status: PlatformInvoiceStatus.OVERDUE,
      issued_on: "2026-07-10",
      due_on: "2026-08-09",
      paid_on: null,
    },
    {
      platform_invoice_id: "pinv-011",
      organization_id: "org-002",
      subscription_id: "sub-002",
      period: "2026-05",
      // One live meter at 1,800 would be 1,800; the plan floor is what
      // actually bills. The small end of the catalogue, working.
      line_items: [
        {
          type: InvoiceLineType.SUBSCRIPTION,
          description: "Essential — monitoring subscription, minimum monthly fee",
          quantity: 1,
          unit_price: 15000,
          amount: 15000,
          source_ref: "sub-002",
        },
      ],
      subtotal: 15000,
      tax_pct: 18,
      tax_amount: 2700,
      total: 17700,
      status: PlatformInvoiceStatus.PAID,
      issued_on: "2026-06-10",
      due_on: "2026-07-10",
      paid_on: "2026-07-02",
    },
    {
      platform_invoice_id: "pinv-012",
      organization_id: "org-002",
      subscription_id: "sub-002",
      period: "2026-06",
      line_items: [
        {
          type: InvoiceLineType.SUBSCRIPTION,
          description: "Essential — monitoring subscription, minimum monthly fee",
          quantity: 1,
          unit_price: 15000,
          amount: 15000,
          source_ref: "sub-002",
        },
      ],
      subtotal: 15000,
      tax_pct: 18,
      tax_amount: 2700,
      total: 17700,
      status: PlatformInvoiceStatus.ISSUED,
      issued_on: "2026-07-10",
      due_on: "2026-08-09",
      paid_on: null,
    },
  ];

  /**
   * The generated monthly electricity series is appended here rather than
   * declared inline, because field initialisers run in declaration order
   * and meterReadings is declared well above this point. By the time the
   * constructor body runs every seed array exists, so the generated rows
   * simply extend the hand-written ones.
   */
  constructor() {
    this.meterReadings.push(...buildMonthlyElectricityReadings());
  }
}

