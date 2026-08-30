import { Injectable, Scope } from "@nestjs/common";

export enum UserRole {
  // ── Legacy roles (still fully supported) ─────────────────
  ORGANIZATION_ADMIN = "Organization Admin",
  FINANCIAL_ANALYST = "Financial Analyst",
  TECHNICIAN = "Technician",
  TECHNICIAN_ADMINISTRATOR = "Technician Administrator",
  SUSTAINABILITY_OFFICER = "Sustainability Officer",
  CAMPUS_VISITOR = "Campus Visitor",

  // ── EnerTrack-side roles (B2B model) ─────────────────────
  SUPER_ADMIN = "Super Admin",
  CERTIFIED_ENERGY_AUDITOR = "Certified Energy Auditor",

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
  [UserRole.SUPER_ADMIN]: [UserRole.ORGANIZATION_ADMIN],
  [UserRole.CERTIFIED_ENERGY_AUDITOR]: [UserRole.TECHNICIAN],
  [UserRole.ECONOMIC_BUYER]: [UserRole.FINANCIAL_ANALYST],
  [UserRole.FACILITY_MANAGER]: [UserRole.TECHNICIAN_ADMINISTRATOR],
  [UserRole.DEPARTMENT_HEAD]: [UserRole.CAMPUS_VISITOR],
};

/** Roles that belong to EnerTrack itself and may work across all tenants. */
export const PLATFORM_SIDE_ROLES: string[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CERTIFIED_ENERGY_AUDITOR,
  // Organization Admin is deliberately absent. It is a *client's* own admin,
  // scoped to one organisation. While it sat here, any Organization Admin
  // record with a null organization_id received the full cross-tenant view,
  // which made the tenant boundary depend on seed data rather than on the role.
];

/**
 * The only roles a visitor may give themselves through public sign-up.
 *
 * An allowlist rather than "anything not in PLATFORM_SIDE_ROLES". A denylist
 * silently opens a hole whenever a role leaves PLATFORM_SIDE_ROLES for an
 * unrelated reason, which is exactly what happened when Organization Admin
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
  PROPOSAL = "proposal",
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
   SUBSCRIPTION MODEL — EnerTrack's own business, not the client's

   The commercial relationship between EnerTrack and a client, in one
   sentence: each tier includes a number of staff seats and a number of
   campuses; go over the seat allowance and you pay per extra seat.

   Read one distinction before anything else. PlatformInvoice is NOT
   Invoice. Invoice (above) is the client's utility bill from their
   electricity supplier — a cost their Financial Analyst manages.
   PlatformInvoice is what EnerTrack charges the client for the service.
   Two money flows, opposite directions; they never share a page.

   Note what is deliberately absent: nothing here charges for savings.
   Savings are reported (see OrganizationsService.savings) because that is
   why a campus buys the product, but they are never invoiced. A number
   that is only reported needs none of the machinery a billed one does.
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

/**
 * The engagement lifecycle, which is also the sales funnel.
 *
 *   scheduled → in-progress → proposed → accepted
 *                                ↕
 *                        changes-requested
 *                                ↓
 *                            declined
 *
 * "proposed" onwards mirrors OrganizationStatus: an organisation is a
 * prospect until a proposal is sent (audited), and active once it is
 * accepted. The two enums are deliberately kept in step.
 */
export enum AuditStatus {
  SCHEDULED = "scheduled",
  IN_PROGRESS = "in-progress",
  PROPOSED = "proposed",
  CHANGES_REQUESTED = "changes-requested",
  ACCEPTED = "accepted",
  DECLINED = "declined",
}

export enum FindingSeverity {
  LOW = "low",
  MODERATE = "moderate",
  HIGH = "high",
}

export enum FindingStatus {
  PROPOSED = "proposed",
  ACCEPTED = "accepted",
  IMPLEMENTED = "implemented",
  REJECTED = "rejected",
}

export enum PlatformInvoiceStatus {
  DRAFT = "draft",
  ISSUED = "issued",
  PAID = "paid",
  OVERDUE = "overdue",
}

