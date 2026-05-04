export declare enum UserRole {
    SYSTEM_ADMINISTRATOR = "System Administrator",
    FINANCIAL_ANALYST = "Financial Analyst",
    TECHNICIAN = "Technician",
    SUSTAINABILITY_OFFICER = "Sustainability Officer",
    CAMPUS_VISITOR = "Campus Visitor"
}
export declare enum NotificationTargetType {
    WASTAGE = "wastage",
    ALERT = "alert",
    REQUEST = "request"
}
export declare enum MeterType {
    ELECTRICITY = "electricity",
    GAS = "gas",
    WATER = "water",
    EMISSIONS = "emissions",
    FOOD = "food"
}
export declare enum MeterStatus {
    ACTIVE = "active",
    FAULTY = "faulty",
    CALIBRATING = "calibrating",
    DECOMMISSIONED = "decommissioned"
}
export declare enum WastageType {
    ENERGY = "Energy",
    WATER = "Water",
    FOOD = "Food"
}
export declare enum AlertStatus {
    OPEN = "open",
    ACKNOWLEDGED = "acknowledged",
    RESOLVED = "resolved"
}
export declare enum FaultSeverity {
    LOW = "low",
    MODERATE = "moderate",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum FaultStatus {
    ACTIVE = "active",
    PENDING = "pending",
    RESOLVED = "resolved"
}
export declare enum WorkOrderPriority {
    IMMEDIATE = "immediate",
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low"
}
export declare enum WorkOrderStatus {
    NEW = "new",
    INPROGRESS = "inprogress",
    REVIEW = "review",
    CLOSED = "closed"
}
export declare enum EnergyCostStatus {
    UNDER_BUDGET = "under-budget",
    ON_BUDGET = "on-budget",
    OVER_BUDGET = "over-budget"
}
export declare enum InvoiceStatus {
    PENDING = "pending",
    APPROVED = "approved",
    OVERDUE = "overdue",
    PAID = "paid"
}
export declare enum InitiativeStatus {
    PROPOSED = "proposed",
    IN_PROGRESS = "in-progress",
    APPROVED = "approved",
    COMPLETED = "completed",
    REJECTED = "rejected"
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
export declare class DatabaseService {
    users: User[];
    notifications: Notification[];
    campus: Campus[];
    buildings: Building[];
    departments: Department[];
    meters: Meter[];
    meterReadings: MeterReading[];
    wastageReports: WastageReport[];
    alerts: Alert[];
    faults: Fault[];
    serviceRequests: ServiceRequest[];
    workOrders: WorkOrder[];
    energyCosts: EnergyCost[];
    invoices: Invoice[];
    financialReports: FinancialReport[];
    sustainabilityMetrics: SustainabilityMetric[];
    initiatives: Initiative[];
    activityLogs: ActivityLog[];
    sustainabilityReports: SustainabilityReport[];
}
