# EnerTrack — Campus Energy & Renewables Management Platform
### Codebase Analysis & Architecture Documentation

> Repository: `C:\FSD\27_EnerTrack` (git repo, branch `main`, remote `IIIT-Sricity-FSD-2024-2028`)
> Team: **27_EnerTrack** · Domain: *Sustainability and Green Economy*
> Document generated: 2026-08-24 — derived by reading the source, not the specs.

---

## 1. What the project is

EnerTrack is a **role-based web platform for managing energy, water, cost and sustainability data across a university campus**. It is an academic Full-Stack Development (FSD) project built around a domain-expert interview and an SRS, and it covers the full lifecycle: campus/building/department/meter configuration → meter readings → anomaly alerts → faults → work orders → cost tracking → sustainability reporting.

The system models a campus hierarchy (`Campus → Building → Department → Meter → MeterReading`) and layers four operational workflows on top of it: **wastage reporting**, **maintenance**, **finance**, and **sustainability**.

### Actors (6 roles in code, 4 in the SRS)

| Role | Landing page | Primary job |
|---|---|---|
| **System Administrator** | `system_admin/system_admin_overview.html` | Users, campus/building/department/meter infrastructure, system health, audit logs |
| **Financial Analyst** | `finance-analyst/finance_overview.html` | Energy costs, invoices, budgets, ROI/NPV financial reports |
| **Technician Administrator** | `technician/technician_overview.html` | Triages alerts & faults, creates and assigns work orders |
| **Technician** (junior) | `technician_jr/technician_jr_work_orders.html` | Executes assigned work orders on a Kanban board |
| **Sustainability Officer** | `sustainability_officer/sust_overview.html` | Emissions/energy/water metrics, initiatives, compliance reports |
| **Campus Visitor** (end user) | `enduser/enduser_dashboard.html` | Files wastage reports & service requests, tracks their status |

> `Technician Administrator` and `Campus Visitor` exist only in the implementation — the README lists four actors. The split of "Technician" into senior (dispatcher) and junior (executor) is a code-level decision reflected in the `UserRole` enum in `root/backend/src/core/database/database.service.ts`.

---

## 2. Repository layout

```
27_EnerTrack/
├── README.md                     # Problem statement, actors, planned features
├── SRS.pdf                       # Software Requirements Specification
├── definitions.yml               # 24-term domain glossary (name/definition/examples/aliases)
├── DomainExpertInteraction.md    # 64-min expert interview: workflows, rules, pain points
├── LLM_Backend_Context .md       # The 19-table schema contract the backend was built against
├── Database/
│   ├── dbschema.sql              # Relational MySQL schema + triggers/functions/procedures
│   └── Er Diagram.pdf
├── Figma Designs/                # Per-actor UI mockups (PNG) + Figma links
└── root/
    ├── backend/                  # NestJS 10 REST API  (TypeScript)
    ├── front-end/                # Vanilla HTML/CSS/JS multi-page app
    └── Videos/Video.md           # Demo video link
```