export enum InvoiceLineType {
  SUBSCRIPTION = "subscription",
  SEAT_OVERAGE = "seat-overage",
}

/**
 * A tier in EnerTrack's catalogue.
 *
 * The only entity in the system with NO organization_id. It is a global
 * catalogue, identical for every tenant, so scopeToTenant() must never be
 * applied to it — the same exception already made for
 * GET /api/organizations/public.
 *
 * Both limits below are real, which is what makes the tiers genuinely
 * different rather than a feature list that gates nothing:
 *
 *   included_seats  metered — going over bills an overage rather than
 *                   refusing the user, because blocking a hire is hostile
 *   max_campuses    blocked — CampusService refuses past the limit
 *
 * Every pricing knob lives on this row, so adding a tier is a new record
 * and a price change is a PATCH. Neither needs a code change.
 */
export interface SubscriptionPlan {
  plan_id: string;
  name: string;
  tagline: string;
  /** Flat fee covering everything up to the included allowances. */
  base_monthly_fee: number;
  /** Staff accounts included before overage starts. */
  included_seats: number;
  /** Charged per staff account beyond included_seats. */
  price_per_extra_seat: number;
  /** Hard limit on campuses. null means unlimited (Enterprise). */
  max_campuses: number | null;
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
  /** Record-keeping only. It no longer decides anything financial. */
  implemented_on: string | null;
  /** Buildings the measure touches. */
  building_ids: string[];
}

/**
 * What the auditor puts in front of the client: which tier suits the
 * estate they just walked, and what it will cost per month.
 *
 * monthly_estimate is computed by the pricing engine from the tier and the
 * surveyed headcount — never typed — so an auditor cannot quietly discount
 * and the quote is always a figure the billing engine would actually
 * produce. It remains an *estimate*: the first invoice bills the real staff
 * count, which is why the surveyed numbers are stored alongside it.
 */
export interface AuditProposal {
  recommended_plan_id: string;
  /** Staff and campuses as counted during the survey. */
  estimated_staff: number;
  estimated_campuses: number;
  /** What that tier would bill per month at those numbers. */
  monthly_estimate: number;

  /**
   * Who it was sent to. A user id rather than a role: you notify a person,
   * not a job title. It defaults to the organisation's System
   * Administrator, who is the first account created when a prospect is
   * registered and therefore the client's account owner.
   */
  sent_to_user_id: string | null;
  sent_on: string | null;

  /** Set when the client answers, whichever way they answer. */
  responded_on: string | null;
  /** Their concern or suggestion, when they ask for changes. */
  response_note: string | null;
}

export interface AuditSurvey {
  buildings_surveyed: number;
  meters_found: number;
  data_source_tier: DataSourceTier | null;
  floor_area_sqm: number | null;
  notes: string | null;
}

/**
 * A certified auditor's site visit and the recommendations that came out
 * of it. Findings are folded in as a JSON array, matching how
 * Alert.messages and Initiative.outcomes already work in this schema.
 *
 * An audit is a service included in the subscription. It is not billed
 * for, and nothing on it feeds an invoice.
 */
export interface EnergyAudit {
  audit_id: string;
  organization_id: string;
  auditor_id: string;
  status: AuditStatus;
  scheduled_on: string | null;
  conducted_on: string | null;
  survey: AuditSurvey;
  findings: AuditFinding[];
  /** Null until the auditor sends one. */
  proposal: AuditProposal | null;
  summary: string | null;
}

