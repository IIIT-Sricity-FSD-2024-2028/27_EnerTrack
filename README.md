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
| Organization Admin | aadi@gmail.com | User and infrastructure management |
| Financial Analyst | husaam@gmail.com | Costs, invoices, financial reports |
| Technician Administrator | chirag@gmail.com | Alerts, faults, work order dispatch |
| Technician | teja@gmail.com | Assigned work orders |
| Sustainability Officer | viksa@gmail.com | Emissions, initiatives, reporting |
| Campus Visitor | trishank@gmail.com | Report an issue or wastage |

EnerTrack's own staff, who have no organisation and work across every client:

| Role | Email | Lands on |
|---|---|---|
| Super Admin | priya@enertrack.com | Organisations, tiers, revenue, and acting as any user |
| Certified Energy Auditor | arun@enertrack.com | Site surveys and recommendations |

Data resets when the backend restarts, so anything you create during a session is temporary.

---

## Roles

The platform has two sides, and this is the distinction to hold onto.

**Client side** — a tenant's own staff. Their `organization_id` is set, every query they make is
narrowed to it by `scopeToTenant()`, and nothing they do reaches another tenant.

| Role | What they do |
|---|---|
| Organization Admin | Manages users, campus infrastructure and system configuration. Reviews audit logs and system-wide reports. |
| Financial Analyst | Tracks utility spend, manages invoices and their approval, and evaluates return on energy efficiency measures. |
| Technician Administrator | Triages real-time anomaly alerts and faults, then creates and assigns work orders. |
| Technician | Executes assigned work orders and records completion. |
| Sustainability Officer | Monitors emissions and energy intensity, runs conservation initiatives, and prepares compliance reports. |
| Campus Visitor | Files issue and wastage reports and tracks their progress. |

**Platform side** — EnerTrack's own staff. Their `organization_id` is null, they appear in
`PLATFORM_SIDE_ROLES`, and they work across every client.

| Role | What they do | Lands on |
|---|---|---|
| Super Admin | Provisions client organisations and users; owns the tier catalogue, contracts and billing. Can act as any user. | `system_admin/` (Organisations, Pricing Plans, Revenue tabs) |
| Certified Energy Auditor | Surveys a site and writes up what needs fixing. Nothing they record feeds an invoice. | `auditor/` |

Three further B2B roles are client-side and map onto existing roles through `ROLE_EQUIVALENTS`:
**Economic Buyer** (the person who signs the cheque — lands on the subscription page),
**Facility Manager**, and **Department Head**.

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
      modules/         24 feature modules, each with controller, service, DTOs
      modules/billing/ pricing.ts — the revenue model as pure functions
      main.ts          application-level middleware and Swagger setup
      app.module.ts    middleware registration
    test/              end to end tests
    docs/swagger.json  generated on every start
    MIDDLEWARE.md      middleware reference
  front-end/
    html/              31 pages, grouped by role
    js/                page logic, plus js/shared/api.js
      auditor/           Certified Energy Auditor pages
      shared/roleRoutes.js   role → landing page, shared by sign-in and impersonation
      system_admin/modules/plansManager.js, revenueManager.js
    css/
    assets/
Database/              SQL schema and ER diagram
Figma Designs/         UI mockups per role
```

---

## API

192 endpoints across 24 modules. Browse and try them at `/api/docs`.

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

## Revenue model

One sentence: **each tier includes a number of staff seats and a number of campuses; go over
the seat allowance and you pay per extra seat.**

| Tier | Campuses | Included staff | Per month | Extra seat |
|---|---|---|---|---|
| Starter | 1 | 5 | ₹12,000 | ₹1,200 |
| Growth | 3 | 20 | ₹35,000 | ₹1,000 |
| Enterprise | unlimited | 60 | ₹90,000 | ₹800 |

```
invoice = base_monthly_fee
        + max(0, billable_staff − included_seats) × price_per_extra_seat
        + 18% GST