There is also a sibling `C:\FSD\Practice\` folder (a Vite `attendance-app`, a NestJS `club-events-server`, and a React scratch file). It is **coursework practice, unrelated to EnerTrack**, and not part of this analysis beyond this note.

---

## 3. Tech stack

**Backend** — `root/backend`
- NestJS 10 + Express, TypeScript 5 (CommonJS, ES2021 target)
- `class-validator` + `class-transformer` for DTO validation
- `@nestjs/swagger` for OpenAPI docs
- **No database driver, no ORM, no auth library.** Data lives in memory.

**Frontend** — `root/front-end`
- Plain HTML5 / CSS3 / ES-module JavaScript. **No framework, no bundler, no build step.**
- Only dev dependency is Prettier (`npm run format`)
- Charts, modals, toasts, Kanban boards are all hand-rolled DOM code
- State kept in `localStorage` / `sessionStorage`

---

## 4. Backend architecture

### 4.1 Bootstrap (`src/main.ts`)

Everything is wired globally at startup:

| # | Concern | Detail |
|---|---|---|
| 1 | Global prefix | `/api` |
| 2 | `ValidationPipe` | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — unknown body fields are **rejected**, not ignored |
| 3 | `RolesGuard` | Applied globally |
| 4 | Interceptors | `TransformInterceptor` + `LoggingInterceptor` |
| 5 | CORS | `origin: '*'`, allowed headers `Content-Type`, `Accept`, `x-role` |
| 6 | Swagger | Served at `/api/docs`, and **written to disk** at `docs/swagger.json` on every boot |
| 7 | Port | `process.env.PORT` or **3000** |

A neat touch in `main.ts`: after building the OpenAPI document it **injects live seed records from `DatabaseService` as request-body examples** for every `Create*Dto` / `Update*Dto`, stripping the entity's own primary key (with special cases for `MeterReading` and `SustainabilityReport`). Swagger therefore shows realistic, copy-pasteable payloads.

### 4.2 The "database" (`src/core/database/database.service.ts`, ~1,500 lines)

This is the single most important file to understand. It is a `@Global()`, `Scope.DEFAULT` (singleton) service that holds **19 public arrays of plain objects** — the entire dataset, hardcoded:

```
users · notifications · campus · buildings · departments · meters · meterReadings
wastageReports · alerts · faults · serviceRequests · workOrders
energyCosts · invoices · financialReports
sustainabilityMetrics · initiatives · activityLogs · sustainabilityReports
```

It also exports every enum and every entity `interface` used across the app (`UserRole`, `MeterType`, `MeterStatus`, `AlertStatus`, `FaultSeverity`, `FaultStatus`, `WorkOrderPriority`, `WorkOrderStatus`, `EnergyCostStatus`, `InvoiceStatus`, `InitiativeStatus`, `WastageType`, `NotificationTargetType`).

**Consequences of this design:**
- Mutations are `Array.push` / `splice` / index assignment — no transactions, no constraints, no cascade.
- **All data resets to the seed on every server restart.** Nothing persists.
- Uniqueness (e.g. duplicate email) and FK existence are enforced *manually in services* via `.find()` + `ConflictException` / `NotFoundException`.
- The seed doubles as demo fixtures, Swagger examples and test data.

Seeded demo accounts (plaintext passwords, by design for the demo):

| Name | Email | Role |
|---|---|---|
| Aadithya | aadi@gmail.com | System Administrator |
| Husaam | husaam@gmail.com | Financial Analyst |
| Chirag | chirag@gmail.com | Technician Administrator (Electrical) |
| Teja | teja@gmail.com | Technician (Solar Installation) |
| Viksa | viksa@gmail.com | Sustainability Officer |

### 4.3 Module structure — 19 feature modules, one per entity

Every module under `src/modules/<name>/` follows an identical, clearly generated-then-hand-tuned shape:

```
<name>/
├── <name>.module.ts       # imports DatabaseModule, declares controller + service
├── <name>.controller.ts   # @ApiTags, @ApiOperation, @ApiResponse, @ApiHeader, @Roles
├── <name>.service.ts      # injects DatabaseService, operates on its array
└── dto/
    ├── create-<name>.dto.ts   # class-validator decorators
    ├── put-<name>.dto.ts      # `extends Create<Name>Dto` (full replace)
    └── update-<name>.dto.ts   # `PartialType(Create<Name>Dto)` (patch)
