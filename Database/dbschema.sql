--  EnerTrack — Campus Energy & Renewables Management Platform
--  Team 27 | MySQL Schema — FINAL VERSION v3



CREATE DATABASE IF NOT EXISTS EnerTrack;
USE EnerTrack;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS
    workOrder_supplies, Work_Order, Fault, Supplies,
    Report, Report_Request,
    Carbon_result, Carbon_run, Emission_Factor,
    Cost_result, Cost_Run, Utility_Rate,
    Alert, Meter_Readings, Meter, Meter_Type,
    Sustainable_Initiative,
    Department_Building, Department, Building, Campus,
    `User`, Role;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 1. ROLE
-- ============================================================
CREATE TABLE Role (
    role_id          INT            AUTO_INCREMENT PRIMARY KEY,
    Role_name        VARCHAR(100)   NOT NULL UNIQUE,
    permissions_json JSON
);
/*
  CONSTRAINTS EXPLAINED:
  - PRIMARY KEY (role_id): Every role has a unique identifier.
    AUTO_INCREMENT means the DB assigns it automatically.
  
  - NOT NULL UNIQUE (Role_name): Two roles cannot have the same
    name. Prevents creating duplicate "Admin" roles which would
    make access control ambiguous.
  
  - JSON (permissions_json): No constraint — permissions list
    is optional. A role can exist before permissions are defined.
*/

