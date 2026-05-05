import { Injectable, Scope } from "@nestjs/common";

export enum UserRole {
  SYSTEM_ADMINISTRATOR = "System Administrator",
  FINANCIAL_ANALYST = "Financial Analyst",
  TECHNICIAN = "Technician",
  TECHNICIAN_ADMINISTRATOR = "Technician Administrator",
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
  details?: Record<string, any>;
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
  description?: string;
  status: InitiativeStatus;
  feasible: boolean;
  onTrack?: boolean;
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
      user_id: "550e8400-0001-4000-8000-000000000001",
      name: "Aadithya",
      email: "aadi@gmail.com",
      phone: "9876543210",
      password: "Aadi@123",
      role: UserRole.SYSTEM_ADMINISTRATOR,
      specialization: null,
    },
    {
      user_id: "550e8400-0002-4000-8000-000000000002",
      name: "Husaam",
      email: "husaam@gmail.com",
      phone: "9876543211",
      password: "Husaam@123",
      role: UserRole.FINANCIAL_ANALYST,
      specialization: null,
    },
    {
      user_id: "550e8400-0003-4000-8000-000000000003",
      name: "Chirag",
      email: "chirag@gmail.com",
      phone: "9876543212",
      password: "Chirag@123",
      role: UserRole.TECHNICIAN_ADMINISTRATOR,
      specialization: "Electrical",
    },
    {
      user_id: "550e8400-0004-4000-8000-000000000004",
      name: "Teja",
      email: "teja@gmail.com",
      phone: "9876543214",
      password: "Teja@123",
      role: UserRole.TECHNICIAN,
      specialization: "Solar Installation",
    },
    {
      user_id: "550e8400-0005-4000-8000-000000000005",
      name: "Viksa",
      email: "viksa@gmail.com",
      phone: "9876543213",
      password: "Viksa@123",
      role: UserRole.SUSTAINABILITY_OFFICER,
      specialization: null,
    },
    {
      user_id: "550e8400-0006-4000-8000-000000000006",
      name: "Trishank",
      email: "trishank@gmail.com",
      phone: "9876543215",
      password: "Trishank@123",
      role: UserRole.CAMPUS_VISITOR,
      specialization: null,
    },
    {
      user_id: "550e8400-0007-4000-8000-000000000007",
      name: "Elena Park",
      email: "elena@gmail.com",
      phone: "9876543216",
      password: "Elena@123",
      role: UserRole.TECHNICIAN,
      specialization: "Electrical",
    },
    {
      user_id: "550e8400-0008-4000-8000-000000000008",
      name: "Marcus Reed",
      email: "marcus@gmail.com",
      phone: "9876543217",
      password: "Marcus@123",
      role: UserRole.TECHNICIAN,
      specialization: "HVAC",
    },
    {
      user_id: "550e8400-0009-4000-8000-000000000009",
      name: "Noah Smith",
      email: "noah@gmail.com",
      phone: "9876543218",
      password: "Noah@123",
      role: UserRole.TECHNICIAN,
      specialization: "General Maintenance",
    },
    {
      user_id: "550e8400-000a-4000-8000-00000000000a",
      name: "Rina Das",
      email: "rina@gmail.com",
      phone: "9876543219",
      password: "Rina@123",
      role: UserRole.TECHNICIAN,
      specialization: "Plumbing",
    },
  ];
  public notifications: Notification[] = [
    {
      notification_id: "660e8400-0001-4000-8000-000000000000",
      user_id: "550e8400-0002-4000-8000-000000000002",
      target_type: NotificationTargetType.ALERT,
      target_id: "target1",
      message: "Notif 1",
      is_read: false,
    },
    {
      notification_id: "660e8400-0002-4000-8000-000000000000",
      user_id: "550e8400-0003-4000-8000-000000000003",
      target_type: NotificationTargetType.REQUEST,
      target_id: "target2",
      message: "Notif 2",
      is_read: false,
    },
    {
      notification_id: "660e8400-0003-4000-8000-000000000000",
      user_id: "550e8400-0004-4000-8000-000000000004",
      target_type: NotificationTargetType.WASTAGE,
      target_id: "target3",
      message: "Notif 3",
      is_read: false,
    },
    {
      notification_id: "660e8400-0004-4000-8000-000000000000",
      user_id: "550e8400-0005-4000-8000-000000000005",
      target_type: NotificationTargetType.ALERT,
      target_id: "target4",
      message: "Notif 4",
      is_read: false,
    },
    {
      notification_id: "660e8400-0005-4000-8000-000000000000",
      user_id: "550e8400-0006-4000-8000-000000000006",
      target_type: NotificationTargetType.REQUEST,
      target_id: "target5",
      message: "Notif 5",
      is_read: false,
    },
    {
      notification_id: "660e8400-0006-4000-8000-000000000000",
      user_id: "550e8400-0007-4000-8000-000000000007",
      target_type: NotificationTargetType.WASTAGE,
      target_id: "target6",
      message: "Notif 6",
      is_read: false,
    },
    {
      notification_id: "660e8400-0007-4000-8000-000000000000",
      user_id: "550e8400-0008-4000-8000-000000000008",
      target_type: NotificationTargetType.ALERT,
      target_id: "target7",
      message: "Notif 7",
      is_read: false,
    },
    {
      notification_id: "660e8400-0008-4000-8000-000000000000",
      user_id: "550e8400-0001-4000-8000-000000000001",
      target_type: NotificationTargetType.REQUEST,
      target_id: "target8",
      message: "Notif 8",
      is_read: false,
    },
    {
      notification_id: "660e8400-0009-4000-8000-000000000000",
      user_id: "550e8400-0002-4000-8000-000000000002",
      target_type: NotificationTargetType.WASTAGE,
      target_id: "target9",
      message: "Notif 9",
      is_read: false,
    },
    {
      notification_id: "660e8400-000a-4000-8000-000000000000",
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
      name: "Campus 1",
      location: "Location 1",
      total_budget: 1000000,
    },
    {
      campus_id: "660e8700-0002-4000-8000-000000000000",
      name: "Campus 2",
      location: "Location 2",
      total_budget: 2000000,
    },
  ];
  public buildings: Building[] = [
    {
      building_id: "660e8800-0001-4000-8000-000000000000",
      campus_id: "660e8700-0002-4000-8000-000000000000",
      name: "Building 1",
      budget: 200000,
    },
    {
      building_id: "660e8800-0002-4000-8000-000000000000",
      campus_id: "660e8700-0001-4000-8000-000000000000",
      name: "Building 2",
      budget: 400000,
    },
    {
      building_id: "660e8800-0003-4000-8000-000000000000",
      campus_id: "660e8700-0002-4000-8000-000000000000",
      name: "Building 3",
      budget: 600000,
    },
    {
      building_id: "660e8800-0004-4000-8000-000000000000",
      campus_id: "660e8700-0001-4000-8000-000000000000",
      name: "Building 4",
      budget: 800000,
    },
    {
      building_id: "660e8800-0005-4000-8000-000000000000",
      campus_id: "660e8700-0002-4000-8000-000000000000",
      name: "Building 5",
      budget: 1000000,
    },
  ];
  public departments: Department[] = [
    {
      department_id: "dddd0000-0001-4000-8000-000000000000",
      building_id: "660e8800-0002-4000-8000-000000000000",
      name: "Department 1",
      budget: 50000,
    },
    {
      department_id: "dddd0000-0002-4000-8000-000000000000",
      building_id: "660e8800-0003-4000-8000-000000000000",
      name: "Department 2",
      budget: 100000,
    },
    {
      department_id: "dddd0000-0003-4000-8000-000000000000",
      building_id: "660e8800-0004-4000-8000-000000000000",
      name: "Department 3",
      budget: 150000,
    },
    {
      department_id: "dddd0000-0004-4000-8000-000000000000",
      building_id: "660e8800-0005-4000-8000-000000000000",
      name: "Department 4",
      budget: 200000,
    },
    {
      department_id: "dddd0000-0005-4000-8000-000000000000",
      building_id: "660e8800-0001-4000-8000-000000000000",
      name: "Department 5",
      budget: 250000,
    },
    {
      department_id: "dddd0000-0006-4000-8000-000000000000",
      building_id: "660e8800-0002-4000-8000-000000000000",
      name: "Department 6",
      budget: 300000,
    },
    {
      department_id: "dddd0000-0007-4000-8000-000000000000",
      building_id: "660e8800-0003-4000-8000-000000000000",
      name: "Department 7",
      budget: 350000,
    },
    {
      department_id: "dddd0000-0008-4000-8000-000000000000",
      building_id: "660e8800-0004-4000-8000-000000000000",
      name: "Department 8",
      budget: 400000,
    },
  ];
  public meters: Meter[] = [
    {
      meter_id: "mmmm0000-0001-4000-8000-000000000000",
      building_id: "660e8800-0002-4000-8000-000000000000",
      meter_code: "M-001",
      meter_type: MeterType.ELECTRICITY,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0002-4000-8000-000000000000",
      building_id: "660e8800-0003-4000-8000-000000000000",
      meter_code: "M-002",
      meter_type: MeterType.GAS,
      zone: "Zone 3",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0003-4000-8000-000000000000",
      building_id: "660e8800-0004-4000-8000-000000000000",
      meter_code: "M-003",
      meter_type: MeterType.WATER,
      zone: "Zone 1",
      status: MeterStatus.FAULTY,
    },
    {
      meter_id: "mmmm0000-0004-4000-8000-000000000000",
      building_id: "660e8800-0005-4000-8000-000000000000",
      meter_code: "M-004",
      meter_type: MeterType.EMISSIONS,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0005-4000-8000-000000000000",
      building_id: "660e8800-0001-4000-8000-000000000000",
      meter_code: "M-005",
      meter_type: MeterType.FOOD,
      zone: "Zone 3",
      status: MeterStatus.CALIBRATING,
    },
    {
      meter_id: "mmmm0000-0006-4000-8000-000000000000",
      building_id: "660e8800-0002-4000-8000-000000000000",
      meter_code: "M-006",
      meter_type: MeterType.ELECTRICITY,
      zone: "Zone 1",
      status: MeterStatus.DECOMMISSIONED,
    },
    {
      meter_id: "mmmm0000-0007-4000-8000-000000000000",
      building_id: "660e8800-0003-4000-8000-000000000000",
      meter_code: "M-007",
      meter_type: MeterType.WATER,
      zone: "Zone 2",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0008-4000-8000-000000000000",
      building_id: "660e8800-0004-4000-8000-000000000000",
      meter_code: "M-008",
      meter_type: MeterType.GAS,
      zone: "Zone 3",
      status: MeterStatus.ACTIVE,
    },
    {
      meter_id: "mmmm0000-0009-4000-8000-000000000000",
      building_id: "660e8800-0005-4000-8000-000000000000",
      meter_code: "M-009",
      meter_type: MeterType.EMISSIONS,
      zone: "Zone 1",
      status: MeterStatus.FAULTY,
    },
    {
      meter_id: "mmmm0000-000a-4000-8000-000000000000",
      building_id: "660e8800-0001-4000-8000-000000000000",
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
      alert_id: null,
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Chiller Unit C-12",
      fault_type: "Mechanical",
      severity: FaultSeverity.MODERATE,
      status: FaultStatus.PENDING,
    },
    {
      fault_id: "FLT-002",
      alert_id: "ALT-003",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Main Breaker MB-01",
      fault_type: "Electrical",
      severity: FaultSeverity.HIGH,
      status: FaultStatus.RESOLVED,
    },
    {
      fault_id: "FLT-003",
      alert_id: null,
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Solar Inverter INV-5",
      fault_type: "Electronics",
      severity: FaultSeverity.CRITICAL,
      status: FaultStatus.ACTIVE,
    },
    {
      fault_id: "FLT-004",
      alert_id: "ALT-005",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Cooling Tower CT-2",
      fault_type: "Plumbing",
      severity: FaultSeverity.LOW,
      status: FaultStatus.PENDING,
    },
    {
      fault_id: "FLT-005",
      alert_id: null,
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Backup Generator GEN-1",
      fault_type: "Engine",
      severity: FaultSeverity.MODERATE,
      status: FaultStatus.RESOLVED,
    },
    {
      fault_id: "FLT-006",
      alert_id: "ALT-001",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      asset_name: "Lab 4 Main Supply Pipe",
      fault_type: "Plumbing",
      severity: FaultSeverity.HIGH,
      status: FaultStatus.ACTIVE,
    },
    {
      fault_id: "FLT-007",
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
      assigned_to_id: "550e8400-0004-4000-8000-000000000004",
      linked_fault_id: null,
      source_request_id: "660e8500-0002-4000-8000-000000000000",
      title: "HVAC Filter Replacement – Block A",
      priority: WorkOrderPriority.HIGH,
      status: WorkOrderStatus.APPROVAL,
    },
    {
      work_order_id: "660e8600-0002-4000-8000-000000000000",
      assigned_to_id: "550e8400-0004-4000-8000-000000000004",
      linked_fault_id: "FLT-003",
      source_request_id: null,
      title: "Solar Panel Inspection – Roof Level 3",
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.INPROGRESS,
    },
    {
      work_order_id: "660e8600-0003-4000-8000-000000000000",
      assigned_to_id: "550e8400-0004-4000-8000-000000000004",
      linked_fault_id: null,
      source_request_id: "660e8500-0004-4000-8000-000000000000",
      title: "Lighting Circuit Fault – Corridor B2",
      priority: WorkOrderPriority.LOW,
      status: WorkOrderStatus.REVIEW,
    },
    {
      work_order_id: "660e8600-0004-4000-8000-000000000000",
      assigned_to_id: "550e8400-0004-4000-8000-000000000004",
      linked_fault_id: "660e8900-0005-4000-8000-000000000000",
      source_request_id: null,
      title: "Emergency Generator Test – Block D",
      priority: WorkOrderPriority.IMMEDIATE,
      status: WorkOrderStatus.CLOSED,
    },
    {
      work_order_id: "660e8600-0005-4000-8000-000000000000",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      linked_fault_id: null,
      source_request_id: "660e8500-0006-4000-8000-000000000000",
      title: "Electrical Panel Maintenance – Substation 2",
      priority: WorkOrderPriority.HIGH,
      status: WorkOrderStatus.NEW,
    },
    {
      work_order_id: "660e8600-0006-4000-8000-000000000000",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      linked_fault_id: "660e8900-0007-4000-8000-000000000000",
      source_request_id: null,
      title: "Water Pump Overhaul – Basement Level",
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.INPROGRESS,
    },
    {
      work_order_id: "660e8600-0007-4000-8000-000000000000",
      assigned_to_id: "550e8400-0003-4000-8000-000000000003",
      linked_fault_id: null,
      source_request_id: "660e8500-0008-4000-8000-000000000000",
      title: "Fire Suppression System Check – Block C",
      priority: WorkOrderPriority.HIGH,
      status: WorkOrderStatus.REVIEW,
    },
    {
      work_order_id: "660e8600-0008-4000-8000-000000000000",
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
      building_id: "660e8800-0001-4000-8000-000000000000",
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
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0001",
      vendor: "Vendor 1",
      amount: 500,
      status: InvoiceStatus.APPROVED,
    },
    {
      invoice_id: "vvvv0000-0002-4000-8000-000000000000",
      department_id: "dddd0000-0003-4000-8000-000000000000",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0002",
      vendor: "Vendor 2",
      amount: 1000,
      status: InvoiceStatus.OVERDUE,
    },
    {
      invoice_id: "vvvv0000-0003-4000-8000-000000000000",
      department_id: "dddd0000-0004-4000-8000-000000000000",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0003",
      vendor: "Vendor 3",
      amount: 1500,
      status: InvoiceStatus.PAID,
    },
    {
      invoice_id: "vvvv0000-0004-4000-8000-000000000000",
      department_id: "dddd0000-0005-4000-8000-000000000000",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0004",
      vendor: "Vendor 4",
      amount: 2000,
      status: InvoiceStatus.PENDING,
    },
    {
      invoice_id: "vvvv0000-0005-4000-8000-000000000000",
      department_id: "dddd0000-0006-4000-8000-000000000000",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0005",
      vendor: "Vendor 5",
      amount: 2500,
      status: InvoiceStatus.APPROVED,
    },
    {
      invoice_id: "vvvv0000-0006-4000-8000-000000000000",
      department_id: "dddd0000-0007-4000-8000-000000000000",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0006",
      vendor: "Vendor 6",
      amount: 3000,
      status: InvoiceStatus.OVERDUE,
    },
    {
      invoice_id: "vvvv0000-0007-4000-8000-000000000000",
      department_id: "dddd0000-0008-4000-8000-000000000000",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0007",
      vendor: "Vendor 7",
      amount: 3500,
      status: InvoiceStatus.PAID,
    },
    {
      invoice_id: "vvvv0000-0008-4000-8000-000000000000",
      department_id: "dddd0000-0001-4000-8000-000000000000",
      approved_by_id: "550e8400-0002-4000-8000-000000000002",
      invoice_number: "INV-0008",
      vendor: "Vendor 8",
      amount: 4000,
      status: InvoiceStatus.PENDING,
    },
  ];
  public financialReports: FinancialReport[] = [
    {
      financial_report_id: "pppp0000-0001-4000-8000-000000000000",
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
      user_id: "550e8400-0002-4000-8000-000000000002",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0002-4000-8000-000000000000",
      user_id: "550e8400-0003-4000-8000-000000000003",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0003-4000-8000-000000000000",
      user_id: "550e8400-0004-4000-8000-000000000004",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0004-4000-8000-000000000000",
      user_id: "550e8400-0005-4000-8000-000000000005",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0005-4000-8000-000000000000",
      user_id: "550e8400-0006-4000-8000-000000000006",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0006-4000-8000-000000000000",
      user_id: "550e8400-0007-4000-8000-000000000007",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0007-4000-8000-000000000000",
      user_id: "550e8400-0008-4000-8000-000000000008",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0008-4000-8000-000000000000",
      user_id: "550e8400-0001-4000-8000-000000000001",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-0009-4000-8000-000000000000",
      user_id: "550e8400-0002-4000-8000-000000000002",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-000a-4000-8000-000000000000",
      user_id: "550e8400-0003-4000-8000-000000000003",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-000b-4000-8000-000000000000",
      user_id: "550e8400-0004-4000-8000-000000000004",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
    {
      activity_log_id: "llll0000-000c-4000-8000-000000000000",
      user_id: "550e8400-0005-4000-8000-000000000005",
      action_type: "LOGIN",
      title: "User logged in",
      timestamp: "2025-01-01T10:00:00.000Z",
    },
  ];
  public sustainabilityReports: SustainabilityReport[] = [
    {
      report_id: "tttt0000-0001-4000-8000-000000000000",
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
}