```

The 19 modules: `users`, `notifications`, `campus`, `buildings`, `departments`, `meters`, `meter-readings`, `wastage-reports`, `alerts`, `faults`, `service-requests`, `work-orders`, `energy-costs`, `invoices`, `financial-reports`, `sustainability-metrics`, `initiatives`, `activity-logs`, `sustainability-reports`.

Each exposes the standard set (`POST /`, `GET /`, `GET /:id`, `PUT /:id`, `PATCH /:id`, `DELETE /:id`) plus **relationship and action sub-routes**:

| Route | Purpose |
|---|---|
| `POST /api/users/login` | Email+password auth, returns user minus password. **No `@Roles` — public.** |
| `POST /api/users/register` | Public self-service sign-up |
| `GET /api/users/:id/notifications` | User's notification feed |
| `GET /api/campus/:id/buildings` | Campus → buildings drill-down |
| `GET /api/buildings/:id/departments`, `/meters` | Building drill-down |
| `GET /api/departments/:id/invoices` | Department billing |
| `GET /api/meters/:id/readings`, `/alerts` | Meter telemetry & alarms |
| `GET /api/alerts/:id/faults` | Faults raised from an alert |
| `POST /api/alerts/:id/messages` | Appends to the alert's JSON chat thread |
| `GET /api/faults/:id/work-orders` | Work orders for a fault |
| `GET /api/service-requests/:id/work-orders` | Work orders from a request |
| `GET /api/energy-costs/by-period/:period` | Costs for e.g. `2025-03` |
| `PATCH /api/notifications/:id/mark-read` | Read-receipt |

### 4.4 ID generation is inconsistent

- `users` → `crypto.randomUUID()`
- `alerts` → human-readable sequential `ALT-001`, `ALT-002`… derived from `array.length + 1`

The sequential scheme is **not collision-safe**: deleting a record lowers `length`, so the next create reuses an existing ID.

### 4.5 Cross-cutting concerns (`src/core/`)

| File | What it does |
|---|---|
| `decorators/roles.decorator.ts` | `@Roles(...roles)` → `SetMetadata('roles', roles)` |
| `guards/roles.guard.ts` | Reads the **`x-role` request header**; no `@Roles` on a handler ⇒ route is public; header missing or not in the allow-list ⇒ `403 Forbidden` |
| `decorators/current-role.decorator.ts` | `@CurrentRole()` — reads **`x-user-role`** (note: *different header name*), defaults to `"System Administrator"` |
| `interceptors/transform.interceptor.ts` | Wraps every success response as `{ success, data, timestamp }` |
| `interceptors/logging.interceptor.ts` | Logs `[REQUEST]` / `[RESPONSE]` with method, URL, body, status and duration; truncates payloads at 300 chars |
| `middleware/logger.middleware.ts` | Same idea at the Express layer by monkey-patching `response.send` — **written but never registered** in `AppModule` |

### 4.6 The security model, stated plainly

Authentication is a **plaintext email/password lookup** against the in-memory array. Authorisation is **a client-supplied `x-role` header**. There is no session, no token, no password hashing, and nothing stops a caller from sending `x-role: System Administrator`. `LLM_Backend_Context .md` says passwords "must be hashed" — they are not.

This is appropriate for a course demo, and it is the single largest gap between the project as built and anything deployable. Any production hardening starts here: hash with bcrypt/argon2, issue a JWT at login, and derive the role from the verified token instead of a header.

---

## 5. Frontend architecture

### 5.1 Shape

A **multi-page application**: 22 standalone HTML files, each with its own CSS bundle and one ES-module entry script. Navigation is plain `window.location.href`. There is no router, no virtual DOM, no build.

```
front-end/
├── html/   landing · sign_in · sign_up · 404 · and one folder per role
├── css/    landing/ · sign_in/ · sign_up/ · shared/ · <role>/
├── js/
│   ├── shared/     api.js · universalDB.js · notifications.js
│   │                sensorSimulator.js · dashboardProfileMenu.js · mockData.js
│   ├── system_admin/           overview.js + modules/{adminLayout, UserManagement, infrastructureManager}
│   ├── finance-analyst/        overviewPage · costsPage · reportsPage + modules/{energyCosts, invoices, reports, activity, session}
│   ├── sustainability_officer/ overviewPage · monitoringPage · initiativesPage · reportingPage
│   ├── technician/             overviewPage · alertsPage · maintenancePage · workOrdersPage
│   ├── technician_jr/          workOrdersPage
│   └── enduser/                enduser.js · wastage.js
└── assets/  ~80 PNG icons and logos
```

~15,000 lines of JavaScript total. The heaviest files are `enduser/wastage.js` (1,261), `sustainability_officer/overviewPage.js` (1,134), `shared/universalDB.js` (1,107), `finance-analyst/overviewPage.js` (886) and `system_admin/modules/infrastructureManager.js` (861).

### 5.2 `js/shared/api.js` — the one true HTTP client

A ~90-line wrapper, loaded as a **classic script** (so it can set `window.api` for both module and non-module consumers):

- `API_BASE = "http://localhost:3000/api"` (hardcoded)
- Reads `localStorage.currentUser.role` and sends it as the **`x-role`** header on every call
- Unwraps the backend's `{ success, data, timestamp }` envelope and returns `data` directly
- Turns a `fetch` rejection into a friendly *"Cannot reach server. Is the backend running on port 3000?"*
- Flattens NestJS's array-valued `message` field into a single string
- Logs every request/response to the console

Exposes `api.get / post / patch / put / delete`.

### 5.3 `js/shared/universalDB.js` — the legacy client-side store

A ~1,100-line module that mirrors the entire ERD **plus** per-actor UI state (`system_admin`, `finance`, `sust`, `tech`, `workflow`), persisted to `localStorage` under key `enertrack_universal_v1`. The `UniversalDB` class deep-merges stored data over `defaultData` on load, and exposes `save()` / `reset()`.

This predates the backend. The project is **mid-migration** from `universalDB` to the real API, which is the single most important thing to understand about the frontend today.

### 5.4 Migration status: which pages talk to the real backend

**Fully backend-wired** (no mock fallback):
`sign_in` · `sign_up` · `technician/alertsPage` · `technician/maintenancePage` · `technician_jr/workOrdersPage` · `sustainability_officer/initiativesPage`

**Hybrid** — backend-first with a `try/catch` fallback to `universalDB` / `mockData`:
`system_admin/*` (users, infrastructure) · `technician/workOrdersPage` · `technician/overviewPage` · `sustainability_officer/{overviewPage, monitoringPage, reportingPage}` · `finance-analyst/{overviewPage, costsPage, reportsPage}` · `enduser/*`

**Still local-only:**
`finance-analyst/modules/{energyCosts, invoices, reports, activity}` (invoice CRUD, cost CRUD) · the whole `*/data/mockData.js` layer · `shared/notifications.js` (per-user notification queues in `localStorage`, keyed `enertrack_notifications_<email>`) · `shared/sensorSimulator.js`

`sensorSimulator.js` deserves a mention: it fabricates plausible IoT readings per wastage type (Energy/Water/Emissions/Food) with baseline bands, a 30–120 % spike multiplier, a deterministic hashed sensor ID, and an `anomalyDetected` flag when deviation > 25 %. Its own header comment names it as the seam to replace with a real ingestion API.

### 5.5 Session handling

`sign_in.js` posts to `/api/users/login`, stores the returned user object in `localStorage.currentUser`, and redirects by role. Every dashboard page re-reads `currentUser` on `DOMContentLoaded` and bounces to sign-in if it is missing.

The finance and sustainability areas keep a **second, older session** (`enertrack_finance_session`) whose `session.js` maps the display role onto internal permission keys (`superuser` / `finance_analyst` / `enduser`) and drives `data-roles` / `data-perm` attribute-based UI gating. Both session systems run side by side.

---

## 6. The data model

### 6.1 Two schemas exist, and they disagree

**`Database/dbschema.sql`** is a classic normalised MySQL design (~18 tables, `INT` PKs) with lookup tables (`Meter_Type`, `Utility_Rate`, `Emission_Factor`, `Role`, `Suppliers`), calculation-run tables (`Cost_Run`/`Cost_Result`, `Carbon_Run`/`Carbon_Result`), a `Work_Order_Supplies` junction table, and real database logic:

- **Triggers** — `trg_high_reading_alert` (auto-creates an Alert when a reading exceeds 1000) and `trg_alert_to_fault` (escalates HIGH alerts into Faults)
- **Functions** — `Get_Total_kWh`, `Get_Cost`, `Get_CO2`

- **Procedures** — `Calculate_Cost`, `Calculate_Carbon`

**`LLM_Backend_Context .md`** specifies a different, deliberately denormalised **19-table UUID schema** where weak entities are folded into `jsonb` columns (`Alert.messages`, `Initiative.outcomes`, `WastageReport.details`, `SustainabilityReport.metrics`). **This is the schema the backend actually implements.**

The SQL file is therefore a *design artefact* (ER modelling, triggers/procedures coursework) and is **not connected to any running code**. The threshold-alert and alert→fault escalation logic it encodes has no equivalent in the NestJS backend — there is no anomaly detection service; alerts are created by explicit `POST /api/alerts` calls.

### 6.2 The 19 entities as implemented

| Domain | Entities |
|---|---|
| **A · Identity & Access** | `User`, `Notification` |
| **B · Location & IoT** | `Campus`, `Building`, `Department`, `Meter` |
| **C · Wastage** | `WastageReport`, `MeterReading` |
| **D · Maintenance** | `Alert`, `Fault`, `ServiceRequest`, `WorkOrder` |
| **E · Finance** | `EnergyCost`, `Invoice`, `FinancialReport` |
| **F · Sustainability & Audit** | `SustainabilityMetric`, `Initiative`, `ActivityLog`, `SustainabilityReport` |

Key relationships:

```
Campus 1─N Building 1─N Department
Building 1─N Meter 1─N MeterReading
MeterReading 1─N Alert          (triggering_reading_id)
MeterReading 1─N WastageReport  (sensor_reading_id — baseline context)
Alert 1─N Fault 1─N WorkOrder
ServiceRequest 1─N WorkOrder
User 1─N Notification, WastageReport, ServiceRequest, WorkOrder,
         Invoice(approver), FinancialReport, Initiative,
         ActivityLog, SustainabilityReport