-- ============================================================
-- 2. USER
-- ============================================================
CREATE TABLE `User` (
    UserID       INT            AUTO_INCREMENT PRIMARY KEY,
    User_Name    VARCHAR(100)   NOT NULL,
    Email        VARCHAR(255)   NOT NULL UNIQUE,
    Password     VARCHAR(255)   NOT NULL,
    role_ID      INT            NOT NULL,
    is_active    BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_role
        FOREIGN KEY (role_ID) REFERENCES Role(role_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (User_Name): Every user must have a name.
    A nameless account cannot be displayed on dashboards
    or assignment dropdowns.

  - NOT NULL UNIQUE (Email): Email is the login identifier.
    Duplicate emails would make login non-deterministic —
    the system wouldn't know which account to authenticate.

  - NOT NULL (Password): A user account without a password
    is a security hole. Stored as a bcrypt hash, never plaintext.

  - NOT NULL (role_ID): Every user must have a role.
    The entire access control system depends on this.
    A user with no role would have undefined permissions.

  - DEFAULT TRUE (is_active): New users are active by default.
    Setting to FALSE is a soft-delete — the user is deactivated
    but their FK references in Work_Order, Fault etc. are preserved.

  - DEFAULT CURRENT_TIMESTAMP (created_at): DB sets this
    automatically at insert time, preventing application
    clock skew or forgetting to set it.

  - FK → Role ON DELETE RESTRICT: You cannot delete a Role
    while users are still assigned to it. Deleting "Admin"
    role while 5 admins exist would leave those users roleless,
    breaking access control entirely.

  - ON UPDATE CASCADE: If role_id ever changes, all User
    rows referencing it update automatically.
*/

-- ============================================================
-- 3. CAMPUS
-- ============================================================
CREATE TABLE Campus (
    Campus_ID    INT            AUTO_INCREMENT PRIMARY KEY,
    Campus_name  VARCHAR(150)   NOT NULL,
    city         VARCHAR(100)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (Campus_name): A campus must have a name.
    It appears on every dashboard, report, and dropdown.

  - NULL allowed (city): City is optional metadata.
    The system functions without it.
*/

-- ============================================================
-- 4. BUILDING
-- ============================================================
CREATE TABLE Building (
    Building_ID   INT            AUTO_INCREMENT PRIMARY KEY,
    campus_id     INT            NOT NULL,
    Building_name VARCHAR(150)   NOT NULL,
    code          VARCHAR(50)    UNIQUE,
    CONSTRAINT fk_building_campus
        FOREIGN KEY (campus_id) REFERENCES Campus(Campus_ID)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (campus_id): A building MUST belong to a campus.
    A building with no campus is unlocatable in the system.
    This enforces total participation of Building in Campus.

  - NOT NULL (Building_name): Every building needs a name
    for dashboards and reports.

  - UNIQUE (code): Short codes like "BLK-A" are used as
    human-readable identifiers. Duplicates would make it
    impossible to distinguish buildings by code.

  - FK → Campus ON DELETE RESTRICT: You cannot delete a Campus
    that still has buildings. The campus must be empty first.
    Prevents orphaned buildings with no parent campus.
*/

-- ============================================================
-- 5. DEPARTMENT
-- ============================================================
CREATE TABLE Department (
    Department_ID   INT            AUTO_INCREMENT PRIMARY KEY,
    campus_id       INT            NOT NULL,
    department_Name VARCHAR(150)   NOT NULL,
    CONSTRAINT fk_dept_campus
        FOREIGN KEY (campus_id) REFERENCES Campus(Campus_ID)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (campus_id): Same as Building — a department
    must always belong to a campus.

  - FK → Campus ON DELETE RESTRICT: Cannot delete a campus
    that has departments. Prevents orphaned departments.
*/

-- ============================================================
-- 6. DEPARTMENT_BUILDING (M:N junction)
--    Resolves the many-to-many between Building and Department.
--    A department can span multiple buildings and vice versa.
-- ============================================================
CREATE TABLE Department_Building (
    Department_ID  INT   NOT NULL,
    Building_id    INT   NOT NULL,
    PRIMARY KEY (Department_ID, Building_id),
    CONSTRAINT fk_db_dept
        FOREIGN KEY (Department_ID) REFERENCES Department(Department_ID)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_db_building
        FOREIGN KEY (Building_id) REFERENCES Building(Building_ID)
        ON UPDATE CASCADE ON DELETE CASCADE
);
/*
  CONSTRAINTS EXPLAINED:
  - COMPOSITE PRIMARY KEY (Department_ID, Building_id):
    The combination of both IDs is the unique identifier.
    This prevents the same department-building pair from
    being inserted twice (no duplicate mappings).

  - FK → Department ON DELETE CASCADE: If a department is
    deleted, all its building mappings are automatically removed.
    Junction rows have no meaning without both parents.

  - FK → Building ON DELETE CASCADE: Same logic — if a building
    is deleted, its department mappings are cleaned up automatically.
*/

-- ============================================================
-- 7. METER_TYPE
-- ============================================================
CREATE TABLE Meter_Type (
    type_ID       INT           AUTO_INCREMENT PRIMARY KEY,
    type_name     VARCHAR(100)  NOT NULL,
    resource_type ENUM(
        'electricity',
        'water',
        'gas',
        'solar',
        'wind',
        'other'
    ) NOT NULL,
    unit_default  VARCHAR(30)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (type_name): Every meter type needs a name.

  - ENUM NOT NULL (resource_type): Only predefined resource
    types are allowed. Prevents typos like 'electrcity' or
    'Solar' (case mismatch) from entering the system.
    NULL not allowed — every type must classify a resource.

  - NULL allowed (unit_default): Some custom types may not
    have a standard unit yet.
*/

-- ============================================================
-- 8. METER
-- ============================================================
CREATE TABLE Meter (
    meter_ID      INT           AUTO_INCREMENT PRIMARY KEY,
    meter_code    VARCHAR(100)  NOT NULL UNIQUE,
    department_ID INT,
    Building_ID   INT,
    campus_ID     INT           NOT NULL,
    type_ID       INT           NOT NULL,
    meter_name    VARCHAR(150),
    status        ENUM('active','inactive','maintenance')
                                NOT NULL DEFAULT 'active',
    CONSTRAINT fk_meter_dept
        FOREIGN KEY (department_ID) REFERENCES Department(Department_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_meter_building
        FOREIGN KEY (Building_ID) REFERENCES Building(Building_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_meter_campus
        FOREIGN KEY (campus_ID) REFERENCES Campus(Campus_ID)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_meter_type
        FOREIGN KEY (type_ID) REFERENCES Meter_Type(type_ID)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL UNIQUE (meter_code): Meters are physical devices
    with unique serial/asset codes. Duplicates would make it
    impossible to identify which physical device a reading
    came from.

  - NULL allowed (department_ID, Building_ID): A meter can
    exist at campus level only, without being assigned to a
    specific building or department. This supports campus-wide
    meters like main grid connection points.

  - NOT NULL (campus_ID): A meter MUST always belong to at
    least a campus. This is the minimum required scope.
    Enforces total participation of Meter in Campus.

  - NOT NULL (type_ID): Every meter must have a type.
    Without it dashboards can't group meters by resource.

  - ENUM DEFAULT 'active' (status): New meters are active
    by default. 'maintenance' allows temporary removal from
    readings without deleting the meter record.

  - FK → Building ON DELETE SET NULL: If a building is removed,
    the meter doesn't get deleted — it just loses its building
    assignment. Historical readings still exist and have value.

  - FK → Campus ON DELETE RESTRICT: Cannot delete a campus
    that still has meters registered to it.

  - FK → Meter_Type ON DELETE RESTRICT: Cannot delete a type
    that meters are still using.
*/

-- ============================================================
-- 9. METER_READINGS
--    Source of truth for ALL energy calculations.
--    baseline_kwh, cost runs, carbon runs all query this table.
-- ============================================================
CREATE TABLE Meter_Readings (
    reading_ID   INT              AUTO_INCREMENT PRIMARY KEY,
    meter_ID     INT              NOT NULL,
    `timestamp`  DATETIME         NOT NULL,
    value        DECIMAL(15,4)    NOT NULL,
    interval_min SMALLINT         NOT NULL DEFAULT 15
                 CHECK (interval_min > 0),
    status       ENUM('valid','estimated','error')
                                  NOT NULL DEFAULT 'valid',
    CONSTRAINT fk_reading_meter
        FOREIGN KEY (meter_ID) REFERENCES Meter(meter_ID)
        ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX idx_readings_meter_time (meter_ID, `timestamp`)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (meter_ID): A reading with no meter is
    meaningless — it can't appear on any dashboard or be
    used in any calculation.

  - NOT NULL (timestamp): A reading with no time cannot
    be placed on a timeline or used in a date-range query.

  - NOT NULL (value): The actual energy reading — cannot
    be NULL or every calculation using it returns NULL,
    silently corrupting all reports.

  - CHECK interval_min > 0: A reading interval of 0 or
    negative minutes is physically impossible. Readings must
    be spaced some positive amount of time apart.

  - DEFAULT 15 (interval_min): 15-minute intervals are the
    industry standard for smart meters.

  - ENUM DEFAULT 'valid' (status): New readings are valid
    by default. 'estimated' flags gaps filled by interpolation.
    'error' flags sensor malfunctions for exclusion.

  - FK → Meter ON DELETE CASCADE: If a meter is permanently
    removed, all its readings are meaningless without it.
    Cascading deletion prevents orphaned readings.

  - COMPOSITE INDEX (meter_ID, timestamp): Most dashboard
    queries filter by meter AND time range simultaneously.
    This index makes those queries dramatically faster.
*/

-- ============================================================
-- 10. ALERT
--     Generated when Meter_Readings breach a threshold.
--     Lifecycle: open → acknowledged → resolved
--     False alarms: resolved directly on Alert via status,
--     no Fault record is created for false alarms.
-- ============================================================
CREATE TABLE Alert (
    Alert_ID        INT           AUTO_INCREMENT PRIMARY KEY,
    Meter_ID        INT           NOT NULL,
    user_id         INT,
    severity        ENUM('low','medium','high','critical') NOT NULL,
    message         TEXT,
    status          ENUM('open','acknowledged','resolved')
                                  NOT NULL DEFAULT 'open',
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at     DATETIME,
    resolution_notes TEXT,
    CONSTRAINT fk_alert_meter
        FOREIGN KEY (Meter_ID) REFERENCES Meter(meter_ID)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_alert_user
        FOREIGN KEY (user_id) REFERENCES `User`(UserID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_alert_resolved_date
        CHECK (resolved_at IS NULL OR resolved_at >= created_at)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (Meter_ID): An alert must always come from
    a specific meter. No meter = no source = meaningless alert.

  - NULL allowed (user_id): When an alert is first generated
    automatically, no technician has acknowledged it yet.
    user_id gets filled when a technician acknowledges it.
    This represents the "acknowledged by" relationship.

  - ENUM NOT NULL (severity): Only predefined severity levels
    allowed. Prevents inconsistent values that break
    colour-coding and filtering on the dashboard.

  - ENUM DEFAULT 'open' (status): Every new alert starts as
    open. Lifecycle: open → acknowledged → resolved.
    False alarms are closed here via status='resolved' +
    resolution_notes, with NO Fault record created.

  - NULL allowed (resolved_at): An open or acknowledged alert
    has no resolution time yet. Only set when status='resolved'.

  - CHECK (resolved_at >= created_at): An alert cannot be
    resolved before it was created. Prevents data entry errors
    where someone accidentally enters a past resolution date.

  - FK → Meter ON DELETE CASCADE: If a meter is deleted, its
    alerts are no longer meaningful and are removed too.

  - FK → User ON DELETE SET NULL: If a user is deactivated,
    the alert record is preserved but the acknowledgement
    reference becomes NULL. Alert history must not be lost.
*/

-- ============================================================
-- 11. FAULT
--     Created ONLY when a technician confirms a real issue.
--     False alarms never create a Fault record — they are
--     resolved directly on the Alert.
--     Every Fault MUST lead to at least one Work_Order.
-- ============================================================
CREATE TABLE Fault (
    fault_id       INT            AUTO_INCREMENT PRIMARY KEY,
    alert_id       INT            NOT NULL UNIQUE,
    user_id        INT            NOT NULL,
    fault_type     VARCHAR(150)   NOT NULL,
    severity       ENUM('low','medium','high','critical') NOT NULL,
    description    TEXT,
    confirmed_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fault_alert
        FOREIGN KEY (alert_id) REFERENCES Alert(Alert_ID)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_fault_user
        FOREIGN KEY (user_id) REFERENCES `User`(UserID)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL UNIQUE (alert_id): One alert can only produce
    one fault investigation. UNIQUE prevents a technician
    from investigating the same alert twice and creating
    duplicate fault records.

  - NOT NULL (user_id): A fault must always have a technician
    who investigated it. No anonymous investigations allowed —
    accountability is required for maintenance auditing.

  - NOT NULL (fault_type): Every confirmed fault must be
    classified. Without classification, work orders can't
    be prioritised correctly.

  - ENUM NOT NULL (severity): Drives Work_Order priority.
    Cannot be NULL or work orders would have no severity basis.

  - FK → Alert ON DELETE RESTRICT: You cannot delete an Alert
    that has a confirmed Fault linked to it. The investigation
    trail must be preserved for auditing.

  - FK → User ON DELETE RESTRICT: You cannot delete a User
    who has confirmed faults. Their investigation records
    must remain traceable.

  NOTE: is_false_alarm was deliberately removed. False alarms
  are handled by Alert.status = 'resolved' + resolution_notes.
  A Fault record only exists for REAL confirmed issues.
*/

-- ============================================================
-- 12. SUPPLIES
-- ============================================================
CREATE TABLE Supplies (
    parts_id     INT           AUTO_INCREMENT PRIMARY KEY,
    supply_name  VARCHAR(150)  NOT NULL,
    category     VARCHAR(100),
    availability INT           NOT NULL DEFAULT 0
                 CHECK (availability >= 0)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (supply_name): Every part must have a name.
    Without it the work order UI can't display what parts
    are being used.

  - CHECK availability >= 0: Stock count can be zero (out
    of stock) but never negative. You can't have -3 circuit
    breakers in stock.

  - DEFAULT 0 (availability): New parts start with zero
    stock until inventory is updated.
*/

-- ============================================================
-- 13. WORK_ORDER
--     Raised ONLY from a confirmed Fault.
--     fault_id NOT NULL enforces the workflow at DB level —
--     a work order CANNOT exist without a fault record.
--     parts_id is NOT on Work_Order — parts are tracked
--     through workOrder_supplies junction table instead.
-- ============================================================
CREATE TABLE Work_Order (
    work_order_id  INT           AUTO_INCREMENT PRIMARY KEY,
    fault_id       INT           NOT NULL,
    user_id        INT           NOT NULL,
    assets_id      INT,
    status         ENUM('open','in_progress','completed','cancelled')
                                 NOT NULL DEFAULT 'open',
    notes          TEXT,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at      DATETIME,
    CONSTRAINT fk_wo_fault
        FOREIGN KEY (fault_id) REFERENCES Fault(fault_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_wo_user
        FOREIGN KEY (user_id) REFERENCES `User`(UserID)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_wo_asset
        FOREIGN KEY (assets_id) REFERENCES Meter(meter_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_wo_closed_date
        CHECK (closed_at IS NULL OR closed_at >= created_at)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (fault_id): A work order MUST come from a
    confirmed fault. This enforces the workflow:
    Alert → Fault → Work_Order.
    You literally cannot insert a work order without a fault.
    This prevents bypassing the investigation step.

  - NOT NULL (user_id): Every work order must have an
    assigned technician. Unassigned work orders would
    never get actioned.

  - NULL allowed (assets_id): Links to the specific meter/
    equipment being repaired. Optional because some work
    orders may be infrastructure-level with no single meter.

  - ENUM DEFAULT 'open' (status): New work orders start open.
    Lifecycle: open → in_progress → completed/cancelled.

  - CHECK (closed_at >= created_at): A work order cannot be
    closed before it was created. Prevents impossible dates.

  - FK → Fault ON DELETE RESTRICT: Cannot delete a Fault
    that has work orders. The repair audit trail must be
    preserved.

  - FK → User ON DELETE RESTRICT: Cannot delete a User
    who has work orders assigned to them. Accountability
    records must remain.

  - FK → Meter ON DELETE SET NULL: If a meter is removed,
    the work order record is preserved but the asset
    reference becomes NULL. Repair history must not be lost.

  NOTE: parts_id was deliberately removed from Work_Order.
  Parts are tracked through workOrder_supplies junction table
  which allows MULTIPLE parts per work order.
*/

-- ============================================================
-- 14. WORKORDER_SUPPLIES (M:N junction)
--     Tracks which parts were consumed in each work order.
-- ============================================================
CREATE TABLE workOrder_supplies (
    parts_id       INT   NOT NULL,
    work_order_id  INT   NOT NULL,
    quantity       INT   NOT NULL DEFAULT 1
                   CHECK (quantity > 0),
    PRIMARY KEY (parts_id, work_order_id),
    CONSTRAINT fk_wos_parts
        FOREIGN KEY (parts_id) REFERENCES Supplies(parts_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_wos_workorder
        FOREIGN KEY (work_order_id) REFERENCES Work_Order(work_order_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
/*
  CONSTRAINTS EXPLAINED:
  - COMPOSITE PRIMARY KEY (parts_id, work_order_id):
    The same part cannot be listed twice for the same
    work order. If you need more of the same part,
    increase the quantity instead.

  - CHECK quantity > 0: You cannot use zero or negative
    parts in a work order. Minimum is 1 unit.

  - DEFAULT 1 (quantity): If quantity isn't specified,
    assume 1 unit was used.

  - FK → Supplies ON DELETE RESTRICT: Cannot delete a
    supply part that has been used in work orders.
    Historical usage records must be preserved.

  - FK → Work_Order ON DELETE CASCADE: If a work order
    is deleted, its supply usage records are also deleted.
    Supply line items only make sense with their parent WO.
*/

-- ============================================================
-- 15. UTILITY_RATE
-- ============================================================
CREATE TABLE Utility_Rate (
    rate_id      INT              AUTO_INCREMENT PRIMARY KEY,
    campus_id    INT,
    rate_per_kwh DECIMAL(10,5)    NOT NULL CHECK (rate_per_kwh > 0),
    valid_from   DATE             NOT NULL,
    valid_to     DATE,
    currency     CHAR(3)          NOT NULL DEFAULT 'INR',
    CONSTRAINT fk_utilrate_campus
        FOREIGN KEY (campus_id) REFERENCES Campus(Campus_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_utilrate_dates
        CHECK (valid_to IS NULL OR valid_to > valid_from)
);
/*
  CONSTRAINTS EXPLAINED:
  - NULL allowed (campus_id): campus_id = NULL means this
    is a global default rate applying to all campuses.
    A campus-specific rate overrides the global one.

  - CHECK rate_per_kwh > 0: A zero or negative electricity
    rate makes no financial sense. Would cause all cost
    calculations to return zero or negative values.

  - NULL allowed (valid_to): valid_to = NULL means this
    rate is currently active with no expiry date.

  - CHECK valid_to > valid_from: A rate validity window
    must be a forward-moving range. A rate that expires
    before it starts is logically impossible.

  - DEFAULT 'INR' (currency): System is deployed in India
    so INR is the sensible default.
*/

-- ============================================================
-- 16. COST_RUN
-- ============================================================
CREATE TABLE Cost_Run (
    cost_run_ID   INT             AUTO_INCREMENT PRIMARY KEY,
    rate_id       INT             NOT NULL,
    building_ID   INT,
    department_ID INT,
    campus_ID     INT,
    user_id       INT             NOT NULL,
    period_start  DATE            NOT NULL,
    period_end    DATE            NOT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rate_per_kwh  DECIMAL(10,5)   NOT NULL CHECK (rate_per_kwh > 0),
    CONSTRAINT fk_costrun_rate
        FOREIGN KEY (rate_id) REFERENCES Utility_Rate(rate_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_costrun_building
        FOREIGN KEY (building_ID) REFERENCES Building(Building_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_costrun_dept
        FOREIGN KEY (department_ID) REFERENCES Department(Department_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_costrun_campus
        FOREIGN KEY (campus_ID) REFERENCES Campus(Campus_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_costrun_user
        FOREIGN KEY (user_id) REFERENCES `User`(UserID)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_costrun_scope
        CHECK (
            building_ID   IS NOT NULL OR
            department_ID IS NOT NULL OR
            campus_ID     IS NOT NULL
        ),
    CONSTRAINT chk_costrun_period
        CHECK (period_end > period_start)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (rate_id): Every cost calculation must use
    a specific rate. Without a rate, cost = 0 always.

  - NULL allowed (building_ID, department_ID, campus_ID):
    Each scope field is individually optional because a run
    might be scoped to just a building OR just a campus.
    The CHECK constraint below ensures at least one is set.

  - NOT NULL (user_id): Every run must be triggered by
    a user for accountability and audit purposes.

  - CHECK chk_costrun_scope: AT LEAST ONE of building_ID,
    department_ID, campus_ID must be NOT NULL.
    This is the critical constraint — a cost run with
    all three NULL would scan the entire database with
    no scope, producing a meaningless total.
    NOTE: Crow's Foot notation cannot express this directly,
    so it must be documented as a note on the ER diagram.

  - CHECK period_end > period_start: A billing period where
    end is before or equal to start is impossible.
    Prevents garbage data like start=June, end=January.

  - rate_per_kwh (denormalised snapshot): Stores the rate
    AT THE TIME of the run. Even if Utility_Rate changes
    later, this historical run's rate is frozen permanently
    for audit purposes.

  - FK → Utility_Rate ON DELETE RESTRICT: Cannot delete
    a rate that was used in calculations. Financial audit
    trail must remain intact.

  - FK → Building/Department/Campus ON DELETE SET NULL:
    If a building is removed, existing cost runs are
    preserved as historical financial data. The FK becomes
    NULL but the record survives.
*/

-- ============================================================
-- 17. COST_RESULT
-- ============================================================
CREATE TABLE Cost_result (
    cost_result_ID INT             AUTO_INCREMENT PRIMARY KEY,
    cost_run_id    INT             NOT NULL UNIQUE,
    total_cost     DECIMAL(15,2)   NOT NULL CHECK (total_cost >= 0),
    total_Kwh      DECIMAL(15,4)   NOT NULL CHECK (total_Kwh >= 0),
    CONSTRAINT fk_costresult_run
        FOREIGN KEY (cost_run_id) REFERENCES Cost_Run(cost_run_ID)
        ON UPDATE CASCADE ON DELETE CASCADE
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL UNIQUE (cost_run_id): Enforces exactly ONE
    result per run. Without UNIQUE you could insert two
    result rows for the same run, doubling all cost totals
    in summary reports.

  - CHECK total_cost >= 0: Cost can be zero (no usage in
    period) but never negative. Negative costs would
    corrupt financial summaries.

  - CHECK total_Kwh >= 0: Energy consumed can be zero
    but never negative for a consumption meter.

  - FK ON DELETE CASCADE: If a Cost_Run is deleted, its
    result is meaningless without it and is also deleted.
*/

-- ============================================================
-- 18. EMISSION_FACTOR
-- ============================================================
CREATE TABLE Emission_Factor (
    factor_id      INT             AUTO_INCREMENT PRIMARY KEY,
    region         VARCHAR(150)    NOT NULL,
    `year`         YEAR            NOT NULL,
    kgCO2_per_Kwh  DECIMAL(10,6)   NOT NULL CHECK (kgCO2_per_Kwh > 0),
    CONSTRAINT uq_emission_region_year UNIQUE (region, `year`)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (region, year): Both are required to identify
    which grid emission factor to use. Without region or year
    the factor can't be matched to a carbon run correctly.

  - CHECK kgCO2_per_Kwh > 0: An emission factor of zero
    would make all carbon calculations return zero, producing
    misleading sustainability reports.

  - UNIQUE (region, year): Only one emission factor per
    region per year. Duplicate entries would make it
    ambiguous which factor to apply for a given year
    and region combination.
*/

-- ============================================================
-- 19. CARBON_RUN
-- ============================================================
CREATE TABLE Carbon_run (
    carbon_run_id  INT             AUTO_INCREMENT PRIMARY KEY,
    factor_id      INT             NOT NULL,
    user_id        INT             NOT NULL,
    building_id    INT,
    department_id  INT,
    campus_id      INT,
    start_at       DATE            NOT NULL,
    end_at         DATE            NOT NULL,
    CONSTRAINT fk_carbonrun_factor
        FOREIGN KEY (factor_id) REFERENCES Emission_Factor(factor_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_carbonrun_user
        FOREIGN KEY (user_id) REFERENCES `User`(UserID)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_carbonrun_building
        FOREIGN KEY (building_id) REFERENCES Building(Building_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_carbonrun_dept
        FOREIGN KEY (department_id) REFERENCES Department(Department_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_carbonrun_campus
        FOREIGN KEY (campus_id) REFERENCES Campus(Campus_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_carbonrun_scope
        CHECK (
            building_id   IS NOT NULL OR
            department_id IS NOT NULL OR
            campus_id     IS NOT NULL
        ),
    CONSTRAINT chk_carbonrun_dates
        CHECK (end_at > start_at)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (factor_id): Every carbon calculation needs
    an emission factor. Without it kgCO2 = 0 always,
    making all sustainability reports meaningless.

  - chk_carbonrun_scope: Same as Cost_Run — at least one
    organisational scope must be provided. A run with no
    scope has no defined dataset to calculate from.

  - CHECK end_at > start_at: Carbon calculation period
    must be a valid forward-moving date range.

  - FK → Emission_Factor ON DELETE RESTRICT: Cannot delete
    a factor that was used in calculations. Carbon audit
    trail must remain traceable.
*/

-- ============================================================
-- 20. CARBON_RESULT
--     NOTE: No user_id here — the user is already tracked
--     on Carbon_run. Carbon_result is purely a computed output.
-- ============================================================
CREATE TABLE Carbon_result (
    carbon_result_id INT            AUTO_INCREMENT PRIMARY KEY,
    carbon_run_id    INT            NOT NULL UNIQUE,
    total_Kwh        DECIMAL(15,4)  NOT NULL CHECK (total_Kwh >= 0),
    total_KgCO2      DECIMAL(15,4)  NOT NULL CHECK (total_KgCO2 >= 0),
    CONSTRAINT fk_carbonresult_run
        FOREIGN KEY (carbon_run_id) REFERENCES Carbon_run(carbon_run_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL UNIQUE (carbon_run_id): Exactly one result
    per carbon run. Prevents double-counting CO2 in
    sustainability reports.

  - CHECK total_KgCO2 >= 0: Carbon emissions can be zero
    (e.g. fully renewable period) but never negative.

  - No user_id: Deliberately excluded. The user who
    triggered this is already stored on Carbon_run.
    Storing it again here would be redundant duplication.
*/

-- ============================================================
-- 21. REPORT_REQUEST
-- ============================================================
CREATE TABLE Report_Request (
    request_id     INT             AUTO_INCREMENT PRIMARY KEY,
    user_id        INT             NOT NULL,
    building_ID    INT,
    department_ID  INT,
    campus_ID      INT,
    report_type    VARCHAR(100)    NOT NULL,
    start_at       DATE,
    end_at         DATE,
    filters_json   JSON,
    status         ENUM('pending','processing','completed','failed')
                                   NOT NULL DEFAULT 'pending',
    report_format  ENUM('pdf','csv','excel')
                                   NOT NULL DEFAULT 'pdf',
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rr_user
        FOREIGN KEY (user_id) REFERENCES `User`(UserID)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rr_building
        FOREIGN KEY (building_ID) REFERENCES Building(Building_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rr_dept
        FOREIGN KEY (department_ID) REFERENCES Department(Department_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rr_campus
        FOREIGN KEY (campus_ID) REFERENCES Campus(Campus_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_rr_scope
        CHECK (
            building_ID   IS NOT NULL OR
            department_ID IS NOT NULL OR
            campus_ID     IS NOT NULL
        ),
    CONSTRAINT chk_rr_dates
        CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (user_id): Every report request must be
    made by a specific user for accountability.

  - chk_rr_scope: At least one of building_ID,
    department_ID, campus_ID must be set. A report
    with no scope would try to compile data from
    everywhere, producing an unusable document.

  - CHECK end_at >= start_at: Note this uses >= not >
    because a single-day report where start = end is
    valid (unlike Cost_Run which requires > ).

  - ENUM DEFAULT 'pending' (status): New requests start
    as pending, waiting for the report generation job
    to pick them up.
*/

-- ============================================================
-- 22. REPORT
-- ============================================================
CREATE TABLE Report (
    report_id     INT             AUTO_INCREMENT PRIMARY KEY,
    request_id    INT             NOT NULL,
    file_path     VARCHAR(500)    NOT NULL,
    generated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_report_request
        FOREIGN KEY (request_id) REFERENCES Report_Request(request_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (request_id): Every report file must be
    linked to the request that generated it.
    An orphaned report file with no request is untraceable.

  - NOT NULL (file_path): A report record with no file
    path is useless — there's nothing to download.

  - FK ON DELETE CASCADE: If a report request is deleted,
    its generated report files are also deleted.
    Report files only make sense with their parent request.

  - No UNIQUE on request_id: One request can produce
    multiple report files (retry after failure, multiple
    formats, regeneration after data correction).
*/

-- ============================================================
-- 23. SUSTAINABLE_INITIATIVE
-- ============================================================
CREATE TABLE Sustainable_Initiative (
    initiative_id    INT             AUTO_INCREMENT PRIMARY KEY,
    title            VARCHAR(200)    NOT NULL,
    user_id          INT             NOT NULL,
    campus_id        INT,
    building_id      INT,
    department_id    INT,
    target_kwh       DECIMAL(15,4)   NOT NULL CHECK (target_kwh >= 0),
    baseline_start   DATE            NOT NULL,
    baseline_end     DATE            NOT NULL,
    baseline_kwh     DECIMAL(15,4)   NOT NULL CHECK (baseline_kwh >= 0),
    start_date       DATE            NOT NULL,
    end_date         DATE,
    status           ENUM('planned','active','completed','adjusted')
                                     NOT NULL DEFAULT 'planned',
    post_initiative_kwh DECIMAL(15,4) CHECK (post_initiative_kwh >= 0),
    outcome_notes    TEXT,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_si_user
        FOREIGN KEY (user_id) REFERENCES `User`(UserID)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_si_campus
        FOREIGN KEY (campus_id) REFERENCES Campus(Campus_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_si_building
        FOREIGN KEY (building_id) REFERENCES Building(Building_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_si_dept
        FOREIGN KEY (department_id) REFERENCES Department(Department_ID)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_si_scope
        CHECK (
            campus_id     IS NOT NULL OR
            building_id   IS NOT NULL OR
            department_id IS NOT NULL
        ),
    CONSTRAINT chk_si_target
        CHECK (target_kwh < baseline_kwh),
    CONSTRAINT chk_si_baseline_dates
        CHECK (baseline_end > baseline_start),
    CONSTRAINT chk_si_exec_dates
        CHECK (end_date IS NULL OR end_date > start_date),
    CONSTRAINT chk_si_baseline_before_start
        CHECK (baseline_end <= start_date)
);
/*
  CONSTRAINTS EXPLAINED:
  - NOT NULL (title): Every initiative must have a name
    for display on dashboards and reports.

  - NOT NULL (user_id): Every initiative must be created
    by a sustainability officer. No anonymous initiatives.

  - chk_si_scope: At least one of campus_id, building_id,
    department_id must be set. An initiative with no scope
    has no defined meters to measure improvement against.

  - CHECK target_kwh < baseline_kwh: The target must
    represent a REDUCTION from baseline. An initiative
    targeting higher consumption than baseline is not
    a conservation initiative.

  - NOT NULL (baseline_start, baseline_end): The historical
    reference window that was queried from Meter_Readings
    to compute baseline_kwh. Stored for auditability —
    proves the baseline was calculated fairly.

  - NOT NULL (baseline_kwh): The actual computed energy
    value from the baseline period. This is what
    post_initiative_kwh gets compared against to determine
    if improvement was achieved.

  - CHECK baseline_end > baseline_start: The reference
    window must be a valid date range.

  - CHECK baseline_end <= start_date: The baseline period
    must END before the initiative STARTS. You cannot use
    data from during the initiative as your baseline —
    that would make the comparison meaningless.

  - NULL allowed (end_date): An initiative might be
    ongoing with no defined end date yet.

  - NULL allowed (post_initiative_kwh): Only populated
    after the initiative ends and Meter_Readings are
    queried for the execution period.

  - DERIVED: improvement_achieved is NOT stored.
    It is computed as: post_initiative_kwh < baseline_kwh
    Storing it would risk inconsistency if post_initiative_kwh
    is ever updated.

  - FK → User ON DELETE RESTRICT: Cannot delete a user
    who created initiatives. Their sustainability work
    records must remain traceable.

  - FK → Campus/Building/Department ON DELETE SET NULL:
    If a building is removed, the initiative record is
    preserved as historical sustainability data.
*/


