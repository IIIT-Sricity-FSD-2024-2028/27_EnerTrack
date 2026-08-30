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

EnerTrack's own staff, who have no organisation and work across every client:

| Role | Email | Lands on |
|---|---|---|
| Super Admin | priya@enertrack.com | Organisations, pricing plans, platform revenue |
| Certified Energy Auditor | arun@enertrack.com | Audits, baselines, findings, savings verification |
| Account Officer | divya@enertrack.com | Book of accounts, billing, savings reporting |

Data resets when the backend restarts, so anything you create during a session is temporary.

---

## Roles

The platform has two sides, and this is the distinction to hold onto.

**Client side** — a tenant's own staff. Their `organization_id` is set, every query they make is
narrowed to it by `scopeToTenant()`, and nothing they do reaches another tenant.

| Role | What they do |
|---|---|
| System Administrator | Manages users, campus infrastructure and system configuration. Reviews audit logs and system-wide reports. |
| Financial Analyst | Tracks utility spend, manages invoices and their approval, and evaluates return on energy efficiency measures. |
| Technician Administrator | Triages real-time anomaly alerts and faults, then creates and assigns work orders. |
| Technician | Executes assigned work orders and records completion. |
| Sustainability Officer | Monitors emissions and energy intensity, runs conservation initiatives, and prepares compliance reports. |
| Campus Visitor | Files issue and wastage reports and tracks their progress. |

**Platform side** — EnerTrack's own staff. Their `organization_id` is null, they appear in
`PLATFORM_SIDE_ROLES`, and they work across every client.

| Role | What they do | Lands on |
|---|---|---|
| Super Admin | Provisions client organisations and users, and owns the pricing catalogue and platform revenue. | `system_admin/` (Organisations, Pricing Plans, Revenue tabs) |
| Certified Energy Auditor | Surveys a site, locks the verified baseline, records recommendations, and signs off savings. | `auditor/` |
| Account Officer | Owns the client relationship: contracts, renewals, invoicing and savings reporting. | `account_officer/` |

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
      account_officer/   Account Officer pages
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

EnerTrack charges its clients three ways. The commercial shape is on the landing page; this is
how it is implemented.

| Stream | When | Where it comes from |
|---|---|---|
| **Audit fee** | One-time, on the period the contract starts | `plan.audit_fee_base` + floor area × `plan.audit_fee_per_sqm`. Suppressed entirely once waived on signature. |
| **Monitoring subscription** | Recurring, monthly | Meters under management × `plan.price_per_meter_month`, floored at `plan.min_monthly_fee`. |
| **Performance share** | Only on savings the client has accepted | `plan.performance_share_pct` of a verified saving, capped at `plan.share_cap_pct_of_subscription` of that month's subscription fee. |

### Why it is built this way

The performance share is the hard one. "Savings" is a counterfactual — you cannot measure what a
campus *would* have consumed, only what it did — and a naive `baseline − actual` bills the client
for a mild season. Four safeguards address that, and each is a real piece of code rather than a
policy statement:

1. **Adjusted baseline.** The locked baseline stores the cooling degree days, occupancy index and
   floor area it was measured under. `adjustBaseline()` restates it for the conditions of the
   month being claimed, so only the part of a drop that weather and occupancy cannot explain is
   billable. On the seeded July 2026 example a raw comparison would claim ₹206,848; the adjusted
   figure is ₹47,473. The correction runs both ways — a hotter month raises the baseline and
   increases the claim.

2. **Attribution.** The landing page promises the share is payable *only where recommendations
   were implemented*, so a claim is scoped to findings whose status is `implemented`, using their
   `implemented_on` date and the `building_ids` they touch. Only live meters in those buildings
   count, and the baseline is pro-rated to the same set.

3. **Client counter-signature.** The auditor who locks the baseline works for the party paid a
   share of the gap. A verification therefore runs `draft → auditor-signed → client-accepted`,
   and `performanceShareLine()` returns nothing for any other state. The guard is in the pricing
   engine, not a controller, so no route can route around it. `disputed` is the exception state
   and never reaches an invoice.

4. **Cap.** The share is bounded as a multiple of the subscription fee, so an unusual season
   cannot produce an invoice a client could not have budgeted for.

### Why it scales

- **Pricing lives in data.** Every knob is a column on `SubscriptionPlan`. A new tier is a row; a
  price change is a `PATCH` from the Super Admin's Pricing Plans tab. No redeploy, no code edit.
- **One engine.** `src/modules/billing/pricing.ts` is pure — no Nest, no DI, no database — so
  every organisation and period goes through the same testable code.
- **Billing is derived, never typed.** The subscription line reads the live meter count, the
  share line reads an accepted verification which reads meter readings against a locked baseline.
  Every invoice line carries a `source_ref` naming the record it came from.

### Known trade-off

Pricing per meter gives a client a marginal reason not to add meters, which works against the
`DataSourceTier` ladder (`no-metering` → `manual-upload` → `bms-integration`) the product wants
them to climb. `min_monthly_fee` blunts it at the small end. This is a deliberate choice — it is
the model the published pricing commits to — and it is recorded here rather than left unsaid.

### The flow, end to end

```
Certified Energy Auditor          Client                    Account Officer
──────────────────────            ──────                    ───────────────
survey the site
suggest baseline from readings
lock baseline
record findings
                            →  implement measures
compute savings for a month
sign the verification
                            →  accept  (or dispute)
                                                        →  generate invoice
                                                           issue · mark paid
```

Nothing between the auditor's signature and the client's acceptance is billable. That gap is
visible as "unaccepted savings" on the Account Officer's overview, and it is deliberately the
first number that page shows.

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

62 tests across three suites.

`middleware.e2e-spec.ts` (26) covers the middleware chain: role rejection, injection blocking,
the error envelope, log persistence, credential redaction, upload validation and log flushing.

`revenue.e2e-spec.ts` (36) covers the revenue model at both levels it can go wrong. A pure block
tests `pricing.ts` directly — the baseline adjustment in both directions, the per-meter price
against its floor, the annual discount, the cap, and the refusal to bill a claim the client has
not accepted. An HTTP block then proves those rules are reachable and enforced through the real
pipeline, including that an auditor cannot accept on the client's behalf, that a client cannot
touch another tenant's claim, and that a locked baseline cannot be re-locked.

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