```

Two documented fields are **absent from the runtime interfaces**: `Alert` has no `created_at`, and neither `Fault` nor `WorkOrder` carries a timestamp — so "time to resolution", one of the expert's stated goals, cannot currently be computed from the API.

### 6.3 Enum vocabulary (single source of truth: `database.service.ts`)

```
UserRole                System Administrator | Financial Analyst | Technician |
                        Technician Administrator | Sustainability Officer | Campus Visitor
MeterType               electricity | gas | water | emissions | food
MeterStatus             active | faulty | calibrating | decommissioned
WastageType             Energy | Water | Emissions | Food
AlertStatus             open | acknowledged | resolved
FaultSeverity           low | moderate | high | critical
FaultStatus             active | pending | resolved
WorkOrderPriority       immediate | high | medium | low
WorkOrderStatus         new | inprogress | approval | review | closed
EnergyCostStatus        under-budget | on-budget | over-budget
InvoiceStatus           pending | approved | overdue | paid
InitiativeStatus        proposed | in-progress | approved | completed | rejected
NotificationTargetType  wastage | alert | request
```

The runtime enums have drifted **ahead** of `LLM_Backend_Context .md`: it omits `Technician Administrator`, `WastageType.Emissions` and `WorkOrderStatus.approval`, all of which the code and UI rely on.

---

## 7. End-to-end workflows

### Workflow 1 — Wastage report (Campus Visitor → Sustainability Officer)
1. Visitor submits a report on `enduser_wastage.html` (type, priority, location, observation).
2. `sensorSimulator.generateSensorData()` attaches a fabricated sensor reading, baseline, deviation % and anomaly confidence.
3. `POST /api/wastage-reports` persists it; a notification is queued for the officer.
4. The officer reviews it on the monitoring page and `PATCH`es the status (verify / dismiss / escalate).
5. Dismissed reports are flagged `archived` and move to the archives view. The reporter is notified; a cross-tab `storage` listener re-renders open tabs live.

### Workflow 2 — Alert → Fault → Work Order (Technician Admin → Technician)
1. An `Alert` exists against a meter (seeded, or created via `POST /api/alerts`).
2. The Technician Administrator triages it on `technician_alerts.html`, discusses it in the alert's JSON chat thread (`POST /api/alerts/:id/messages`), and acknowledges it.
3. A `Fault` is raised and assigned (`technician_maintenance.html` → `PATCH /api/faults/:id`).
4. A `WorkOrder` is created from the fault or from a service request, with priority and assignee.
5. The junior Technician moves it across the Kanban board `new → inprogress → review → approval → closed`.

### Workflow 3 — Finance
Energy costs per building/department per period are compared against budget (`under-` / `on-` / `over-budget`); invoices run `pending → approved → paid`, with `overdue` as an exception state; `FinancialReport` records carry `roi` and `npv`.

### Workflow 4 — Sustainability
`SustainabilityMetric` rows (energy consumed / water usage / emissions per period) feed the monitoring dashboard; `Initiative` records track proposals through `proposed → approved → in-progress → completed`; a multi-stage report pipeline generates `SustainabilityReport` archives with a `metrics` JSON KPI block (energy reduction, waste diverted, carbon offset, water saved) via `POST /api/sustainability-reports`.

---

## 8. Running the project

```bash
# 1) Backend  (http://localhost:3000, Swagger at /api/docs)
cd root/backend
npm install
npm run start:dev