```

An invoice therefore has at most two lines. Both figures come from platform state — the tier
from the contract, the headcount from the live user list — so nothing on a bill is typed in by
hand, and every line carries a `source_ref` back to the record that produced it.

**A billable seat is any user in the organisation except a Campus Visitor.** That is the only
carve-out. A campus may have thousands of students filing wastage reports, and billing per
student would punish the client for opening the product up to the people who spot faults first.

Both tier limits are genuinely enforced, so the tiers differ in substance rather than in a
feature list that gates nothing:

- **Seats are metered.** Going over bills an overage rather than refusing the user — blocking a
  hire to protect a price would be hostile.
- **Campuses are blocked.** `CampusService.create` refuses past the tier limit with a message
  naming the tier. A campus is the top of the whole data hierarchy, so an extra one is a step
  change in what the platform is being asked to manage.

Worked from the seed:

```
org-001  Growth   2 campuses (limit 3)   24 staff (20 included)
         35,000 + (4 × 1,000) = 39,000  +18% GST = ₹46,020
org-002  Starter  1 campus  (limit 1)     2 staff (5 included)
         12,000 flat                    +18% GST = ₹14,160
```

### Savings are proved, not billed

Nobody buys energy management without evidence it works, so the savings story matters — but
EnerTrack does not charge a share of it. `GET /api/organizations/:id/savings` compares
consumption against **the same calendar month a year earlier** and reports the difference in
kWh, rupees and kg CO₂.

Same-month year-on-year is the trick that keeps this simple: July against July needs no weather
model, because July is July. From the seed, org-001 implemented two recommendations in February
2026 and now runs 12% below the year before — ₹5.95 lakh over six months, against ₹2.34 lakh of
subscription in the same period. A month *before* those measures reads roughly flat, which is
the check that the figure tracks the work rather than the calendar.

This is deliberately lighter machinery than a billed number would need. An earlier version of
this project charged a performance share of verified savings, which required a locked baseline,
weather and occupancy normalisation, attribution windows, a four-state verification workflow
and a client counter-signature — roughly 1,800 lines whose only job was to make one revenue
stream survive a dispute. Rigour is proportional to consequence: a number that is only reported
needs none of that.

### Why it scales

- **Pricing lives in data.** Every figure is a column on `SubscriptionPlan`. A new tier is a
  row; a price change is a `PATCH` from the Super Admin's Pricing Plans tab. No redeploy.
- **One engine.** `src/modules/billing/pricing.ts` is pure — no Nest, no DI, no database — so
  every organisation and every period goes through the same testable code.

---

## Super Admin impersonation

`POST /api/users/:id/impersonate` returns another user's session so a Super Admin can see the
product as they see it, and writes an activity-log entry naming both parties. In the UI it is an
**Act as** button in User Management; a banner then follows you across every dashboard with a
way back.

**This is a support tool, not a security boundary, and the code says so.** Authorisation in this
project is a client-supplied `x-role` header with no token, so anyone who can open devtools
could already put any role into `localStorage`. The route does not grant a new capability — it
makes an existing one deliberate, logged, and one click, and shapes it so it still makes sense
once real authentication lands.

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

56 tests across three suites.

`middleware.e2e-spec.ts` (26) covers the middleware chain: role rejection, injection blocking,
the error envelope, log persistence, credential redaction, upload validation and log flushing.

`revenue.e2e-spec.ts` (30) covers the subscription model. A pure block tests `pricing.ts`
directly — the seat overage, the annual discount, and the one-line invoice a small client gets.
An HTTP block then proves the rules hold through the real pipeline: that adding a Campus Visitor
does not move the bill while adding a technician does, that the campus limit is enforced, that
savings read flat before the measures and 12% down after, and that only a Super Admin can act as
another user.

They drive real HTTP requests, so they verify the rules are actually wired up rather than only
that they work in isolation.

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
