# EnerTrack: Campus Energy and Renewables Management Platform

**Multi-tenant NestJS API and React single-page app** · Team 27_EnerTrack · Domain: Sustainability and Green Economy

EnerTrack lets organisations (universities, polytechnics, corporate campuses) manage energy,
water, cost and sustainability data across their sites. It models the hierarchy
(campus, building, department, meter, reading) and runs four workflows on top of it: wastage
reporting, maintenance, finance and sustainability reporting. EnerTrack itself is the vendor:
it sells subscriptions, sends certified auditors to survey a site, and invoices the client.

The front end is a React 19 SPA (`root/front-end-react`). The back end is a NestJS 10 API
(`root/backend`) with strict per-tenant isolation, signed-token authentication, role-based
access control and a layered middleware pipeline. The original vanilla HTML/JS front end
(`root/front-end`) is frozen and kept as a reference.

---

## Quick start

### Prerequisites

- Node.js 18 or later (developed on Node 22)
- npm 9 or later

### 1. Start the back end (NestJS)

```bash
cd root/backend
npm install
npm run start:dev
```

- API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`
- Data lives in memory and is re-seeded on every start. Anything created in a session is
  temporary, and `start:dev` restarts (and re-seeds) whenever a source file is saved.

Optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | random per start | Signing key. Set it to keep sessions across restarts. |
| `JWT_EXPIRES_IN` | `8h` | How long a sign-in lasts. |
| `FRONTEND_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173` | Comma-separated origins allowed by CORS. |
| `AUTH_RATE_MAX` | `20` | Password attempts per IP per 15 minutes. |

### 2. Start the front end (React + Vite)

In a second terminal:

```bash
cd root/front-end-react
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run dev
```

Open the address Vite prints (normally `http://localhost:5173`). `VITE_API_BASE` in `.env`
points at the back end; without it the app falls back to `http://localhost:3000/api`.

Other scripts: `npm run lint`, `npm run build`, `npm run format:check`.

### 3. Sign in with a demo account

Passwords are stored bcrypt-hashed and follow the pattern `Name@123`. Every account below
exists after each start.

**Organisation: Sri City Institute of Technology (Growth tier)**

| Role | Email | Password | Lands on |
|---|---|---|---|
| Organization Admin | aadi@gmail.com | `Aadi@123` | `/admin/users` |
| Financial Analyst | husaam@gmail.com | `Husaam@123` | `/finance/overview` |
| Technician Administrator | chirag@gmail.com | `Chirag@123` | `/technician/overview` |
| Technician | teja@gmail.com | `Teja@123` | `/technician-jr/overview` |
| Sustainability Officer | viksa@gmail.com | `Viksa@123` | `/sustainability/overview` |
| Campus Visitor (shown as "Occupant") | trishank@gmail.com | `Trishank@123` | `/campus/dashboard` |

**Organisation: Coastal Valley University (Starter tier). The B2B client roles live here**

| Role | Email | Password | Lands on |
|---|---|---|---|
| Organization Admin | sunita@coastalvalley.edu | `Sunita@123` | `/admin/users` |
| Facility Manager | kavya@coastalvalley.edu | `Kavya@123` | `/technician/overview` |
| Economic Buyer | rahul@coastalvalley.edu | `Rahul@123` | `/finance/subscription` |

**EnerTrack staff (no organisation, work across every client)**

| Role | Email | Password | Lands on |
|---|---|---|---|
| Super Admin | priya@enertrack.com | `Priya@123` | `/admin/users` |
| Certified Energy Auditor | arun@enertrack.com | `Arun@123` | `/auditor/overview` |

Two further pieces of seed data are worth knowing about:

- **Two pending organisation registrations** (Meridian Institute of Technology, Lakeside
  Medical College) wait on `/admin/registrations`. Sign in as the Super Admin to approve or
  reject one.
- **Department Head** is a defined role (see below) but has **no seeded account** and does not
  appear in the User Management role dropdown. It can only be created through the API.