export interface PlatformInvoiceLine {
  type: InvoiceLineType;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  /** Record this line came from, so any figure on a bill is traceable. */
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

/* ── Seed generator ───────────────────────────────────────────────────

   The savings report compares a month against the same month a year
   earlier, so the seed needs at least two years of readings and a visible
   change between them. Writing ~60 literals by hand would bury the rest
   of the seed, so the series is generated — deterministically, with no
   Math.random, so every demo produces the same figures and the numbers
   quoted in the docs stay true.
   ───────────────────────────────────────────────────────────────────── */

/**
 * A seasonal shape for coastal Andhra, indexed by calendar month. Summer
 * cooling load is what drives campus electricity here, so consumption
 * peaks Mar–Jun. Comparing a month against the same month a year earlier
 * cancels this out entirely, which is why the savings report needs no
 * weather model of its own.
 */
const SEASONAL_FACTOR: Record<number, number> = {
  1: 0.76, 2: 0.94, 3: 1.18, 4: 1.48, 5: 1.66, 6: 1.48,
  7: 1.30, 8: 1.24, 9: 1.18, 10: 1.0, 11: 0.88, 12: 0.76,
};

/** Inclusive bounds of the generated monthly series. */
const SERIES_FROM = { year: 2025, month: 1 };
const SERIES_TO = { year: 2026, month: 8 };

/**
 * Meters whose monthly electricity series is generated, and the demand
 * each runs at before the seasonal shape is applied.
 *
 * Only live meters. M-006 sits in the same building as M-001 but is
 * DECOMMISSIONED, and is left out so anything aggregating consumption has
 * to filter on meter status rather than trusting the building alone.
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
 * org-001 implemented its two accepted recommendations at the end of
 * February 2026, cutting demand on the affected meters by 12%. That drop
 * is the whole point of the seed: it is what the savings report surfaces,
 * and therefore what makes the product look worth buying.
 *
 * org-002 and org-004 have implemented nothing, so they show roughly flat
 * year-on-year — which the report has to handle without claiming a win.
 */
const IMPROVEMENT_FROM_PERIOD = "2026-03";
const IMPROVEMENT_FACTOR = 0.88;
const IMPROVED_METER_IDS = [
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

/** One monthly electricity reading per generated meter. */
function buildMonthlyElectricityReadings(): MeterReading[] {
  const readings: MeterReading[] = [];
  for (const meter of GENERATED_SERIES) {
    for (const { year, month, period } of eachSeriesMonth()) {
      const improved =
        period >= IMPROVEMENT_FROM_PERIOD && IMPROVED_METER_IDS.includes(meter.meter_id)
          ? IMPROVEMENT_FACTOR
          : 1;

      readings.push({
        reading_id: `gen-${meter.code}-${period}`,
        organization_id: meter.organization_id,
        meter_id: meter.meter_id,
        value: Math.round(meter.base_kwh * SEASONAL_FACTOR[month] * improved),
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
      status: OrganizationStatus.PROSPECT,
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
      role: UserRole.ORGANIZATION_ADMIN,
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
    // ── The rest of org-001's facilities and energy team ──────────────
    //
    // A university running five blocks and ten metered points does not do
    // it with four people. These bring org-001 to 24 billable staff
    // against a 20-seat Growth allowance, which is what puts a seat
    // overage on its invoice — the case the pricing rule exists for.
    //
    // Campus Visitors are deliberately NOT padded out here: they are the
    // one role that never counts towards a seat.
    {
      user_id: "550e8400-000b-4000-8000-00000000000b",
      organization_id: "org-001",
      name: "Kavya Menon",
      email: "kavya@gmail.com",
      phone: "9876543220",
      password: "Kavya@123",
      role: UserRole.TECHNICIAN_ADMINISTRATOR,
      specialization: "HVAC",
    },
    {
      user_id: "550e8400-000c-4000-8000-00000000000c",
      organization_id: "org-001",
      name: "Arjun Bose",
      email: "arjun.b@gmail.com",
      phone: "9876543221",
      password: "Arjun@123",
      role: UserRole.TECHNICIAN_ADMINISTRATOR,
      specialization: "Electrical",
    },
    {
      user_id: "550e8400-000d-4000-8000-00000000000d",
      organization_id: "org-001",
      name: "Sneha Iyer",
      email: "sneha@gmail.com",
      phone: "9876543222",
      password: "Sneha@123",
      role: UserRole.SUSTAINABILITY_OFFICER,
      specialization: null,
    },
    {
      user_id: "550e8400-000e-4000-8000-00000000000e",
      organization_id: "org-001",
      name: "Rahul Verma",
      email: "rahul@gmail.com",
      phone: "9876543223",
      password: "Rahul@123",
      role: UserRole.SUSTAINABILITY_OFFICER,
      specialization: null,
    },
    {
      user_id: "550e8400-000f-4000-8000-00000000000f",
      organization_id: "org-001",
      name: "Priyanka Shah",
      email: "priyanka@gmail.com",
      phone: "9876543224",
      password: "Priyanka@123",
      role: UserRole.FINANCIAL_ANALYST,
      specialization: null,
    },
    {
      user_id: "550e8400-0010-4000-8000-000000000010",
      organization_id: "org-001",
      name: "Vikram Nair",
      email: "vikram@gmail.com",
      phone: "9876543225",
      password: "Vikram@123",
      role: UserRole.FINANCIAL_ANALYST,
      specialization: null,
    },
    {
      user_id: "550e8400-0011-4000-8000-000000000011",
      organization_id: "org-001",
      name: "Ananya Ghosh",
      email: "ananya@gmail.com",
      phone: "9876543226",
      password: "Ananya@123",
      role: UserRole.ORGANIZATION_ADMIN,
      specialization: null,
    },
    {
      user_id: "550e8400-0012-4000-8000-000000000012",
      organization_id: "org-001",
      name: "Sanjay Kulkarni",
      email: "sanjay@gmail.com",
      phone: "9876543227",
      password: "Sanjay@123",
      role: UserRole.TECHNICIAN,
      specialization: "HVAC",
    },
    {
      user_id: "550e8400-0013-4000-8000-000000000013",
      organization_id: "org-001",
      name: "Meera Pillai",
      email: "meera@gmail.com",
      phone: "9876543228",
      password: "Meera@123",
      role: UserRole.TECHNICIAN,
      specialization: "Electrical",
    },
    {
      user_id: "550e8400-0014-4000-8000-000000000014",
      organization_id: "org-001",
      name: "Imran Sheikh",
      email: "imran@gmail.com",
      phone: "9876543229",
      password: "Imran@123",
      role: UserRole.TECHNICIAN,
      specialization: "Plumbing",
    },
    {
      user_id: "550e8400-0015-4000-8000-000000000015",
      organization_id: "org-001",
      name: "Divya Raman",
      email: "divya.r@gmail.com",
      phone: "9876543230",
      password: "Divya@123",
      role: UserRole.TECHNICIAN,
      specialization: "Solar Installation",
    },
    {
      user_id: "550e8400-0016-4000-8000-000000000016",
      organization_id: "org-001",
      name: "Karthik Rao",
      email: "karthik@gmail.com",
      phone: "9876543231",
      password: "Karthik@123",
      role: UserRole.TECHNICIAN,
      specialization: "General Maintenance",
    },
    {
      user_id: "550e8400-0017-4000-8000-000000000017",
      organization_id: "org-001",
      name: "Fatima Khan",
      email: "fatima@gmail.com",
      phone: "9876543232",
      password: "Fatima@123",
      role: UserRole.TECHNICIAN,
      specialization: "HVAC",
    },
    {
      user_id: "550e8400-0018-4000-8000-000000000018",
      organization_id: "org-001",
      name: "Nikhil Joshi",
      email: "nikhil@gmail.com",
      phone: "9876543233",
      password: "Nikhil@123",
      role: UserRole.TECHNICIAN,
      specialization: "Electrical",
    },
    {
      user_id: "550e8400-0019-4000-8000-000000000019",
      organization_id: "org-001",
      name: "Lakshmi Reddy",
      email: "lakshmi@gmail.com",
      phone: "9876543234",
      password: "Lakshmi@123",
      role: UserRole.TECHNICIAN,
      specialization: "General Maintenance",
    },

    // ── Prospect contacts ─────────────────────────────────────────────
    //
    // A prospect has no dashboards yet, but it does have a person. These are
    // created when the Super Admin registers the organisation, and they are
    // who the auditor's proposal is addressed to. Without them the sales
    // workflow has no recipient.
    {
      user_id: "550e8400-00c1-4000-8000-0000000000c1",
      organization_id: "org-003",
      name: "Ramesh Gupta",
      email: "ramesh@northgatepark.in",
      phone: "9830000001",
      password: "Ramesh@123",
      role: UserRole.ORGANIZATION_ADMIN,
      specialization: null,
    },
    {
      user_id: "550e8400-00c2-4000-8000-0000000000c2",
      organization_id: "org-004",
      name: "Anita Fernandes",
      email: "anita@harbourpoint.edu",
      phone: "9840000001",
      password: "Anita@123",
      role: UserRole.ORGANIZATION_ADMIN,
      specialization: null,
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

    // ── Client-side staff for the second tenant (proves isolation) ──
    //
    // Every organisation's FIRST account is its Organization Admin. They are
    // the client's account owner, they receive the audit proposal, and they
    // are provisioned by a Super Admin rather than self-registered — which is
    // why this role is absent from SELF_REGISTERABLE_ROLES.
    {
      user_id: "550e8400-00b0-4000-8000-0000000000b0",
      organization_id: "org-002",
      name: "Sunita Deshpande",
      email: "sunita@coastalvalley.edu",
      phone: "9820000001",
      password: "Sunita@123",
      role: UserRole.ORGANIZATION_ADMIN,
      specialization: null,
    },
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
          sender_role: "Organization Admin",
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
          sender_role: "Organization Admin",
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
          sender_role: "Organization Admin",
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
          sender_role: "Organization Admin",
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
          sender_role: "Organization Admin",
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
          sender_role: "Organization Admin",
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
     SUBSCRIPTION SEED

     Two live clients, chosen to show both halves of the pricing rule:
     org-001 is over its seat allowance and pays an overage, org-002 is
     under and pays the flat fee.
     ══════════════════════════════════════════════════════════════════ */

  /**
   * The tier catalogue. Global — no organization_id, so scopeToTenant()
   * must never touch it.
   *
   * A price change here is a PATCH from the Super Admin's Pricing Plans
   * tab and takes effect on the next invoice generated. No redeploy.
   */
  public subscriptionPlans: SubscriptionPlan[] = [
    {
      plan_id: "plan-starter",
      name: "Starter",
      tagline: "A single campus getting its consumption under control.",
      base_monthly_fee: 12000,
      included_seats: 5,
      price_per_extra_seat: 1200,
      max_campuses: 1,
      features: [
        "One campus",
        "Consumption dashboards and monthly reporting",
        "Anomaly alerts and fault workflow",
        "Annual site audit by a certified auditor",
      ],
      is_active: true,
    },
    {
      plan_id: "plan-growth",
      name: "Growth",
      tagline: "Multi-campus estates with a dedicated facilities team.",
      base_monthly_fee: 35000,
      included_seats: 20,
      price_per_extra_seat: 1000,
      max_campuses: 3,
      features: [
        "Up to three campuses",
        "Everything in Starter",
        "Sustainability reporting and initiative tracking",
        "Half-yearly site audit",
      ],
      is_active: true,
    },
    {
      plan_id: "plan-enterprise",
      name: "Enterprise",
      tagline: "Large estates with compliance reporting obligations.",
      base_monthly_fee: 90000,
      included_seats: 60,
      price_per_extra_seat: 800,
      max_campuses: null,
      features: [
        "Unlimited campuses",
        "Everything in Growth",
        "BRSR and ESG report packs",
        "Quarterly site audit and review",
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
      plan_id: "plan-growth",
      status: SubscriptionStatus.ACTIVE,
      billing_cycle: BillingCycle.MONTHLY,
      started_on: "2025-01-01",
      renews_on: "2027-01-01",
      cancelled_on: null,
    },
    {
      subscription_id: "sub-002",
      organization_id: "org-002",
      plan_id: "plan-starter",
      status: SubscriptionStatus.ACTIVE,
      billing_cycle: BillingCycle.MONTHLY,
      started_on: "2025-06-01",
      renews_on: "2026-12-01",
      cancelled_on: null,
    },
  ];

  /**
   * Certified auditor engagements.
   *
   * Note what these do NOT contain: no baseline, no savings verification,
   * no link to any invoice. An audit tells the organisation what needs
   * fixing. What it saves is reported separately, from meter readings,
   * and is never billed for.
   */
  public energyAudits: EnergyAudit[] = [
    {
      audit_id: "audit-001",
      organization_id: "org-001",
      auditor_id: "550e8400-00f2-4000-8000-0000000000f2",
      status: AuditStatus.ACCEPTED,
      scheduled_on: "2025-09-05",
      conducted_on: "2025-09-12",
      survey: {
        buildings_surveyed: 5,
        meters_found: 10,
        data_source_tier: DataSourceTier.BMS_INTEGRATION,
        floor_area_sqm: 42000,
        notes:
          "BMS already in place across all five blocks. Chiller plant runs on a fixed schedule with no load feedback; lighting in Buildings 1 and 2 is still fluorescent.",
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
          // Accepted but not done — the outstanding opportunity, and the
          // strongest thing to put in front of them at renewal.
          status: FindingStatus.ACCEPTED,
          implemented_on: null,
          building_ids: [
            "660e8800-0003-4000-8000-000000000000",
            "660e8800-0005-4000-8000-000000000000",
          ],
        },
      ],
      proposal: {
        recommended_plan_id: "plan-growth",
        estimated_staff: 24,
        estimated_campuses: 2,
        monthly_estimate: 39000,
        sent_to_user_id: "550e8400-0001-4000-8000-000000000001",
        sent_on: "2025-09-20",
        responded_on: "2025-09-28",
        response_note: null,
      },
      summary:
        "Well instrumented estate with no control strategy behind the instrumentation. Chiller sequencing and the Building 1 lighting retrofit pay back inside eighteen months; solar is sound but long-dated.",
    },
    {
      audit_id: "audit-002",
      organization_id: "org-002",
      auditor_id: "550e8400-00f2-4000-8000-0000000000f2",
      status: AuditStatus.ACCEPTED,
      scheduled_on: "2026-01-15",
      conducted_on: "2026-01-22",
      survey: {
        buildings_surveyed: 1,
        meters_found: 1,
        data_source_tier: DataSourceTier.MANUAL_UPLOAD,
        floor_area_sqm: 68000,
        notes:
          "Single sub-meter for the whole Marine Sciences Block. Readings are uploaded monthly from a spreadsheet; sub-metering is the precondition for anything else.",
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
      proposal: {
        recommended_plan_id: "plan-starter",
        estimated_staff: 2,
        estimated_campuses: 1,
        monthly_estimate: 12000,
        sent_to_user_id: "550e8400-00b0-4000-8000-0000000000b0",
        sent_on: "2026-02-01",
        responded_on: "2026-02-04",
        response_note: null,
      },
      summary:
        "Cannot recommend savings measures against a single whole-block meter. Sub-metering first, then reassess after two quarters of clean data.",
    },
    {
      audit_id: "audit-003",
      organization_id: "org-003",
      auditor_id: "550e8400-00f2-4000-8000-0000000000f2",
      status: AuditStatus.SCHEDULED,
      scheduled_on: "2026-09-14",
      conducted_on: null,
      survey: {
        buildings_surveyed: 0,
        meters_found: 0,
        data_source_tier: null,
        floor_area_sqm: null,
        notes: null,
      },
      findings: [],
      proposal: null,
      summary: null,
    },
    {
      // The engagement the auditor dashboard is meant to be worked
      // through: surveyed on site, recommendations not yet written up.
      audit_id: "audit-004",
      organization_id: "org-004",
      auditor_id: "550e8400-00f2-4000-8000-0000000000f2",
      status: AuditStatus.IN_PROGRESS,
      scheduled_on: "2026-08-10",
      conducted_on: "2026-08-18",
      survey: {
        buildings_surveyed: 2,
        meters_found: 3,
        data_source_tier: DataSourceTier.MANUAL_UPLOAD,
        floor_area_sqm: 24000,
        notes:
          "Workshop extraction runs continuously regardless of occupancy. Library HVAC has no setback schedule outside term time.",
      },
      findings: [],
      proposal: null,
      summary: null,
    },
  ];

  /**
   * What EnerTrack has billed. Again: not Invoice, which is the client's
   * electricity bill from their utility.
   *
   * org-001 is over its 20-seat allowance and shows the overage line;
   * org-002 is under its 5 and bills the flat fee alone.
   */
  public platformInvoices: PlatformInvoice[] = [
    {
      platform_invoice_id: "pinv-001",
      organization_id: "org-001",
      subscription_id: "sub-001",
      period: "2026-06",
      line_items: [
        {
          type: InvoiceLineType.SUBSCRIPTION,
          description: "Growth — monthly subscription (20 staff seats, 3 campuses)",
          quantity: 1,
          unit_price: 35000,
          amount: 35000,
          source_ref: "sub-001",
        },
        {
          type: InvoiceLineType.SEAT_OVERAGE,
          description: "Additional staff seats (24 staff, 20 included)",
          quantity: 4,
          unit_price: 1000,
          amount: 4000,
          source_ref: "sub-001",
        },
      ],
      subtotal: 39000,
      tax_pct: 18,
      tax_amount: 7020,
      total: 46020,
      status: PlatformInvoiceStatus.PAID,
      issued_on: "2026-07-01",
      due_on: "2026-07-31",
      paid_on: "2026-07-18",
    },
    {
      platform_invoice_id: "pinv-002",
      organization_id: "org-001",
      subscription_id: "sub-001",
      period: "2026-07",
      line_items: [
        {
          type: InvoiceLineType.SUBSCRIPTION,
          description: "Growth — monthly subscription (20 staff seats, 3 campuses)",
          quantity: 1,
          unit_price: 35000,
          amount: 35000,
          source_ref: "sub-001",
        },
        {
          type: InvoiceLineType.SEAT_OVERAGE,
          description: "Additional staff seats (24 staff, 20 included)",
          quantity: 4,
          unit_price: 1000,
          amount: 4000,
          source_ref: "sub-001",
        },
      ],
      subtotal: 39000,
      tax_pct: 18,
      tax_amount: 7020,
      total: 46020,
      status: PlatformInvoiceStatus.OVERDUE,
      issued_on: "2026-08-01",
      due_on: "2026-08-25",
      paid_on: null,
    },
    {
      platform_invoice_id: "pinv-011",
      organization_id: "org-002",
      subscription_id: "sub-002",
      period: "2026-06",
      line_items: [
        {
          type: InvoiceLineType.SUBSCRIPTION,
          description: "Starter — monthly subscription (5 staff seats, 1 campus)",
          quantity: 1,
          unit_price: 12000,
          amount: 12000,
          source_ref: "sub-002",
        },
      ],
      subtotal: 12000,
      tax_pct: 18,
      tax_amount: 2160,
      total: 14160,
      status: PlatformInvoiceStatus.PAID,
      issued_on: "2026-07-01",
      due_on: "2026-07-31",
      paid_on: "2026-07-09",
    },
    {
      platform_invoice_id: "pinv-012",
      organization_id: "org-002",
      subscription_id: "sub-002",
      period: "2026-07",
      line_items: [
        {
          type: InvoiceLineType.SUBSCRIPTION,
          description: "Starter — monthly subscription (5 staff seats, 1 campus)",
          quantity: 1,
          unit_price: 12000,
          amount: 12000,
          source_ref: "sub-002",
        },
      ],
      subtotal: 12000,
      tax_pct: 18,
      tax_amount: 2160,
      total: 14160,
      status: PlatformInvoiceStatus.ISSUED,
      issued_on: "2026-08-01",
      due_on: "2026-08-31",
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
