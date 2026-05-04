# EnerTrack: Backend LLM Context & Schema Reference

**Role & Context:**
You are an expert NestJS & TypeORM backend developer. You are building the backend for **EnerTrack**, a facility management, sustainability, and financial tracking platform. 

The frontend UI is already built and relies on a heavily optimized 19-table schema. Your job is to implement the backend APIs, DTOs, and TypeORM entities that strictly align with this schema. **Do not create any additional tables or complex joins that deviate from this document.**

---

## Architectural Guidelines for the LLM

1. **UUID Primary Keys:** All `_id` fields (Primary Keys and Foreign Keys) must be strings generated as `UUID`s.
2. **Weak Entities as JSON:** To optimize database reads, several weak entities (like `messages`, `outcomes`, and `details`) have been merged into JSON columns within their parent tables. Use `@Column('jsonb')` in TypeORM to handle these.
3. **Enum Constraints:** Several `VARCHAR` columns have strict expected values. You must use TypeScript `enum`s and apply them using `@Column({ type: 'enum', enum: YourEnum })`.
4. **Dates:** Use `@CreateDateColumn()` and `@UpdateDateColumn()` for timestamps.

---

## Domain-Driven Schema (19 Tables)

### Domain A: Identity & Access

**1. User**
- `user_id` (PK, UUID)
- `name` (VARCHAR, NOT NULL)
- `email` (VARCHAR, UNIQUE, NOT NULL)
- `phone` (VARCHAR, UNIQUE, NULLABLE)
- `password` (VARCHAR, NOT NULL) - *Must be hashed.*
- `role` (VARCHAR, Enum) - *'System Administrator', 'Financial Analyst', 'Technician', 'Sustainability Officer', 'Campus Visitor'*
- `specialization` (VARCHAR, NULLABLE) - *Only populated for Technicians.*

**2. Notification**
- `notification_id` (PK, UUID)
- `user_id` (FK -> User, UUID)
- `target_type` (VARCHAR, Enum) - *'wastage', 'alert', 'request'*
- `target_id` (VARCHAR) - *Pointer to the target entity ID.*
- `message` (TEXT, NOT NULL)
- `is_read` (BOOLEAN, DEFAULT false)

### Domain B: Location & IoT Config

**3. Campus**
- `campus_id` (PK, UUID)
- `name` (VARCHAR)
- `location` (VARCHAR, NULLABLE)
- `total_budget` (DECIMAL 12,2)

**4. Building**
- `building_id` (PK, UUID)
- `campus_id` (FK -> Campus, UUID)
- `name` (VARCHAR)
- `budget` (DECIMAL 12,2, NULLABLE)

**5. Department**
- `department_id` (PK, UUID)
- `building_id` (FK -> Building, UUID)
- `name` (VARCHAR)
- `budget` (DECIMAL 12,2, NULLABLE)

**6. Meter** (Managed by System Admin)
- `meter_id` (PK, UUID)
- `building_id` (FK -> Building, UUID)
- `meter_code` (VARCHAR, UNIQUE)
- `meter_type` (VARCHAR, Enum) - *'electricity', 'gas', 'water', 'emissions', 'food'*
- `zone` (VARCHAR, NULLABLE)
- `status` (VARCHAR, Enum) - *'active', 'faulty', 'calibrating', 'decommissioned'*

### Domain C: Wastage Workflow

**7. WastageReport**
- `wastage_report_id` (PK, UUID)
- `reporter_id` (FK -> User, UUID)
- `type` (VARCHAR, Enum) - *'Energy', 'Water', 'Food'*
- `status` (VARCHAR, DEFAULT 'reported')
- `details` (JSONB) - *Stores contextual data about the wastage.*
- `sensor_reading_id` (FK -> MeterReading, NULLABLE)

**8. MeterReading**
- `reading_id` (PK, UUID)
- `meter_id` (FK -> Meter, UUID)
- `value` (DECIMAL 10,3)
- `unit` (VARCHAR 20)
- `timestamp` (TIMESTAMP, DEFAULT NOW)

### Domain D: Maintenance Workflow

**9. Alert**
- `alert_id` (PK, UUID)
- `meter_id` (FK -> Meter, UUID)
- `triggering_reading_id` (FK -> MeterReading, NULLABLE)
- `title` (VARCHAR)
- `severity` (VARCHAR)
- `status` (VARCHAR, Enum) - *'open', 'acknowledged', 'resolved'*
- `messages` (JSONB) - *Stores an array of message objects for the chat thread.*

