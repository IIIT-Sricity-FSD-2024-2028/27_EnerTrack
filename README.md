# EnerTrack

Campus Energy and Renewables Management Platform

**Team 27_EnerTrack** · Domain: Sustainability and Green Economy

A role-based web platform for managing energy, water, cost and sustainability data across a
university campus. It models the campus hierarchy (campus, building, department, meter,
reading) and layers four workflows on top of it: wastage reporting, maintenance, finance and
sustainability reporting.

---

## The problem

Campuses run dozens of buildings with different consumption patterns, and monitoring them by
hand is slow and error prone. EnerTrack centralises that: it tracks electricity and water
consumption, estimates cost and carbon footprint, flags anomalies for a technician, and
produces the sustainability reports a compliance audit asks for.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 10 on Express 4, TypeScript |
| Frontend | HTML, CSS and vanilla JavaScript (no framework) |
| Data | In-memory store seeded at startup (`DatabaseService`) |
| API docs | Swagger / OpenAPI at `/api/docs` |
| Testing | Jest with Supertest |
| Logging | Morgan and rotating-file-stream, plus custom middleware |
| Security | Helmet, express-rate-limit, custom role and payload validation |
| Uploads | Multer with file signature validation |

Requires Node 18 or later. Developed on Node 22.

---

## Running it

Two processes: the API and a static server for the frontend.

**Backend**

```bash
cd root/backend
npm install
npm run start:dev
```

Serves the API on `http://localhost:3000/api` and Swagger on
`http://localhost:3000/api/docs`.

**Frontend**

```bash
cd root/front-end
npx serve -l 5500 .
```

Then open `http://localhost:5500/html/sign_in/sign_in.html`. VS Code Live Server works too.
Opening the root URL just shows a directory listing, so go straight to the sign-in page.

The frontend expects the backend on port 3000. That is set in `root/front-end/js/shared/api.js`
if you need to change it.

---

## Demo accounts

The database is seeded on every start, so these always exist. Passwords follow the pattern
`Name@123`, for example `Aadi@123`.

| Role | Email | Lands on |
|---|---|---|
| System Administrator | aadi@gmail.com | User and infrastructure management |
| Financial Analyst | husaam@gmail.com | Costs, invoices, financial reports |
| Technician Administrator | chirag@gmail.com | Alerts, faults, work order dispatch |
| Technician | teja@gmail.com | Assigned work orders |
| Sustainability Officer | viksa@gmail.com | Emissions, initiatives, reporting |
| Campus Visitor | trishank@gmail.com | Report an issue or wastage |

Data resets when the backend restarts, so anything you create during a session is temporary.

---

## Roles

Six roles have dashboards. The backend also recognises six B2B roles used by the
multi-tenancy layer (Platform Admin, Certified Energy Auditor, Account Officer, Economic
Buyer, Facility Manager, Department Head). Those map onto the six above through the
`ROLE_EQUIVALENTS` table and do not have their own pages yet.

| Role | What they do |
|---|---|
| System Administrator | Manages users, campus infrastructure and system configuration. Reviews audit logs and system-wide reports. |
| Financial Analyst | Tracks utility spend, manages invoices and their approval, and evaluates return on energy efficiency measures. |
| Technician Administrator | Triages real-time anomaly alerts and faults, then creates and assigns work orders. |
| Technician | Executes assigned work orders and records completion. |
| Sustainability Officer | Monitors emissions and energy intensity, runs conservation initiatives, and prepares compliance reports. |
| Campus Visitor | Files issue and wastage reports and tracks their progress. |

---

## Repository layout

```
root/
  backend/
    src/
      core/
        database/      seeded in-memory store and the UserRole enum
        decorators/    @Roles
        filters/       exception filters
        guards/        RolesGuard
        interceptors/  response envelope
        middleware/    logging, security, file upload, upload audit
        tenancy/       per-request organisation scope
        utils/         log writer, redaction, file signatures
      modules/         20 feature modules, each with controller, service, DTOs
      main.ts          application-level middleware and Swagger setup
      app.module.ts    middleware registration
    test/              end to end tests
    docs/swagger.json  generated on every start
    MIDDLEWARE.md      middleware reference
  front-end/
    html/              22 pages, grouped by role
    js/                page logic, plus js/shared/api.js
    css/
    assets/
Database/              SQL schema and ER diagram
Figma Designs/         UI mockups per role
```

---

## API

142 endpoints across 20 modules. Browse and try them at `/api/docs`.

Every successful response is wrapped by an interceptor:

```json
{ "success": true, "data": { }, "timestamp": "2026-08-28T09:00:00.000Z" }
```

Errors use the same shape, so the frontend has one format to handle:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Invoice with ID abc not found",
  "error": "Not Found",
  "path": "/api/invoices/abc",
  "method": "GET",
  "timestamp": "2026-08-28T09:00:00.000Z"
}
```

Two headers drive access control:

| Header | Purpose |
|---|---|
| `x-role` | The caller's role. Checked against the role enum, then against the route's `@Roles` list. |
| `x-org-id` | The organisation the caller is acting within. Scopes every query to that tenant. |

`api.js` attaches both automatically from the signed-in user.

---

## Middleware and logging

Five kinds of middleware are implemented. Full detail, including execution order and how to
verify each one, is in [`root/backend/MIDDLEWARE.md`](root/backend/MIDDLEWARE.md).

| Type | Implementation |
|---|---|
| Logging | Morgan for access logs, plus custom middleware for request and response bodies |
| Error handling | Global exception filter, plus a route-scoped filter for upload errors |
| File upload | Multer with per-route rules, and file signature validation |
| Security | Helmet, rate limiting, role header validation, recursive payload scanning |
| Router-level | Upload audit bound to three routes, invoice access bound to a controller |

Logs are written to `root/backend/logs/`, which is gitignored. Entries buffer in memory and
flush every 5 seconds, except for server errors, rate limit rejections and blocked security
threats, which write immediately. Files rotate daily and are swept after 7 days.

| File | Contents |
|---|---|
| `access.log` | Standard HTTP access log |
| `custom-debug-*.log` | Request and response bodies with timing |
| `error-*.log` | Every handled error, with stack traces for 5xx |
| `security-threats-*.log` | Blocked roles and injection attempts |
| `upload-audit-*.log` | Every file upload attempt and its outcome |
| `invoice-access-*.log` | Access to financial records |

Passwords and tokens are masked before anything reaches a log file.

---

## Tests

```bash
cd root/backend
npx jest --config ./test/jest-e2e.json
```

26 end to end tests covering the middleware chain: role rejection, injection blocking, the
error envelope, log persistence, credential redaction, upload validation and log flushing.
They drive real HTTP requests, so they verify the middleware is actually registered rather
than only that it works in isolation.

Type checking:

```bash
npx tsc --noEmit
```

---

## Documentation

| File | What it covers |
|---|---|
| `README.md` | This file. Setup and orientation. |
| `root/backend/MIDDLEWARE.md` | Middleware reference, execution order, verification steps |
| `PROJECT_OVERVIEW.md` | Architecture analysis derived from the source |
| `DomainExpertInteraction.md` | Notes from the domain expert interview |
| `Database/dbschema.sql` | SQL schema |
| `SRS.pdf` | Software requirements specification |

---

## Team

Aadithya, Husaam, Chirag, Vijaya Teja and Viksa.

Built for the Full Stack Development course at IIIT Sri City.