> **Legacy front end.** `root/front-end` still runs (`npx serve -l 5500 .`) but is frozen. See
> `root/front-end/FROZEN.md`. Fix bugs in the React pages instead.

---

## Table of contents

1. [Quick start](#quick-start)
2. [System architecture and multi-tenancy](#system-architecture-and-multi-tenancy)
3. [Roles and access](#roles-and-access)
4. [Request lifecycle](#request-lifecycle)
5. [Middleware deep-dive](#middleware-deep-dive)
6. [Authentication, guards and tenancy](#authentication-guards-and-tenancy)
7. [React architecture and portals](#react-architecture-and-portals)
8. [Workflows](#workflows)
9. [Revenue model](#revenue-model)
10. [API conventions](#api-conventions)
11. [Tests](#tests)
12. [Repository layout](#repository-layout)
13. [Documentation and team](#documentation-and-team)

---

## System architecture and multi-tenancy

EnerTrack is a multi-tenant SaaS product. Each client organisation is a logically separate
tenant; EnerTrack's own staff sit above them.

```
                 ┌──────────────────────────────────────────────────────────┐
                 │                  EnerTrack (the vendor)                  │
                 │   Super Admin · Certified Energy Auditor (no org id)     │
                 │ Tier catalogue · contracts · platform invoices · audits  │
                 └────────────────────────────┬─────────────────────────────┘
                                              │ cross-tenant view
              ┌───────────────────────────────┼───────────────────────────────┐
              ▼                               ▼                               ▼
 ┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
 │ org-001 Sri City Inst.   │   │ org-002 Coastal Valley   │   │ org-003 / org-004        │
 │ Growth tier              │   │ Starter tier             │   │ prospects                │
 ├──────────────────────────┤   ├──────────────────────────┤   ├──────────────────────────┤
 │ Organization Admin       │   │ Organization Admin       │   │ Organization Admin       │
 │ Financial Analyst        │   │ Facility Manager         │   │                          │
 │ Technician (Admin)       │   │ Economic Buyer           │   │                          │
 │ Sustainability Officer   │   │                          │   │                          │
 │ Campus Visitor           │   │                          │   │                          │
 └──────────────────────────┘   └──────────────────────────┘   └──────────────────────────┘
```

### Tenancy principles

- **Every tenant-owned record carries `organization_id`.** Users, campuses, buildings, meters,
  alerts, work orders, costs, invoices, reports and so on.
- **The tenant comes from the token, never from the client.** `AuthMiddleware` derives the
  caller's organisation from their current account and discards any `x-org-id` the browser sent.
- **Reads are narrowed by `scopeToTenant(records)`** (`core/tenancy/tenant-context.ts`):
  - acting inside a tenant gives that tenant's records only;
  - EnerTrack staff with no tenant get the cross-tenant view;
  - anyone else with no tenant sees **nothing** (fail closed).
- **Single records are guarded by `assertTenantOwns(record)`**, which returns "not found" for
  another tenant's id rather than revealing that the id exists.
- **The context is carried in `AsyncLocalStorage`** (`TenantMiddleware`), so services read it
  without every signature threading an organisation id through.
- **The tier catalogue is the one global entity.** Subscription plans have no `organization_id`
  and must never be scoped.

### Two sides of the product

| | Client side | Platform side |
|---|---|---|
| Roles | the nine roles of a tenant's own staff | Super Admin, Certified Energy Auditor |
| `organization_id` | set | `null` |
| Scope | one tenant | every tenant |
| Owns | the campus: meters, alerts, work orders, costs, sustainability data | the business: tiers, contracts, billing, audits |

`PLATFORM_SIDE_ROLES` in `database.service.ts` lists the two platform roles. Organization Admin
is deliberately **not** in it: it is a client's own admin, so its tenant boundary cannot depend
on seed data.

---

## Roles and access

There are **11 roles** in the `UserRole` enum.

### Core roles (own dashboard)

| Role | What they do |
|---|---|
| Organization Admin | Manages users, campus infrastructure and the organisation's plan. Reviews and answers the auditor's proposal. |
| Financial Analyst | Tracks utility spend, manages invoices and approvals, evaluates return on efficiency measures. |
| Technician Administrator | Triages anomaly alerts and faults, creates and assigns work orders. |
| Technician | Executes assigned work orders and records completion. |
| Sustainability Officer | Monitors emissions and energy intensity, runs conservation initiatives, prepares compliance reports, reviews wastage reports. |
| Campus Visitor (shown as **Occupant**) | Reports issues and wastage and tracks them. The only role that can create its own account. |

### EnerTrack staff

| Role | What they do |
|---|---|
| Super Admin | Approves or rejects organisation registrations, provisions organisations and users, owns pricing plans and revenue, can **Act as** any user. The only role that may give anyone the Certified Energy Auditor role. |
| Certified Energy Auditor | Surveys a site and writes findings and a tier recommendation. Nothing they record feeds an invoice. |

### The three B2B client roles

These come from the SRS. They have **no dashboard of their own**: each one borrows the
permissions and the screens of an existing role.

| Role | Backend: acts as | Front end: area | Lands on | Seeded? |
|---|---|---|---|---|
| Economic Buyer | Financial Analyst | finance | `/finance/subscription` (they sign the cheque, so they see the plan, not the costs) | yes, org-002 |
| Facility Manager | Technician Administrator | technician | `/technician/overview` | yes, org-002 |
| Department Head | Campus Visitor | campus | `/campus/dashboard` | no |

How the borrowing works:

- **Backend, `ROLE_EQUIVALENTS`.** `RolesGuard` expands the caller's role into itself plus the
  roles it stands in for, so "Facility Manager" satisfies any route that asks for
  "Technician Administrator". This let the SRS role model land without editing about 127
  `@Roles` decorators. Where a route should name a B2B role explicitly (subscriptions, plans,
  organisation reads, energy audits, service requests), the controller lists it.
- **Front end, `ROLE_AREA` and `ROLE_HOME` in `routes.js`.** Eleven roles collapse onto seven
  sidebar areas, the same collapsing the backend does.
- **The two platform roles use the table too:** Super Admin maps to Organization Admin and
  Certified Energy Auditor to Technician, so legacy routes keep working for them.

| `ROLE_EQUIVALENTS` entry | Also satisfies routes that ask for |
|---|---|
| Super Admin | Organization Admin |
| Certified Energy Auditor | Technician |
| Economic Buyer | Financial Analyst |
| Facility Manager | Technician Administrator |
| Department Head | Campus Visitor |

Legacy roles have no entry and expand to themselves, so their behaviour is unchanged.

### Who can create which account

| Account | Created by |
|---|---|
| Campus Visitor | Themselves, on the sign-up form; the organisation is found from the email domain |
| Organization Admin of a new organisation | The Super Admin, by approving a registration |
| Every other client role | The Organization Admin, on `/admin/users` (temporary password, forced change on first sign-in) |
| Certified Energy Auditor, Super Admin | EnerTrack staff only. An Organization Admin gets 403 on create, PATCH, PUT and bulk import, and the option is hidden in their dropdown. |

---

## Request lifecycle

Registration order is execution order. Every request passes through these stages:

```
 HTTP request
    │
 1. ▼ morgan('combined')      → logs/access.log (rotated daily, 7 kept)       Express
 2. ▼ morgan('dev')           → console                                       Express
 3. ▼ helmet                  → security headers                              Express
 4. ▼ rate limiter            → 1000 requests / 15 min / IP                   Express
 5. ▼ sign-in limiter         → 20 attempts / 15 min / IP on 5 password routes
 6. ▼ body parser             → req.body (registered by Nest)
    │
 7. ▼ AuthMiddleware          → verify Bearer token, rebuild x-role / x-org-id   Nest, "*"
 8. ▼ SecurityMiddleware      → role enum check + XSS payload scan               Nest, "*"
 9. ▼ TenantMiddleware        → open the AsyncLocalStorage tenant scope          Nest, "*"
10. ▼ LoggerMiddleware        → request and response bodies (not /api/docs)      Nest, "*"
11. ▼ UploadAuditMiddleware   → upload trail                                     router-level, 2 routes
12. ▼ InvoiceAccessMiddleware → invoice access trail                             router-level, controller
    │
13. ▼ RolesGuard              → @Roles with ROLE_EQUIVALENTS expansion → 403
14. ▼ TransformInterceptor    → { success, data, timestamp }
15. ▼ ValidationPipe          → whitelist + forbidNonWhitelisted DTOs → 400
16. ▼ Controller → Service    → scopeToTenant / assertTenantOwns
    │
    └─ AllExceptionsFilter    → one error envelope, logged to error-*.log
```

Two consequences:

- **Morgan is first on purpose**, so requests rejected by helmet or the rate limiter still reach
  the access log. A 429 is the request you most want a record of.
- **Middleware runs before guards.** A request that `RolesGuard` will reject with 403 still
  passes every middleware, so the audit trail records probing, not only successes.

---

## Middleware deep-dive

Seven kinds are implemented. The reference with verification steps for each is in
[`root/backend/MIDDLEWARE.md`](root/backend/MIDDLEWARE.md). That file predates the signed-token
change, so read the section below for the current order.

| Type | Implementation | Scope |
|---|---|---|
| Authentication | `AuthMiddleware` | every route |
| Logging | Morgan, `LoggerMiddleware` | application; every route but `/api/docs` |
| Security | Helmet, express-rate-limit, `SecurityMiddleware` | application and every route |
| Tenancy | `TenantMiddleware` | every route |
| Error handling | `AllExceptionsFilter`, `MulterExceptionFilter` | global, plus the upload routes |
| File upload | Multer configs, file-signature check | per route |
| Router-level | `UploadAuditMiddleware`, `InvoiceAccessMiddleware` | specific routes only |

### AuthMiddleware (`core/middleware/auth.middleware.ts`)

Establishes who is calling, from a signed token and nothing else.

1. Deletes any `x-role`, `x-org-id` and `x-user-id` the client sent.
2. With no `Authorization` header the request carries no role: protected routes answer 403 and
   only the public routes work.
3. With a header, verifies the HS256 token. A forged, expired, malformed or **revoked** token
   is 401.
4. Looks the user up and sets the three headers from their **current** account. A role change
   takes effect on the next request.

Sessions are revoked when an account is deleted, or its role, organisation or password
changes: `database.sessionsRevokedAt[user]` is compared with the token's issue time in
milliseconds.

### SecurityMiddleware (`core/middleware/security.middleware.ts`)

1. **Header integrity.** `x-role`, if present, must be a value of the `UserRole` enum.
2. **Payload scan.** Body, query and URL params are scanned recursively for inline `<script>`,
   `javascript:` URIs, `on*=` handlers, `<iframe>`, `<object>`/`<embed>` and `data:text/html`.
3. **Threat log.** Every block is written immediately to `security-threats-*.log`, with
   credentials redacted.

### TenantMiddleware (`core/tenancy/tenant.middleware.ts`)

Reads the (now trusted) `x-role` and `x-org-id`, computes `isPlatformSide`, and runs the rest of
the request inside an `AsyncLocalStorage` scope. See [Tenancy principles](#tenancy-principles).

### LoggerMiddleware, Morgan and the log files

All under `root/backend/logs/` (gitignored, created at startup). Passwords and tokens are
masked before anything reaches a file.

| File | Contents | Written |
|---|---|---|
| `access.log` | Standard HTTP access log (Morgan) | streamed, rotated daily, last 7 kept |
| `custom-debug-*.log` | Request and response bodies with timing | buffered, flushed every 5 s |
| `error-*.log` | Every handled error, stack traces for 5xx, rate-limit rejections | buffered; 5xx and 429 immediately |
| `security-threats-*.log` | Blocked roles and injection attempts | immediately |
| `upload-audit-*.log` | Every file upload attempt and its outcome | buffered, flushed every 5 s |
| `invoice-access-*.log` | Access to financial records | buffered, flushed every 5 s |

`core/utils/log-writer.ts` owns every custom write: one 5-second `setInterval` serves the whole
application, and files rotate daily and are swept after 7 days.

### Rate limiting

- **General:** 1000 requests per 15 minutes per IP. Dashboards fire 10 to 12 calls per page
  load, so a lower limit locked ordinary users out. Swagger assets are skipped.
- **Sign-in limiter:** 20 attempts per 15 minutes per IP across `login`, `signup`,
  `change-password`, `update-details` and `delete-account`, the five routes that check or set a
  password.
- A 429 is answered at the Express layer, before Nest's filter exists, so `main.ts` writes it to
  the error log itself.

### File upload

| Route | Accepts | Limit |
|---|---|---|
| `POST /invoices/:id/document` | PDF | 15 MB, 1 file |
| `POST /wastage-reports/:id/photos` | JPEG, PNG | 5 MB each, up to 4 |

Extension, declared MIME type **and the file's magic bytes** are all checked
(`core/utils/file-signature.ts`), so a renamed executable is rejected.

### Error envelope

Successes and failures share one shape, so the front end has a single format to handle.

```json
{ "success": true, "data": { }, "timestamp": "2026-08-28T09:00:00.000Z" }
```

```json
{
  "success": false, "statusCode": 404,
  "message": "Invoice with ID abc not found", "error": "Not Found",
  "path": "/api/invoices/abc", "method": "GET",
  "timestamp": "2026-08-28T09:00:00.000Z"
}
```

---

## Authentication, guards and tenancy

### Tokens and passwords

- `POST /api/users/login` returns the user plus an HS256 JWT (`sub`, `role`, `org`,
  millisecond issue time). `JWT_SECRET` and `JWT_EXPIRES_IN` are configurable.
- Passwords are hashed with bcrypt (`core/auth/passwords.ts`). Hashing is idempotent, because a
  registration's password is hashed on submit and then handed on unchanged to the new user.
- An administrator-issued or reset password sets `must_change_password`. The React guard then
  allows nothing but `/change-password` until it is replaced.
- Deleting an account, or changing its role, organisation or password, signs out every other
  session it had.

### Public routes

Everything is protected unless a route has no `@Roles` decorator. A test fails if any route
other than these is reachable without a token:

`GET /api`, `GET /api/subscription-plans/public`, `POST /api/audit-requests`,
`POST /api/users/login`, `POST /api/users/signup`, `POST /api/users/change-password`,
`POST /api/users/update-details`, `POST /api/users/delete-account`.

The last three prove identity with the account's password instead of a token.

### RolesGuard (`core/guards/roles.guard.ts`)

1. Reads `@Roles(...)` from the handler or class. None means public.
2. Reads the trusted `x-role`; absent gives 403 "Role header 'x-role' is required".
3. Expands it through `ROLE_EQUIVALENTS` and allows the request if any expanded role is listed.
4. Otherwise 403 "Role '…' is not authorized for this action".

### Super Admin impersonation

`POST /api/users/:id/impersonate` needs a Super Admin token and returns a session token for
another user. It writes an activity-log entry naming both parties (the Super Admin comes from the
token, not the request body). In the UI it is an **Act as** button in User Management, with a
confirm popup; a banner then follows you across every dashboard with a way back.

### Organisation registration

A new client does not create an account directly.

1. Someone fills in **Register your organisation** (public `POST /api/audit-requests`). This
   only files a *pending* request; the chosen password is stored hashed.
2. The **Super Admin** reviews it on `/admin/registrations` and approves or rejects it with a
   note. Nobody else can decide, and the decision is recorded against the signed-in caller.
3. On approval the organisation and its Organization Admin are created. Until then, signing in
   answers "pending" or "rejected" instead of "wrong password".

### My account (`/account`, every role)

| Card | Back-end route |
|---|---|
| Change name and phone (needs the current password) | `POST /api/users/update-details` |
| Change password | `POST /api/users/change-password` |
| Delete account (password confirmation popup) | `POST /api/users/delete-account` |

The only Organization Admin of an organisation, the only Super Admin, or the only Certified
Energy Auditor cannot delete their account (409), so nothing is left without an owner.

---

## React architecture and portals

React 19 with Vite 8 and react-router-dom 7. No state, form or UI library.

### How the app is put together

```
main.jsx ── BrowserRouter ── AuthProvider ── BackendStatusBanner ── App
App.jsx
 ├─ public: /  /auth  /change-password  (+ redirects from the old page URLs)
 ├─ <RequireRole>                         signed in? password still temporary?
 │   └─ <DashboardLayout>                 sidebar + header + <Outlet />
 │        └─ /account                     every role
 ├─ <RequireRole area="…"> per area       right area for this role?
 │   └─ <DashboardLayout> → area pages
 └─ *  →  NotFound
```

| Piece | Role |
|---|---|
| `routes.js` | Every path (`PATHS`), the role to landing map, the role to area map, and the sidebar items per area. No URL is typed anywhere else. |
| `auth/` (`context.js`, `AuthContext.jsx`, `useAuth.js`) | Session via the Context API: `user`, `login`, `logout`, `adoptSession`, `impersonate`, `stopImpersonating`. Memoised so consumers do not re-render needlessly. |
| `api/client.js` | One `fetch` wrapper: attaches the bearer token, unwraps `{ data }`, clears the session and signals on an expired token, and reports a network failure to the offline banner. |
| `layout/` | `RequireRole` (guard), `DashboardLayout` (shell, My account and Sign Out links, "Act as" banner), `Sidebar` (sticky, links filtered by role). |
| `ui/` | `FormField`, `BackendStatusBanner` (re-checks the API while it is offline), `PhotoViewer`. |
| `styles/` | One stylesheet per area. Page CSS is nested under a wrapper class so it cannot leak into other pages. |

Forms are controlled everywhere. One `handleChange` per form reads `e.target.name`, and live
validation uses `pages/auth/validators.js`, the twin of the back end's `common/patterns.ts`, so
the browser and the server agree on what is valid. A blank field stays quiet until submit.

### Portals

| Area | Roles | Pages (route) |
|---|---|---|
| Public | everyone | Landing `/`, Sign in / register / campus sign-up `/auth`, Change password `/change-password` |
| Account | every signed-in role | `/account` |
| Admin | Organization Admin, Super Admin | Users `/admin/users` · Organisations, Registrations, Pricing Plans, Revenue (Super Admin) · Audit and Proposal, Your Plan (Organization Admin) · Infrastructure `/admin/infrastructure` |
| Finance | Financial Analyst, Economic Buyer | Overview, Reports and Impact, Utility Costs, Your Subscription, Archives (`/finance/…`) |
| Sustainability | Sustainability Officer | Overview, Monitoring, Reporting, Initiatives, Archives (`/sustainability/…`) |
| Technician | Technician Administrator, Facility Manager | Overview, Alerts, Fault Detection, Work Orders (`/technician/…`) |
| Technician (junior) | Technician | Overview, My Work Orders (`/technician-jr/…`) |
| Auditor | Certified Energy Auditor | Overview, Audits and Recommendations (`/auditor/…`) |
| Campus | Campus Visitor, Department Head | Report an Issue, Report Wastage, My Archives (`/campus/…`) |
| 404 | anyone | `*` |

A signed-in person who opens another area is redirected to their own landing page.

---

## Workflows

**1. Wastage (Campus Visitor to Sustainability Officer).** A visitor files a report with up to
four photos. The Sustainability Officer reviews it in the audit queue; handled reports move to
archives.

**2. Alert to fault to work order (Technician Administrator to Technician).** An alert exists
against a meter (`open → acknowledged → resolved`) with a chat thread. The administrator
raises and assigns a fault, creates a work order from the fault or from a service request, and
the technician moves it `new → inprogress → review → approval → closed`.

**3. Finance (Financial Analyst).** Energy costs per building and department are compared with
budget (`under-budget`, `on-budget`, `over-budget`). Utility invoices run
`pending → approved → paid` with `overdue` as the exception state; each can carry a PDF.
Financial reports record ROI and NPV.

**4. Sustainability (Sustainability Officer).** Metrics (energy, water, emissions per period)
feed monitoring; initiatives go `proposed → approved → in-progress → completed` or `rejected`;
a report pipeline produces `SustainabilityReport` archives with a KPI block.

**5. Audit and proposal (Certified Energy Auditor to Organization Admin).** The auditor
schedules a site audit, records findings (`proposed → accepted → implemented` or `rejected`)
and a tier recommendation with a monthly estimate from the pricing engine. The audit moves
`scheduled → in-progress → proposed`; the Organization Admin accepts, declines or asks for
changes (`accepted`, `declined`, `changes-requested`).

**6. Platform billing (Super Admin).** Each organisation has one subscription (tier, cycle,
renewal). Platform invoices (`draft → issued → paid`, `overdue`) are computed from the tier
and the live headcount.

---

## Revenue model

One sentence: **each tier includes a number of staff seats and a number of campuses; go over the
seat allowance and you pay per extra seat.**

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

An invoice has at most two lines. The tier comes from the contract and the headcount from the
live user list, so nothing on a bill is typed in by hand, and every line carries a `source_ref`
back to the record that produced it.

**A billable seat is any user in the organisation except a Campus Visitor.** A campus may have
thousands of students filing wastage reports, and billing per student would punish the client for
opening the product up to the people who spot faults first.

Both limits are enforced:

- **Seats are metered.** Going over bills an overage rather than refusing the user.
- **Campuses are blocked.** `CampusService.create` refuses past the tier limit with a message
  naming the tier.

Worked from the seed:

```
org-001  Growth   2 campuses (limit 3)   24 staff (20 included)
         35,000 + (4 × 1,000) = 39,000  +18% GST = ₹46,020
org-002  Starter  1 campus  (limit 1)     3 staff (5 included)
         12,000 flat                    +18% GST = ₹14,160
```

**Savings are proved, not billed.** `GET /api/organizations/:id/savings` compares consumption
with the same calendar month a year earlier and reports kWh, rupees and kg CO₂. Same-month
year-on-year needs no weather model. From the seed, org-001 runs 12% below the year before
(₹5.95 lakh over six months against ₹2.34 lakh of subscription). An earlier version charged a
share of verified savings; that needed a locked baseline, normalisation, a verification workflow
and a client counter-signature (about 1,800 lines), so it was removed. Rigour is proportional to
consequence.

**Why it scales.** Pricing lives in data (a new tier is a row, a price change is a `PATCH` from
the Pricing Plans page), and `modules/billing/pricing.ts` is pure (no Nest, no database), so
every organisation and period goes through one testable engine.

---

## API conventions

- **202 endpoints in 26 modules** (the `billing` module is the pricing engine only and has no
  routes). Browse and try them at `/api/docs`.
- **Global prefix** `/api`. Every success is wrapped by `TransformInterceptor`.
- **Auth:** `Authorization: Bearer <token>`. The `x-role`, `x-org-id` and `x-user-id` headers are
  internal: they are rebuilt from the token on every request and a client cannot set them.
- **Validation:** DTOs with `class-validator`; unknown fields are rejected (400).
- **Data:** in-memory `DatabaseService`, seeded at startup, so there is no migration step.

| Group | Modules |
|---|---|
| Platform and billing | organizations, subscription-plans, subscriptions, energy-audits, audit-requests, platform-invoices, billing (engine) |
| People | users, notifications, activity-logs |
| Infrastructure | campus, buildings, departments, meters, meter-readings |
| Operations | wastage-reports, alerts, faults, service-requests, work-orders |
| Finance | energy-costs, invoices, financial-reports |
| Sustainability | sustainability-metrics, initiatives, sustainability-reports |

---

## Tests

```bash
cd root/backend
npx jest --config ./test/jest-e2e.json     # 210 tests, 12 suites
npx tsc --noEmit                            # type check

cd ../front-end-react
npm run lint
npm run build
```

The back-end suites drive real HTTP requests through the whole pipeline, so they prove the rules
are wired up rather than only correct in isolation.

| Suite | Covers |
|---|---|
| `middleware` | Chain behaviour: role rejection, injection blocking, error envelope, log persistence, credential redaction, upload validation, log flushing |
| `security` | Forged `x-role` and `x-org-id` ignored; garbage, wrong-key, expired and unsigned tokens; hashed passwords; session revocation; the exact list of public routes |
| `auth` | Sign-in and first-login password change |
| `account` | Update details, delete account and its last-owner safeguards, platform-role assignment rule |
| `audit-requests` | Organisation registration and Super Admin decision |
| `revenue` | `pricing.ts` directly, then through HTTP: seat overage, campus limit, savings, impersonation |
| `organizations-delete`, `campus-create-rules`, `budget-rules`, `sustainability`, `wastage-visitor`, `app` | Their respective modules |

---

## Repository layout

```
root/
  backend/
    src/
      core/
        auth/          token.ts (sign and verify JWT), passwords.ts (bcrypt)
        database/      seeded in-memory store, the UserRole enum, ROLE_EQUIVALENTS
        decorators/    @Roles
        filters/       AllExceptionsFilter, MulterExceptionFilter
        guards/        RolesGuard
        interceptors/  TransformInterceptor (response envelope)
        middleware/    auth, security, logger, file upload, upload audit
        tenancy/       per-request organisation scope
        utils/         log writer, redaction, file signatures, budget rules
      modules/         26 feature modules: controller, service, module, DTOs
      modules/billing/ pricing.ts, the revenue model as pure functions
      main.ts          Express-level middleware, global pipes/guards/filters, CORS, Swagger
      app.module.ts    middleware registration
    test/              end-to-end suites
    docs/swagger.json  regenerated on every start
    MIDDLEWARE.md      middleware reference
  front-end-react/     the application
    src/
      main.jsx  App.jsx  routes.js
      auth/  api/  layout/  ui/
      pages/           auth, account, landing, admin, finance, sustainability,
                       technician, technician-jr, auditor, campus, NotFound
      styles/
  front-end/           original vanilla front end, frozen
Database/              SQL schema and ER diagram
Figma Designs/         UI mockups per role
```

---

## Documentation and team

| File | What it covers |
|---|---|
| `README.md` | This file |
| `root/backend/MIDDLEWARE.md` | Middleware reference, log files, verification steps |
| `root/front-end-react/CONTRIBUTING.md` | How the React port is organised |
| `root/front-end/FROZEN.md` | Why the vanilla front end is frozen |
| `PROJECT_OVERVIEW.md` | Architecture analysis written earlier (some parts predate the React port and signed tokens) |
| `DomainExpertInteraction.md` | Notes from the domain expert interview |
| `Database/dbschema.sql` | SQL schema |
| `SRS.pdf` | Software requirements specification |

**Team:** Aadithya, Husaam, Chirag, Vijaya Teja and Viksa.
Built for the Full Stack Development course at IIIT Sri City.
