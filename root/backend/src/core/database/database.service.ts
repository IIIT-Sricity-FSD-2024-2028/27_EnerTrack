import { Injectable, Scope } from "@nestjs/common";

export enum UserRole {
  SYSTEM_ADMINISTRATOR = "System Administrator",
  FINANCIAL_ANALYST = "Financial Analyst",
  TECHNICIAN = "Technician",
  SUSTAINABILITY_OFFICER = "Sustainability Officer",
  CAMPUS_VISITOR = "Campus Visitor",
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

export interface User {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  password: string;
  role: UserRole;
  specialization: string | null;
}
export interface Campus {
  campus_id: string;
  name: string;
  location: string | null;
  total_budget: number;
}
export interface Building {
  building_id: string;
  campus_id: string;
  name: string;
  budget: number | null;
}
export interface Department {
  department_id: string;
  building_id: string;
  name: string;
  budget: number | null;
}
export interface Meter {
  meter_id: string;
  building_id: string;
  meter_code: string;
  meter_type: MeterType;
  zone: string | null;
  status: MeterStatus;
}
export interface MeterReading {
  reading_id: string;
  meter_id: string;
  value: number;
  unit: string;
  timestamp: string;
}
export interface WastageReport {
  wastage_report_id: string;
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
  meter_id: string;
  triggering_reading_id: string | null;
  title: string;
  severity: string;
  status: AlertStatus;
  messages: AlertMessage[];
}
export interface Fault {
  fault_id: string;
  alert_id: string | null;
  assigned_to_id: string | null;
  asset_name: string;
  fault_type: string;
  severity: FaultSeverity;
  status: FaultStatus;
}
export interface ServiceRequest {
  service_request_id: string;
  reporter_id: string;
  assigned_to_id: string | null;
  category: string;
  issue_type: string;
  status: string;
}
export interface WorkOrder {
  work_order_id: string;
  assigned_to_id: string | null;
  linked_fault_id: string | null;
  source_request_id: string | null;
  title: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
}
export interface EnergyCost {
  energy_cost_id: string;
  building_id: string | null;
  department_id: string | null;
  period: string;
  electricity: number;
  gas: number;
  water: number;
  status: EnergyCostStatus;
}
export interface Invoice {
  invoice_id: string;
  department_id: string;
  approved_by_id: string | null;
  invoice_number: string;
  vendor: string;
  amount: number;
  status: InvoiceStatus;
}
export interface FinancialReport {
  financial_report_id: string;
  generated_by_id: string;
  building_id: string | null;
  department_id: string | null;
  title: string;
  period: string;
  roi: string | null;
  npv: number | null;
}
export interface SustainabilityMetric {
  sustainability_metric_id: string;
  period: string;
  energy_consumed: number;
  water_usage: number;
  emissions: number;
}
export interface Initiative {
  initiative_id: string;
  created_by_id: string;
  title: string;
  status: InitiativeStatus;
  feasible: boolean;
  target_reduction: string;
  outcomes: string[];
}
export interface ActivityLog {
  activity_log_id: string;
  user_id: string | null;
  action_type: string;
  title: string;
  timestamp: string;
}
export interface SustainabilityReport {
  report_id: string;
  generated_by_id: string;
  title: string;
  period: string;
  metrics: Record<string, any>;
  generated_at: string;
}
export interface Notification {
  notification_id: string;
  user_id: string;
  target_type: NotificationTargetType;
  target_id: string;
  message: string;
  is_read: boolean;
}

@Injectable({ scope: Scope.DEFAULT })
export class DatabaseService {
  public users: User[] = [
    {
      user_id: "uuuu0000-0001-4000-8000-000000000000",
      name: "User 1",
      email: "user1@enertrack.com",
      phone: "555-0101",
      password: "hashedpassword",
      role: UserRole.SYSTEM_ADMINISTRATOR,
      specialization: null,
    },
    {
      user_id: "uuuu0000-0002-4000-8000-000000000000",
      name: "User 2",
      email: "user2@enertrack.com",
      phone: "555-0102",
      password: "hashedpassword",
      role: UserRole.FINANCIAL_ANALYST,
      specialization: null,
    },
    {
      user_id: "uuuu0000-0003-4000-8000-000000000000",
      name: "User 3",
      email: "user3@enertrack.com",
      phone: "555-0103",
      password: "hashedpassword",
      role: UserRole.TECHNICIAN,
      specialization: "HVAC",
    },
    {
      user_id: "uuuu0000-0004-4000-8000-000000000000",
      name: "User 4",
      email: "user4@enertrack.com",
      phone: "555-0104",
      password: "hashedpassword",
      role: UserRole.TECHNICIAN,
      specialization: "HVAC",
    },
    {
      user_id: "uuuu0000-0005-4000-8000-000000000000",
      name: "User 5",
      email: "user5@enertrack.com",
      phone: "555-0105",
      password: "hashedpassword",
      role: UserRole.SUSTAINABILITY_OFFICER,
      specialization: null,
    },
    {
      user_id: "uuuu0000-0006-4000-8000-000000000000",
      name: "User 6",
      email: "user6@enertrack.com",
      phone: "555-0106",
      password: "hashedpassword",
      role: UserRole.CAMPUS_VISITOR,
      specialization: null,
    },
    {
      user_id: "uuuu0000-0007-4000-8000-000000000000",
      name: "User 7",
      email: "user7@enertrack.com",
      phone: "555-0107",
      password: "hashedpassword",
      role: UserRole.CAMPUS_VISITOR,
      specialization: null,
    },
    {
      user_id: "uuuu0000-0008-4000-8000-000000000000",
      name: "User 8",
      email: "user8@enertrack.com",
      phone: "555-0108",
      password: "hashedpassword",
      role: UserRole.SYSTEM_ADMINISTRATOR,
      specialization: null,
    },
  ];
  public notifications: Notification[] = [
    {
      notification_id: "nnnn0000-0001-4000-8000-000000000000",
      user_id: "uuuu0000-0002-4000-8000-000000000000",
      target_type: NotificationTargetType.ALERT,
      target_id: "target1",
      message: "Notif 1",
      is_read: false,
    },
    {
      notification_id: "nnnn0000-0002-4000-8000-000000000000",
      user_id: "uuuu0000-0003-4000-8000-000000000000",
      target_type: NotificationTargetType.REQUEST,
      target_id: "target2",
      message: "Notif 2",
      is_read: false,
    },
    {
      notification_id: "nnnn0000-0003-4000-8000-000000000000",
      user_id: "uuuu0000-0004-4000-8000-000000000000",
      target_type: NotificationTargetType.WASTAGE,
      target_id: "target3",
      message: "Notif 3",
      is_read: false,
    },
    {
      notification_id: "nnnn0000-0004-4000-8000-000000000000",
      user_id: "uuuu0000-0005-4000-8000-000000000000",
      target_type: NotificationTargetType.ALERT,
      target_id: "target4",
      message: "Notif 4",
      is_read: false,
    },
    {
      notification_id: "nnnn0000-0005-4000-8000-000000000000",
      user_id: "uuuu0000-0006-4000-8000-000000000000",
      target_type: NotificationTargetType.REQUEST,
      target_id: "target5",
      message: "Notif 5",
      is_read: false,
    },
    {
      notification_id: "nnnn0000-0006-4000-8000-000000000000",
      user_id: "uuuu0000-0007-4000-8000-000000000000",
      target_type: NotificationTargetType.WASTAGE,
      target_id: "target6",
      message: "Notif 6",
      is_read: false,
    },
    {
      notification_id: "nnnn0000-0007-4000-8000-000000000000",
      user_id: "uuuu0000-0008-4000-8000-000000000000",
      target_type: NotificationTargetType.ALERT,
      target_id: "target7",
      message: "Notif 7",
      is_read: false,
    },
    {
      notification_id: "nnnn0000-0008-4000-8000-000000000000",
      user_id: "uuuu0000-0001-4000-8000-000000000000",
      target_type: NotificationTargetType.REQUEST,
      target_id: "target8",
      message: "Notif 8",
      is_read: false,
    },
    {
      notification_id: "nnnn0000-0009-4000-8000-000000000000",
      user_id: "uuuu0000-0002-4000-8000-000000000000",
      target_type: NotificationTargetType.WASTAGE,
      target_id: "target9",
      message: "Notif 9",
      is_read: false,
    },
    {
      notification_id: "nnnn0000-000a-4000-8000-000000000000",
      user_id: "uuuu0000-0003-4000-8000-000000000000",
      target_type: NotificationTargetType.ALERT,
      target_id: "target10",
      message: "Notif 10",
      is_read: false,
    },
  ];
  public campus: Campus[] = [
    {
      campus_id: "cccc0000-0001-4000-8000-000000000000",
      name: "Campus 1",
      location: "Location 1",
      total_budget: 1000000,
    },
    {
      campus_id: "cccc0000-0002-4000-8000-000000000000",
      name: "Campus 2",
      location: "Location 2",
      total_budget: 2000000,
    },
  ];
  public buildings: Building[] = [
    {
      building_id: "bbbb0000-0001-4000-8000-000000000000",
      campus_id: "cccc0000-0002-4000-8000-000000000000",
      name: "Building 1",
      budget: 200000,
    },
    {
      building_id: "bbbb0000-0002-4000-8000-000000000000",
      campus_id: "cccc0000-0001-4000-8000-000000000000",
      name: "Building 2",
      budget: 400000,
    },
    {
      building_id: "bbbb0000-0003-4000-8000-000000000000",
      campus_id: "cccc0000-0002-4000-8000-000000000000",
      name: "Building 3",
      budget: 600000,
    },
    {
      building_id: "bbbb0000-0004-4000-8000-000000000000",
      campus_id: "cccc0000-0001-4000-8000-000000000000",
      name: "Building 4",
      budget: 800000,
    },
    {
      building_id: "bbbb0000-0005-4000-8000-000000000000",
      campus_id: "cccc0000-0002-4000-8000-000000000000",
      name: "Building 5",
      budget: 1000000,
    },
  ];
  public departments: Department[] = [
    {
      department_id: "dddd0000-0001-4000-8000-000000000000",
      building_id: "bbbb0000-0002-4000-8000-000000000000",
      name: "Department 1",
      budget: 50000,
    },
    {
      department_id: "dddd0000-0002-4000-8000-000000000000",
      building_id: "bbbb0000-0003-4000-8000-000000000000",
      name: "Department 2",
      budget: 100000,
    },
    {
      department_id: "dddd0000-0003-4000-8000-000000000000",
      building_id: "bbbb0000-0004-4000-8000-000000000000",
      name: "Department 3",
      budget: 150000,
    },
    {
      department_id: "dddd0000-0004-4000-8000-000000000000",
      building_id: "bbbb0000-0005-4000-8000-000000000000",
      name: "Department 4",
      budget: 200000,
    },
    {
      department_id: "dddd0000-0005-4000-8000-000000000000",
      building_id: "bbbb0000-0001-4000-8000-000000000000",
      name: "Department 5",
      budget: 250000,
    },
    {
      department_id: "dddd0000-0006-4000-8000-000000000000",
      building_id: "bbbb0000-0002-4000-8000-000000000000",
      name: "Department 6",
      budget: 300000,
    },
    {
      department_id: "dddd0000-0007-4000-8000-000000000000",
      building_id: "bbbb0000-0003-4000-8000-000000000000",
      name: "Department 7",
      budget: 350000,
    },
    {
      department_id: "dddd0000-0008-4000-8000-000000000000",
      building_id: "bbbb0000-0004-4000-8000-000000000000",
      name: "Department 8",
      budget: 400000,
    },
  ];
  public meters: Meter[] = [
    {
      meter_id: "mmmm0000-0001-4000-8000-000000000000",
      building_id: "bbbb0000-0002-4000-8000-000000000000",
      meter_code: "M-001",
      meter_type: MeterType.ELECTRICITY,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0002-4000-8000-000000000000",
      building_id: "bbbb0000-0003-4000-8000-000000000000",
      meter_code: "M-002",
      meter_type: MeterType.GAS,
      zone: "Zone 3",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0003-4000-8000-000000000000",
      building_id: "bbbb0000-0004-4000-8000-000000000000",
      meter_code: "M-003",
      meter_type: MeterType.WATER,
      zone: "Zone 1",
      status: MeterStatus.FAULTY,
    },
    {
      meter_id: "mmmm0000-0004-4000-8000-000000000000",
      building_id: "bbbb0000-0005-4000-8000-000000000000",
      meter_code: "M-004",
      meter_type: MeterType.EMISSIONS,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0005-4000-8000-000000000000",
      building_id: "bbbb0000-0001-4000-8000-000000000000",
      meter_code: "M-005",
      meter_type: MeterType.FOOD,
      zone: "Zone 3",
      status: MeterStatus.CALIBRATING,
    },
    {
      meter_id: "mmmm0000-0006-4000-8000-000000000000",
      building_id: "bbbb0000-0002-4000-8000-000000000000",
      meter_code: "M-006",
      meter_type: MeterType.ELECTRICITY,
      zone: "Zone 1",
      status: MeterStatus.DECOMMISSIONED,
    },
    {
      meter_id: "mmmm0000-0007-4000-8000-000000000000",
      building_id: "bbbb0000-0003-4000-8000-000000000000",
      meter_code: "M-007",
      meter_type: MeterType.WATER,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0008-4000-8000-000000000000",
      building_id: "bbbb0000-0004-4000-8000-000000000000",
      meter_code: "M-008",
      meter_type: MeterType.GAS,
      zone: "Zone 3",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0009-4000-8000-000000000000",
      building_id: "bbbb0000-0005-4000-8000-000000000000",
      meter_code: "M-009",
      meter_type: MeterType.EMISSIONS,
      zone: "Zone 1",
      status: MeterStatus.FAULTY,
    },
    {
      meter_id: "mmmm0000-000a-4000-8000-000000000000",
      building_id: "bbbb0000-0001-4000-8000-000000000000",
      meter_code: "M-010",
      meter_type: MeterType.ELECTRICITY,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
  ];
  public meterReadings: MeterReading[] = [
    {
      reading_id: "rrrr0000-0001-4000-8000-000000000000",
      meter_id: "mmmm0000-0002-4000-8000-000000000000",
      value: 105.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0002-4000-8000-000000000000",
      meter_id: "mmmm0000-0003-4000-8000-000000000000",
      value: 111.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0003-4000-8000-000000000000",
      meter_id: "mmmm0000-0004-4000-8000-000000000000",
      value: 116.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0004-4000-8000-000000000000",
      meter_id: "mmmm0000-0005-4000-8000-000000000000",
      value: 122.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0005-4000-8000-000000000000",
      meter_id: "mmmm0000-0006-4000-8000-000000000000",
      value: 127.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0006-4000-8000-000000000000",
      meter_id: "mmmm0000-0007-4000-8000-000000000000",
      value: 133.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0007-4000-8000-000000000000",
      meter_id: "mmmm0000-0008-4000-8000-000000000000",
      value: 138.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0008-4000-8000-000000000000",
      meter_id: "mmmm0000-0009-4000-8000-000000000000",
      value: 144.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0009-4000-8000-000000000000",
      meter_id: "mmmm0000-000a-4000-8000-000000000000",
      value: 149.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000a-4000-8000-000000000000",
      meter_id: "mmmm0000-0001-4000-8000-000000000000",
      value: 155.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000b-4000-8000-000000000000",
      meter_id: "mmmm0000-0002-4000-8000-000000000000",
      value: 160.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000c-4000-8000-000000000000",
      meter_id: "mmmm0000-0003-4000-8000-000000000000",
      value: 166.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000d-4000-8000-000000000000",
      meter_id: "mmmm0000-0004-4000-8000-000000000000",
      value: 171.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000e-4000-8000-000000000000",
      meter_id: "mmmm0000-0005-4000-8000-000000000000",
      value: 177.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-000f-4000-8000-000000000000",
      meter_id: "mmmm0000-0006-4000-8000-000000000000",
      value: 182.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0010-4000-8000-000000000000",
      meter_id: "mmmm0000-0007-4000-8000-000000000000",
      value: 188.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0011-4000-8000-000000000000",
      meter_id: "mmmm0000-0008-4000-8000-000000000000",
      value: 193.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0012-4000-8000-000000000000",
      meter_id: "mmmm0000-0009-4000-8000-000000000000",
      value: 199.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0013-4000-8000-000000000000",
      meter_id: "mmmm0000-000a-4000-8000-000000000000",
      value: 204.5,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      reading_id: "rrrr0000-0014-4000-8000-000000000000",
      meter_id: "mmmm0000-0001-4000-8000-000000000000",
      value: 210.0,
      unit: "unit",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
  ];
  public wastageReports: WastageReport[] = [
    {
      wastage_report_id: "wwww0000-0001-4000-8000-000000000000",
      reporter_id: "uuuu0000-0002-4000-8000-000000000000",
      type: WastageType.WATER,
      status: "reported",
      details: { note: "Wastage 1" },
      sensor_reading_id: null,
    },
    {
      wastage_report_id: "wwww0000-0002-4000-8000-000000000000",
      reporter_id: "uuuu0000-0003-4000-8000-000000000000",
      type: WastageType.FOOD,
      status: "reported",
      details: { note: "Wastage 2" },
      sensor_reading_id: "rrrr0000-0003-4000-8000-000000000000",
    },
    {
      wastage_report_id: "wwww0000-0003-4000-8000-000000000000",
      reporter_id: "uuuu0000-0004-4000-8000-000000000000",
      type: WastageType.ENERGY,
      status: "reported",
      details: { note: "Wastage 3" },
      sensor_reading_id: null,
    },
    {
      wastage_report_id: "wwww0000-0004-4000-8000-000000000000",
      reporter_id: "uuuu0000-0005-4000-8000-000000000000",
      type: WastageType.WATER,
      status: "reported",
      details: { note: "Wastage 4" },
      sensor_reading_id: "rrrr0000-0005-4000-8000-000000000000",
    },
    {
      wastage_report_id: "wwww0000-0005-4000-8000-000000000000",
      reporter_id: "uuuu0000-0006-4000-8000-000000000000",
      type: WastageType.FOOD,
      status: "reported",
      details: { note: "Wastage 5" },
      sensor_reading_id: null,
    },
    {
      wastage_report_id: "wwww0000-0006-4000-8000-000000000000",
      reporter_id: "uuuu0000-0007-4000-8000-000000000000",
      type: WastageType.ENERGY,
      status: "reported",
      details: { note: "Wastage 6" },
      sensor_reading_id: "rrrr0000-0007-4000-8000-000000000000",
    },
    {
      wastage_report_id: "wwww0000-0007-4000-8000-000000000000",
      reporter_id: "uuuu0000-0008-4000-8000-000000000000",
      type: WastageType.WATER,
      status: "reported",
      details: { note: "Wastage 7" },
      sensor_reading_id: null,
    },
    {
      wastage_report_id: "wwww0000-0008-4000-8000-000000000000",
      reporter_id: "uuuu0000-0001-4000-8000-000000000000",
      type: WastageType.FOOD,
      status: "reported",
      details: { note: "Wastage 8" },
      sensor_reading_id: "rrrr0000-0009-4000-8000-000000000000",
    },
  ];
  public alerts: Alert[] = [
    {
      alert_id: "aaaa0000-0001-4000-8000-000000000000",
      meter_id: "mmmm0000-0002-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0002-4000-8000-000000000000",
      title: "Alert 1",
      severity: "High",
      status: AlertStatus.OPEN,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Checking",
          timestamp: "2025-01-01T10:00:00.000Z",
        },
        {
          sender_role: "Technician",
          content: "Fixed",
          timestamp: "2025-01-01T11:00:00.000Z",
        },
      ],
    },
    {
      alert_id: "aaaa0000-0002-4000-8000-000000000000",
      meter_id: "mmmm0000-0003-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0003-4000-8000-000000000000",
      title: "Alert 2",
      severity: "High",
      status: AlertStatus.ACKNOWLEDGED,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Checking",
          timestamp: "2025-01-01T10:00:00.000Z",
        },
        {
          sender_role: "Technician",
          content: "Fixed",
          timestamp: "2025-01-01T11:00:00.000Z",
        },
      ],
    },
    {
      alert_id: "aaaa0000-0003-4000-8000-000000000000",
      meter_id: "mmmm0000-0004-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0004-4000-8000-000000000000",
      title: "Alert 3",
      severity: "High",
      status: AlertStatus.RESOLVED,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Checking",
          timestamp: "2025-01-01T10:00:00.000Z",
        },
        {
          sender_role: "Technician",
          content: "Fixed",
          timestamp: "2025-01-01T11:00:00.000Z",
        },
      ],
    },
    {
      alert_id: "aaaa0000-0004-4000-8000-000000000000",
      meter_id: "mmmm0000-0005-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0005-4000-8000-000000000000",
      title: "Alert 4",
      severity: "High",
      status: AlertStatus.OPEN,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Checking",
          timestamp: "2025-01-01T10:00:00.000Z",
        },
        {
          sender_role: "Technician",
          content: "Fixed",
          timestamp: "2025-01-01T11:00:00.000Z",
        },
      ],
    },
    {
      alert_id: "aaaa0000-0005-4000-8000-000000000000",
      meter_id: "mmmm0000-0006-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0006-4000-8000-000000000000",
      title: "Alert 5",
      severity: "High",
      status: AlertStatus.OPEN,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Checking",
          timestamp: "2025-01-01T10:00:00.000Z",
        },
        {
          sender_role: "Technician",
          content: "Fixed",
          timestamp: "2025-01-01T11:00:00.000Z",
        },
      ],
    },
    {
      alert_id: "aaaa0000-0006-4000-8000-000000000000",
      meter_id: "mmmm0000-0007-4000-8000-000000000000",
      triggering_reading_id: "rrrr0000-0007-4000-8000-000000000000",
      title: "Alert 6",
      severity: "High",
      status: AlertStatus.RESOLVED,
      messages: [
        {
          sender_role: "System Administrator",
          content: "Checking",
          timestamp: "2025-01-01T10:00:00.000Z",
        },
        {
          sender_role: "Technician",
          content: "Fixed",
          timestamp: "2025-01-01T11:00:00.000Z",
        },
      ],
    },
  ];
  public faults: Fault[] = [
    {
      fault_id: "ffff0000-0001-4000-8000-000000000000",
      alert_id: null,
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      asset_name: "Asset 1",
      fault_type: "Electrical",
      severity: FaultSeverity.MODERATE,
      status: FaultStatus.PENDING,
    },
    {
      fault_id: "ffff0000-0002-4000-8000-000000000000",
      alert_id: "aaaa0000-0003-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      asset_name: "Asset 2",
      fault_type: "Electrical",
      severity: FaultSeverity.HIGH,
      status: FaultStatus.RESOLVED,
    },
    {
      fault_id: "ffff0000-0003-4000-8000-000000000000",
      alert_id: null,
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      asset_name: "Asset 3",
      fault_type: "Electrical",
      severity: FaultSeverity.CRITICAL,
      status: FaultStatus.ACTIVE,
    },
    {
      fault_id: "ffff0000-0004-4000-8000-000000000000",
      alert_id: "aaaa0000-0005-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      asset_name: "Asset 4",
      fault_type: "Electrical",
      severity: FaultSeverity.LOW,
      status: FaultStatus.PENDING,
    },
    {
      fault_id: "ffff0000-0005-4000-8000-000000000000",
      alert_id: null,
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      asset_name: "Asset 5",
      fault_type: "Electrical",
      severity: FaultSeverity.MODERATE,
      status: FaultStatus.RESOLVED,
    },
    {
      fault_id: "ffff0000-0006-4000-8000-000000000000",
      alert_id: "aaaa0000-0001-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      asset_name: "Asset 6",
      fault_type: "Electrical",
      severity: FaultSeverity.HIGH,
      status: FaultStatus.ACTIVE,
    },
    {
      fault_id: "ffff0000-0007-4000-8000-000000000000",
      alert_id: null,
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      asset_name: "Asset 7",
      fault_type: "Electrical",
      severity: FaultSeverity.CRITICAL,
      status: FaultStatus.PENDING,
    },
  ];
  public serviceRequests: ServiceRequest[] = [
    {
      service_request_id: "ssss0000-0001-4000-8000-000000000000",
      reporter_id: "uuuu0000-0002-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      category: "Maintenance",
      issue_type: "Broken part",
      status: "pending",
    },
    {
      service_request_id: "ssss0000-0002-4000-8000-000000000000",
      reporter_id: "uuuu0000-0003-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      category: "Maintenance",
      issue_type: "Broken part",
      status: "pending",
    },
    {
      service_request_id: "ssss0000-0003-4000-8000-000000000000",
      reporter_id: "uuuu0000-0004-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      category: "Maintenance",
      issue_type: "Broken part",
      status: "pending",
    },
    {
      service_request_id: "ssss0000-0004-4000-8000-000000000000",
      reporter_id: "uuuu0000-0005-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      category: "Maintenance",
      issue_type: "Broken part",
      status: "pending",
    },
    {
      service_request_id: "ssss0000-0005-4000-8000-000000000000",
      reporter_id: "uuuu0000-0006-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      category: "Maintenance",
      issue_type: "Broken part",
      status: "pending",
    },
    {
      service_request_id: "ssss0000-0006-4000-8000-000000000000",
      reporter_id: "uuuu0000-0007-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      category: "Maintenance",
      issue_type: "Broken part",
      status: "pending",
    },
    {
      service_request_id: "ssss0000-0007-4000-8000-000000000000",
      reporter_id: "uuuu0000-0008-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      category: "Maintenance",
      issue_type: "Broken part",
      status: "pending",
    },
    {
      service_request_id: "ssss0000-0008-4000-8000-000000000000",
      reporter_id: "uuuu0000-0001-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      category: "Maintenance",
      issue_type: "Broken part",
      status: "pending",
    },
  ];
  public workOrders: WorkOrder[] = [
    {
      work_order_id: "oooo0000-0001-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      linked_fault_id: null,
      source_request_id: "ssss0000-0002-4000-8000-000000000000",
      title: "Work Order 1",
      priority: WorkOrderPriority.HIGH,
      status: WorkOrderStatus.INPROGRESS,
    },
    {
      work_order_id: "oooo0000-0002-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      linked_fault_id: "ffff0000-0003-4000-8000-000000000000",
      source_request_id: null,
      title: "Work Order 2",
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.REVIEW,
    },
    {
      work_order_id: "oooo0000-0003-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      linked_fault_id: null,
      source_request_id: "ssss0000-0004-4000-8000-000000000000",
      title: "Work Order 3",
      priority: WorkOrderPriority.LOW,
      status: WorkOrderStatus.CLOSED,
    },
    {
      work_order_id: "oooo0000-0004-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      linked_fault_id: "ffff0000-0005-4000-8000-000000000000",
      source_request_id: null,
      title: "Work Order 4",
      priority: WorkOrderPriority.IMMEDIATE,
      status: WorkOrderStatus.NEW,
    },
    {
      work_order_id: "oooo0000-0005-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      linked_fault_id: null,
      source_request_id: "ssss0000-0006-4000-8000-000000000000",
      title: "Work Order 5",
      priority: WorkOrderPriority.HIGH,
      status: WorkOrderStatus.INPROGRESS,
    },
    {
      work_order_id: "oooo0000-0006-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      linked_fault_id: "ffff0000-0007-4000-8000-000000000000",
      source_request_id: null,
      title: "Work Order 6",
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.REVIEW,
    },
    {
      work_order_id: "oooo0000-0007-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      linked_fault_id: null,
      source_request_id: "ssss0000-0008-4000-8000-000000000000",
      title: "Work Order 7",
      priority: WorkOrderPriority.LOW,
      status: WorkOrderStatus.CLOSED,
    },
    {
      work_order_id: "oooo0000-0008-4000-8000-000000000000",
      assigned_to_id: "uuuu0000-0003-4000-8000-000000000000",
      linked_fault_id: "ffff0000-0002-4000-8000-000000000000",
      source_request_id: null,
      title: "Work Order 8",
      priority: WorkOrderPriority.IMMEDIATE,
      status: WorkOrderStatus.NEW,
    },
  ];
  public energyCosts: EnergyCost[] = [
    {
      energy_cost_id: "eeee0000-0001-4000-8000-000000000000",
      building_id: "bbbb0000-0002-4000-8000-000000000000",
      department_id: "dddd0000-0002-4000-8000-000000000000",
      period: "2025-02",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.ON_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0002-4000-8000-000000000000",
      building_id: "bbbb0000-0003-4000-8000-000000000000",
      department_id: "dddd0000-0003-4000-8000-000000000000",
      period: "2025-03",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.OVER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0003-4000-8000-000000000000",
      building_id: "bbbb0000-0004-4000-8000-000000000000",
      department_id: "dddd0000-0004-4000-8000-000000000000",
      period: "2025-01",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.UNDER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0004-4000-8000-000000000000",
      building_id: "bbbb0000-0005-4000-8000-000000000000",
      department_id: "dddd0000-0005-4000-8000-000000000000",
      period: "2025-02",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.ON_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0005-4000-8000-000000000000",
      building_id: "bbbb0000-0001-4000-8000-000000000000",
      department_id: "dddd0000-0006-4000-8000-000000000000",
      period: "2025-03",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.OVER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0006-4000-8000-000000000000",
      building_id: "bbbb0000-0002-4000-8000-000000000000",
      department_id: "dddd0000-0007-4000-8000-000000000000",
      period: "2025-01",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.UNDER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0007-4000-8000-000000000000",
      building_id: "bbbb0000-0003-4000-8000-000000000000",
      department_id: "dddd0000-0008-4000-8000-000000000000",
      period: "2025-02",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.ON_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0008-4000-8000-000000000000",
      building_id: "bbbb0000-0004-4000-8000-000000000000",
      department_id: "dddd0000-0001-4000-8000-000000000000",
      period: "2025-03",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.OVER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-0009-4000-8000-000000000000",
      building_id: "bbbb0000-0005-4000-8000-000000000000",
      department_id: "dddd0000-0002-4000-8000-000000000000",
      period: "2025-01",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.UNDER_BUDGET,
    },
    {
      energy_cost_id: "eeee0000-000a-4000-8000-000000000000",
      building_id: "bbbb0000-0001-4000-8000-000000000000",
      department_id: "dddd0000-0003-4000-8000-000000000000",
      period: "2025-02",
      electricity: 1000.0,
      gas: 200.0,
      water: 150.0,
      status: EnergyCostStatus.ON_BUDGET,
    },
  ];
  public invoices: Invoice[] = [
    {
      invoice_id: "vvvv0000-0001-4000-8000-000000000000",
      department_id: "dddd0000-0002-4000-8000-000000000000",
      approved_by_id: "uuuu0000-0002-4000-8000-000000000000",
      invoice_number: "INV-0001",
      vendor: "Vendor 1",
      amount: 500,
      status: InvoiceStatus.APPROVED,
    },
    {
      invoice_id: "vvvv0000-0002-4000-8000-000000000000",
      department_id: "dddd0000-0003-4000-8000-000000000000",
      approved_by_id: "uuuu0000-0002-4000-8000-000000000000",
      invoice_number: "INV-0002",
      vendor: "Vendor 2",
      amount: 1000,
      status: InvoiceStatus.OVERDUE,
    },
    {
      invoice_id: "vvvv0000-0003-4000-8000-000000000000",
      department_id: "dddd0000-0004-4000-8000-000000000000",
      approved_by_id: "uuuu0000-0002-4000-8000-000000000000",
      invoice_number: "INV-0003",
      vendor: "Vendor 3",
      amount: 1500,
      status: InvoiceStatus.PAID,
    },
    {
      invoice_id: "vvvv0000-0004-4000-8000-000000000000",
      department_id: "dddd0000-0005-4000-8000-000000000000",
      approved_by_id: "uuuu0000-0002-4000-8000-000000000000",
      invoice_number: "INV-0004",
      vendor: "Vendor 4",
      amount: 2000,
      status: InvoiceStatus.PENDING,
    },
    {
      invoice_id: "vvvv0000-0005-4000-8000-000000000000",
      department_id: "dddd0000-0006-4000-8000-000000000000",
      approved_by_id: "uuuu0000-0002-4000-8000-000000000000",
      invoice_number: "INV-0005",
      vendor: "Vendor 5",
      amount: 2500,
      status: InvoiceStatus.APPROVED,
    },
    {
      invoice_id: "vvvv0000-0006-4000-8000-000000000000",
      department_id: "dddd0000-0007-4000-8000-000000000000",
      approved_by_id: "uuuu0000-0002-4000-8000-000000000000",
      invoice_number: "INV-0006",
      vendor: "Vendor 6",
      amount: 3000,
      status: InvoiceStatus.OVERDUE,
    },
    {
      invoice_id: "vvvv0000-0007-4000-8000-000000000000",
      department_id: "dddd0000-0008-4000-8000-000000000000",
      approved_by_id: "uuuu0000-0002-4000-8000-000000000000",
      invoice_number: "INV-0007",
      vendor: "Vendor 7",
      amount: 3500,
      status: InvoiceStatus.PAID,
    },
    {
      invoice_id: "vvvv0000-0008-4000-8000-000000000000",
      department_id: "dddd0000-0001-4000-8000-000000000000",
      approved_by_id: "uuuu0000-0002-4000-8000-000000000000",
      invoice_number: "INV-0008",
      vendor: "Vendor 8",
      amount: 4000,
      status: InvoiceStatus.PENDING,
    },
  ];
  public financialReports: FinancialReport[] = [
    {
      financial_report_id: "pppp0000-0001-4000-8000-000000000000",
      generated_by_id: "uuuu0000-0002-4000-8000-000000000000",
      building_id: "bbbb0000-0002-4000-8000-000000000000",
      department_id: "dddd0000-0002-4000-8000-000000000000",
      title: "Report 1",
      period: "Q1 2025",
      roi: "15%",
      npv: 10000.0,
    },
    {
      financial_report_id: "pppp0000-0002-4000-8000-000000000000",
      generated_by_id: "uuuu0000-0002-4000-8000-000000000000",
      building_id: "bbbb0000-0003-4000-8000-000000000000",
      department_id: "dddd0000-0003-4000-8000-000000000000",
      title: "Report 2",
      period: "Q1 2025",
      roi: "15%",
      npv: 10000.0,
    },
    {
      financial_report_id: "pppp0000-0003-4000-8000-000000000000",
      generated_by_id: "uuuu0000-0002-4000-8000-000000000000",
      building_id: "bbbb0000-0004-4000-8000-000000000000",
      department_id: "dddd0000-0004-4000-8000-000000000000",
      title: "Report 3",
      period: "Q1 2025",
      roi: "15%",
      npv: 10000.0,
    },
    {
      financial_report_id: "pppp0000-0004-4000-8000-000000000000",
      generated_by_id: "uuuu0000-0002-4000-8000-000000000000",
      building_id: "bbbb0000-0005-4000-8000-000000000000",
      department_id: "dddd0000-0005-4000-8000-000000000000",
      title: "Report 4",
      period: "Q1 2025",
      roi: "15%",
      npv: 10000.0,
    },
    {
      financial_report_id: "pppp0000-0005-4000-8000-000000000000",
      generated_by_id: "uuuu0000-0002-4000-8000-000000000000",
      building_id: "bbbb0000-0001-4000-8000-000000000000",
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
      period: "2024-11",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0002-4000-8000-000000000000",
      period: "2024-12",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0003-4000-8000-000000000000",
      period: "2024-10",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0004-4000-8000-000000000000",
      period: "2024-11",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0005-4000-8000-000000000000",
      period: "2024-12",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
    {
      sustainability_metric_id: "kkkk0000-0006-4000-8000-000000000000",
      period: "2024-10",
      energy_consumed: 15000.0,
      water_usage: 2000.0,
      emissions: 500.0,
    },
  ];
  public initiatives: Initiative[] = [
    {
      initiative_id: "iiii0000-0001-4000-8000-000000000000",
      created_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Initiative 1",
      status: InitiativeStatus.PROPOSED,
      feasible: true,
      target_reduction: "10%",
      outcomes: ["Outcome 1"],
    },
    {
      initiative_id: "iiii0000-0002-4000-8000-000000000000",
      created_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Initiative 2",
      status: InitiativeStatus.IN_PROGRESS,
      feasible: true,
      target_reduction: "10%",
      outcomes: ["Outcome 1"],
    },
    {
      initiative_id: "iiii0000-0003-4000-8000-000000000000",
      created_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Initiative 3",
      status: InitiativeStatus.APPROVED,
      feasible: true,
      target_reduction: "10%",
      outcomes: ["Outcome 1"],
    },
    {
      initiative_id: "iiii0000-0004-4000-8000-000000000000",
      created_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Initiative 4",
      status: InitiativeStatus.COMPLETED,
      feasible: true,
      target_reduction: "10%",
      outcomes: ["Outcome 1"],
    },
    {
      initiative_id: "iiii0000-0005-4000-8000-000000000000",
      created_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Initiative 5",
      status: InitiativeStatus.REJECTED,
      feasible: true,
      target_reduction: "10%",
      outcomes: ["Outcome 1"],
    },
    {
      initiative_id: "iiii0000-0006-4000-8000-000000000000",
      created_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Initiative 6",
      status: InitiativeStatus.PROPOSED,
      feasible: true,
      target_reduction: "10%",
      outcomes: ["Outcome 1"],
    },
  ];
  public activityLogs: ActivityLog[] = [
    {
      activity_log_id: "llll0000-0001-4000-8000-000000000000",
      user_id: "uuuu0000-0002-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0002-4000-8000-000000000000",
      user_id: "uuuu0000-0003-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0003-4000-8000-000000000000",
      user_id: "uuuu0000-0004-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0004-4000-8000-000000000000",
      user_id: "uuuu0000-0005-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0005-4000-8000-000000000000",
      user_id: "uuuu0000-0006-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0006-4000-8000-000000000000",
      user_id: "uuuu0000-0007-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0007-4000-8000-000000000000",
      user_id: "uuuu0000-0008-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0008-4000-8000-000000000000",
      user_id: "uuuu0000-0001-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0009-4000-8000-000000000000",
      user_id: "uuuu0000-0002-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-000a-4000-8000-000000000000",
      user_id: "uuuu0000-0003-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-000b-4000-8000-000000000000",
      user_id: "uuuu0000-0004-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-000c-4000-8000-000000000000",
      user_id: "uuuu0000-0005-4000-8000-000000000000",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
  ];
  public sustainabilityReports: SustainabilityReport[] = [
    {
      report_id: "tttt0000-0001-4000-8000-000000000000",
      generated_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Sust. Report 1",
      period: "Q1 2025",
      metrics: {},
      generated_at: "2025-01-01T10:00:00.000Z",
    },
    {
      report_id: "tttt0000-0002-4000-8000-000000000000",
      generated_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Sust. Report 2",
      period: "Q1 2025",
      metrics: {},
      generated_at: "2025-01-01T10:00:00.000Z",
    },
    {
      report_id: "tttt0000-0003-4000-8000-000000000000",
      generated_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Sust. Report 3",
      period: "Q1 2025",
      metrics: {},
      generated_at: "2025-01-01T10:00:00.000Z",
    },
    {
      report_id: "tttt0000-0004-4000-8000-000000000000",
      generated_by_id: "uuuu0000-0005-4000-8000-000000000000",
      title: "Sust. Report 4",
      period: "Q1 2025",
      metrics: {},
      generated_at: "2025-01-01T10:00:00.000Z",
    },
  ];
}