**10. Fault**
- `fault_id` (PK, UUID)
- `alert_id` (FK -> Alert, NULLABLE)
- `assigned_to_id` (FK -> User, NULLABLE)
- `asset_name` (VARCHAR)
- `fault_type` (VARCHAR)
- `severity` (VARCHAR, Enum) - *'low', 'moderate', 'high', 'critical'*
- `status` (VARCHAR, Enum) - *'active', 'pending', 'resolved'*

**11. ServiceRequest**
- `service_request_id` (PK, UUID)
- `reporter_id` (FK -> User, UUID)
- `assigned_to_id` (FK -> User, NULLABLE)
- `category` (VARCHAR)
- `issue_type` (VARCHAR)
- `status` (VARCHAR, DEFAULT 'pending')

**12. WorkOrder**
- `work_order_id` (PK, UUID)
- `assigned_to_id` (FK -> User, NULLABLE)
- `linked_fault_id` (FK -> Fault, NULLABLE)
- `source_request_id` (FK -> ServiceRequest, NULLABLE)
- `title` (VARCHAR)
- `priority` (VARCHAR, Enum) - *'immediate', 'high', 'medium', 'low'*
- `status` (VARCHAR, Enum) - *'new', 'inprogress', 'review', 'closed'*

### Domain E: Finance Workflow

**13. EnergyCost**
- `energy_cost_id` (PK, UUID)
- `building_id` (FK -> Building, NULLABLE)
- `department_id` (FK -> Department, NULLABLE)
- `period` (VARCHAR) - *e.g., '2025-03'*
- `electricity` (DECIMAL 12,2)
- `gas` (DECIMAL 12,2)
- `water` (DECIMAL 12,2)
- `status` (VARCHAR, Enum) - *'under-budget', 'on-budget', 'over-budget'*

**14. Invoice**
- `invoice_id` (PK, UUID)
- `department_id` (FK -> Department, UUID)
- `approved_by_id` (FK -> User, NULLABLE)
- `invoice_number` (VARCHAR, UNIQUE)
- `vendor` (VARCHAR)
- `amount` (DECIMAL 12,2)
- `status` (VARCHAR, Enum) - *'pending', 'approved', 'overdue', 'paid'*

**15. FinancialReport**
- `financial_report_id` (PK, UUID)
- `generated_by_id` (FK -> User, UUID)
- `building_id` (FK -> Building, NULLABLE)
- `department_id` (FK -> Department, NULLABLE)
- `title` (VARCHAR)
- `period` (VARCHAR)
- `roi` (VARCHAR, NULLABLE)
- `npv` (DECIMAL 12,2, NULLABLE)

### Domain F: Sustainability & Admin Audit

**16. SustainabilityMetric**
- `sustainability_metric_id` (PK, UUID)
- `period` (VARCHAR)
- `energy_consumed` (DECIMAL 12,2)
- `water_usage` (DECIMAL 12,2)
- `emissions` (DECIMAL 12,2)

**17. Initiative**
- `initiative_id` (PK, UUID)
- `created_by_id` (FK -> User, UUID)
- `title` (VARCHAR)
- `status` (VARCHAR, Enum) - *'proposed', 'in-progress', 'approved', 'completed', 'rejected'*
- `feasible` (BOOLEAN, DEFAULT true)
- `target_reduction` (VARCHAR)
- `outcomes` (JSONB) - *Array of strings.*

**18. ActivityLog**
- `activity_log_id` (PK, UUID)
- `user_id` (FK -> User, NULLABLE)
- `action_type` (VARCHAR)
- `title` (VARCHAR)
- `timestamp` (TIMESTAMP, DEFAULT NOW)

**19. SustainabilityReport** (Report Archiving)
- `report_id` (PK, UUID)
- `generated_by_id` (FK -> User, UUID)
- `title` (VARCHAR)
- `period` (VARCHAR)
- `metrics` (JSONB) - *Stores Key Performance Indicators (Energy Reduction, Waste Diverted, etc.)*
- `generated_at` (TIMESTAMP, DEFAULT NOW)

---

## Entity Relationships

- **1:N** `User` -> `Notification`, `WastageReport`, `ServiceRequest`, `WorkOrder`, `Invoice` (Approver), `FinancialReport`, `Initiative`, `ActivityLog`, `SustainabilityReport`
- **1:N** `Campus` -> `Building`
- **1:N** `Building` -> `Department`, `Meter`, `EnergyCost`, `FinancialReport`
- **1:N** `Department` -> `EnergyCost`, `Invoice`, `FinancialReport`
- **1:N** `Meter` -> `MeterReading`, `Alert`
- **1:N** `MeterReading` -> `WastageReport` (Baseline context), `Alert` (Trigger)
- **1:N** `Alert` -> `Fault`
- **1:N** `Fault` -> `WorkOrder`
- **1:N** `ServiceRequest` -> `WorkOrder`