# 2) Frontend — static files, needs any HTTP server (ES modules break on file://)
cd root/front-end
npx serve .        # or VS Code Live Server
# open html/sign_in/sign_in.html
```

Sign in with any seeded account (e.g. `aadi@gmail.com` / `Aadi@123`).

**Configuration:** none. There is no `.env`, no config module, no `ConfigService`. `API_BASE` is hardcoded in `api.js`; the port is the only env-aware value (`process.env.PORT`).

---

## 9. Testing & tooling

Testing is **scaffolded but empty**. `test/jest-e2e.json` is a zero-byte file, `test/app.e2e-spec.js` is empty, and `src/core/database/database.service.spec.ts` is the only spec — it asserts `expect(true).toBe(true)`. `package.json` declares `jest`/`supertest` in devDependencies but **no `jest` key**, so `npm test` has no configuration to run against. `.eslintrc.js` is a zero-byte file. Prettier is the only formatter actually in use (frontend only).

---

## 10. Observations & concrete gaps

Ordered by impact.

1. **No persistence.** Every write dies with the process. Migrating `DatabaseService` to TypeORM + Postgres is the natural next step, and the schema contract for doing so already exists.
2. **Authentication is not authentication.** Plaintext passwords, no token, and a spoofable `x-role` header. See §4.6.
3. **Header-name mismatch.** `RolesGuard` reads `x-role`; `CurrentRole` reads `x-user-role`, which is never sent by `api.js` and never allowed through CORS — so `@CurrentRole()` always silently returns its `"System Administrator"` default.
4. **Broken redirect for the Sustainability Officer.** `sign_in.js:46` sends the role to `sustainability_officer/sustainability_officer_overview.html`; the file on disk is `sust_overview.html`. That login lands on a 404.
5. **Three pages call `window.api` without loading `api.js`.** `finance_costs.html`, `finance_reports.html` and `sust_monitoring.html` omit the `<script src=".../shared/api.js">` tag. Their `if (window.api)` guard makes this fail silently — the pages quietly serve stale mock data instead of live records.
6. **Sequential alert IDs collide.** `ALT-${alerts.length + 1}` reuses an ID after any delete.
7. **Two parallel client stores.** `universalDB` and the API are both live; several pages read one and write the other. Finishing the migration (and deleting `universalDB.js` plus the four `data/mockData.js` files) would remove a whole class of "the UI shows something the server doesn't have" bugs.
8. **No anomaly detection.** The trigger logic in `dbschema.sql` (reading > threshold ⇒ Alert; HIGH alert ⇒ Fault) is a headline feature per the README, and it exists nowhere in the running code. Alerts are only ever created by hand.
9. **Missing timestamps** on `Alert`, `Fault` and `WorkOrder` block the downtime/MTTR metrics the domain expert asked for.
10. **Dead code:** `LoggerMiddleware` is fully written but never registered — it duplicates `LoggingInterceptor`, which is the one actually running.
11. **`docs/swagger.json` is rewritten on every boot** and is tracked in git, so it shows as modified in `git status` after any local run.

---

## 11. Fastest path to understanding the code

| Question | File |
|---|---|
| What data exists? | `root/backend/src/core/database/database.service.ts` |
| What endpoints exist? | `root/backend/docs/swagger.json`, or `/api/docs` while running |
| How is the app wired? | `root/backend/src/main.ts` + `app.module.ts` |
| What does one module look like? | `root/backend/src/modules/users/` (the only one with non-CRUD auth logic) |
| How does the UI talk to the API? | `root/front-end/js/shared/api.js` |
| What does the legacy store hold? | `root/front-end/js/shared/universalDB.js` |
| What do the terms mean? | `definitions.yml` (24 entries), `DomainExpertInteraction.md` |
| What was the intended DB design? | `Database/dbschema.sql` + `Database/Er Diagram.pdf` |

---

## 12. The revenue model and the platform-side actors

> Added after the original analysis above, which predates this work. Where the two disagree,
> this section is current. In particular §10 lists gaps that have since been closed: the
> Sustainability Officer redirect, and the pages that called `window.api` without loading
> `api.js`.

### 12.1 Two sides, not six roles

The system is no longer best described as six roles. It is **two sides**:

| | Client side | Platform side |
|---|---|---|
| Roles | System Administrator, Financial Analyst, Technician Administrator, Technician, Sustainability Officer, Campus Visitor | Super Admin, Certified Energy Auditor, Account Officer |
| `organization_id` | set | `null` |
| Scope | one tenant, via `scopeToTenant()` | every tenant |
| Owns | the campus: meters, alerts, work orders, costs, sustainability | the business: audits, contracts, billing |

Every entity added by this work is **platform-owned**: it carries an `organization_id` but the
record belongs to EnerTrack *about* the client, not to the client. The existing
`scopeToTenant()` needed no change to handle that correctly — staff send no `x-org-id` and get
the cross-tenant view, a client sends theirs and sees only its own rows.

### 12.2 Four new backend modules

| Module | Purpose |
|---|---|
| `subscription-plans` | The price catalogue. The only entity with **no** `organization_id`, so `scopeToTenant()` must never be applied to it. |
| `subscriptions` | One contract per tenant: plan, cycle, renewal, negotiated share, linked baseline audit. |
| `energy-audits` | The auditor's engagement: survey, locked baseline, `findings[]` and `verifications[]` folded in as JSON arrays, matching `Alert.messages`. |
| `platform-invoices` | What EnerTrack bills. **Not** `Invoice`, which is the client's utility bill from their supplier — two money flows in opposite directions. |

Plus `src/modules/billing/pricing.ts`: the whole revenue model as pure functions, with no Nest
and no database, so the rules can be read and tested in one file.

### 12.3 The rule that carries the most weight

`performanceShareLine()` returns nothing unless a verification is `client-accepted`.

The auditor who locks the baseline works for the party paid a share of the gap between that
baseline and actual consumption; without a counterparty, that is a loop the vendor controls
from both ends. Client acceptance is the counterparty, and the guard lives in the pricing
engine rather than a controller so that no route added later can bypass it.

Three supporting rules: the baseline is **adjusted** for the period's weather, occupancy and
floor area before anything is claimed; a claim is **attributed** only to findings actually
marked implemented, scoped to their buildings and dates; and the share is **capped** as a
multiple of the subscription fee.

### 12.4 New frontend

```
html/auditor/            4 pages — overview, audits & baselines, findings, verification
html/account_officer/    4 pages — book of accounts, account detail, billing, savings reporting
html/finance-analyst/finance_subscription.html
                         client-side: plan, invoices, and the accept/dispute queue
css/shared/platform_shared.css
                         shared skin for both EnerTrack-side dashboards
js/system_admin/modules/plansManager.js, revenueManager.js
                         two new Super Admin tabs, gated on data-requires-role
```

`css/shared/tech_shared.css` is reused wholesale by the new dashboards rather than cloned.
Despite its name nothing in it is technician-specific: it is this project's generic dashboard
system.

### 12.5 One client-side write, on purpose

`PATCH /energy-audits/:id/verifications/:vid/accept` and `/dispute` are the only revenue-model
routes a client role may call. The service asserts the caller's `x-org-id` matches the audited
organisation, so the concession stays narrow.
