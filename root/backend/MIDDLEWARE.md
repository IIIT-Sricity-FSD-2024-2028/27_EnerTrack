# Middleware — EnerTrack Backend

Reference for the middleware layer: what exists, where it is registered, the order it
executes in, and how to verify each piece is doing its job.

Stack: NestJS 10 on Express 4. All paths below are relative to `root/backend`.

---

## 1. The five required types

| Requirement | Implementation | Where it is registered |
|---|---|---|
| **Logging** | Morgan (third-party) + `LoggerMiddleware` (custom) | `main.ts` / `app.module.ts` |
| **Error handling** | `AllExceptionsFilter`, `MulterExceptionFilter` | `main.ts` / per-route `@UseFilters` |
| **File upload** | Multer configs + `FileInterceptor` | `core/middleware/file-upload.middleware.ts` |
| **Security** | Helmet + express-rate-limit + `SecurityMiddleware` | `main.ts` / `app.module.ts` |
| **Router-level** | `UploadAuditMiddleware`, `InvoiceAccessMiddleware` | `app.module.ts` / `invoices.module.ts` |

---

## 2. Execution order

Registration order is execution order. This sequence was verified against the NestJS
source (`@nestjs/core/nest-application.js`, `init()`), not assumed:

```
HTTP request
  │
  ├─ 1. morgan('combined')          → logs/access.log        application-level
  ├─ 2. morgan('dev')               → console                application-level
  ├─ 3. helmet                      → security headers       application-level
  ├─ 4. express-rate-limit          → 1000 req / 15 min      application-level
  │
  ├─ 5. body-parser                 → populates req.body     (Nest registers this)
  │
  ├─ 6. SecurityMiddleware          → role + XSS checks      module, "*"
  ├─ 7. TenantMiddleware            → opens x-org-id scope   module, "*"
  ├─ 8. LoggerMiddleware            → req/res bodies         module, "*" minus /api/docs
  ├─ 9. UploadAuditMiddleware       → upload trail           module, 3 routes  ← router-level
  ├─10. InvoiceAccessMiddleware     → invoice trail          feature module    ← router-level
  │
  ├─11. RolesGuard                  → RBAC
  ├─12. TransformInterceptor        → { success, data, timestamp }
  ├─13. ValidationPipe              → DTO validation
  ├─14. Controller
  │
  └─ AllExceptionsFilter            → on any throw, at any stage above
```

Two consequences worth knowing:

- **Morgan is deliberately first**, so requests rejected by helmet or the rate limiter
  still appear in the access log. A 429 is exactly the request you most want a record of.
- **Middleware runs before guards.** A request that `RolesGuard` will reject with a 403
  still passes through every middleware first. The audit logs rely on this: an audit
  trail containing only successful requests would be useless for spotting probing.

---

## 3. Log files

All under `logs/`, created automatically at startup. Gitignored.

| File | Written by | Write timing |
|---|---|---|
| `access.log` | Morgan | streamed, rotated daily by rotating-file-stream, last 7 kept |
| `custom-debug-YYYY-MM-DD.log` | `LoggerMiddleware` | buffered, flushed every 5s |
| `error-YYYY-MM-DD.log` | `AllExceptionsFilter` + rate limiter | buffered; **5xx and 429 written immediately** |
| `security-threats-YYYY-MM-DD.log` | `SecurityMiddleware` | written immediately |
| `upload-audit-YYYY-MM-DD.log` | `UploadAuditMiddleware` | buffered, flushed every 5s |
| `invoice-access-YYYY-MM-DD.log` | `InvoiceAccessMiddleware` | buffered, flushed every 5s |

### Writing at regular intervals

`core/utils/log-writer.ts` owns every custom log write. Entries accumulate in memory and are
flushed to disk **on a 5-second `setInterval`**, rather than being written one at a time as
they occur. One timer serves the whole application.

Buffering is what makes "stored in files at regular intervals" literally true, and it takes
blocking synchronous disk I/O off the request path. The obvious risk — losing buffered
entries in a crash — is bounded deliberately:

- **5xx errors, 429s and blocked security threats bypass the buffer entirely.** If the
  process is about to die, the record of why is already on disk. A 500 flushed five seconds
  later is a 500 that never gets written.
- The buffer force-flushes at 500 pending entries, so a traffic burst cannot grow memory.
- `SIGINT`, `SIGTERM` and `beforeExit` all flush, so an ordinary shutdown loses nothing.
- The timers are `unref()`d, so they never hold the process open.

You can watch the interval work. Make one request against a running server and watch the
debug log: it stays at 0 bytes for about four seconds, then the batch lands.

### Retention

The same writer sweeps files older than 7 days, hourly and once at startup. Retention
previously lived in `LoggerMiddleware` and matched only `custom-debug-*`, so the error,
security, upload-audit and invoice-access logs grew without limit. It now covers every
prefix in `MANAGED_PREFIXES`, and deliberately ignores `.log` files it does not own.

Daily rotation needs no scheduler: the filename is resolved at flush time from the current
date, so entries buffered at 23:59:59 and flushed at 00:00:02 land in the new day's file.

### Credential redaction

Anything written to a log passes through `core/utils/redact.ts` first. `POST
/api/users/login` carries a plaintext password in its body, and without this the logger
wrote it to disk in the clear. Field names are matched case-insensitively as substrings,
so `password`, `newPassword`, `confirm_password`, `accessToken`, `api_key`,
`authorization` and `cookie` are all masked:

```
  Request Body:
    {
      "email": "aadi@gmail.com",
      "password": "[REDACTED]"
    }
```

The redactor returns a copy rather than editing in place — masking the request body
directly would replace the real password before the login service could check it.

---

## 4. Router-level middleware

### The distinction

- **Application-level** — `app.use()` in `main.ts`. Runs on every request, no exceptions.
- **Router-level** — bound to particular routes via `configure()` in a module.

Registering with `.forRoutes("*")` uses the router-level *API* but produces
application-level *behaviour*, because the wildcard matches everything. The two
middlewares below are bound to specific routes, so their selectivity is observable.

### `UploadAuditMiddleware` — bound by path + method

Registered in `app.module.ts`, bound to three routes:

```ts
consumer.apply(UploadAuditMiddleware).forRoutes(
  { path: "meter-readings/upload",      method: RequestMethod.POST },
  { path: "invoices/:id/document",      method: RequestMethod.POST },
  { path: "wastage-reports/:id/photos", method: RequestMethod.POST },
);
```

Records who uploaded, from where, the declared payload size, and the outcome. The size is
labelled **Declared** because middleware runs before Multer parses the body — the only
figure available is the client's own `content-length` header, which is a claim, not a
verified fact.

### Upload validation runs in three layers

| Layer | Checks | Can it be forged? |
|---|---|---|
| multer `fileFilter` | file extension + declared MIME type | **Yes** — both come from the client |
| `assertFileSignature` | the file's actual leading bytes | No — content cannot lie about itself |
| multer `limits` | size and file count | No — enforced while streaming |

The first layer is cheap and rejects most mistakes before a byte is written. The second is
the one that stops an attack: rename `payload.exe` to `invoice.pdf`, set
`Content-Type: application/pdf`, and layer one waves it through — but a real PDF starts with
`%PDF` and a Windows executable starts with `MZ`, and no amount of renaming changes that.

The signature check cannot live in the `fileFilter`, because multer runs that *before* any
bytes are written and it only ever sees declared metadata. It therefore runs in the
controller after the file lands, and deletes the rejected file rather than merely refusing it.

CSV has no magic number, so the check is inverted there: reject anything containing a NUL
byte in the first 512 bytes, which text files never have and binaries almost always do.

### `InvoiceAccessMiddleware` — bound by controller, from a feature module

Registered in `invoices.module.ts`, not `app.module.ts`:

```ts
consumer.apply(InvoiceAccessMiddleware).forRoutes(InvoicesController);
```

Two things this demonstrates. First, `AppModule` is not special — any module implementing
`NestModule` can bind its own middleware, and auditing access to financial records is an
invoices concern, so it is declared where it belongs. Second, `forRoutes()` accepts a
controller class: Nest reads that controller's route decorators and binds one route per
handler, so a route added later is covered automatically with no path string to maintain.

### Why the other three use `"*"`

Scope is chosen per middleware, not by habit:

- **SecurityMiddleware and TenantMiddleware** must see every request. Narrowing a security
  check creates a hole; narrowing the tenant scope leaks data across organisations.
- **LoggerMiddleware** wants everything except the Swagger assets. Loading `/api/docs`
  pulls several static files and each was writing an 80-column block to disk, burying real
  API traffic. It uses `.exclude("api/docs", "api/docs/(.*)")`.

Router-level is not "better" than application-level. It is the right tool when a
middleware is about specific routes, and the wrong tool when it is not.

### Path conventions — both fail silently if wrong

| API | Convention | Correct | Wrong |
|---|---|---|---|
| `forRoutes()` | relative; Nest prepends the global `api` prefix | `invoices/:id/document` | `api/invoices/:id/document` |
| `exclude()` | absolute; matched against the raw URL | `api/docs` | `docs` |

Neither throws on a bad path. The middleware simply never runs, or never gets excluded.

### Path matching depends on whether a method is given

| Written as | Binds through | Matching |
|---|---|---|
| `forRoutes('invoices')` | `app.use` | **prefix** — everything under `/api/invoices` |
| `forRoutes({path:'invoices', method: POST})` | `app.post` | **exact** |
| `forRoutes(InvoicesController)` | one binding per handler | exact, per route |

A bare string is given internal method `-1`, which is absent from Nest's method map, so it
falls through to `app.use` and matches by prefix. Supplying a method switches to
`app.post`, which matches exactly — which is why the upload paths above are written out in
full, including the `:id` segment.

---

## 5. Express middleware categories

The five *functional* requirements above map onto Express's five *structural* middleware
categories, all of which are present:

| Express category | In this codebase |
|---|---|
| Application-level | `app.use(morgan/helmet/rateLimit)` in `main.ts` |
| Router-level | `UploadAuditMiddleware`, `InvoiceAccessMiddleware` |
| Error-handling | `AllExceptionsFilter`, `MulterExceptionFilter` |
| Built-in | `express.json` / `express.urlencoded`, registered by Nest — see below |
| Third-party | morgan, helmet, express-rate-limit, multer |

**Built-in.** There is no explicit `app.use(express.json())` because Nest registers the body
parsers itself during `app.init()` — `@nestjs/core/nest-application.js` calls
`registerParserMiddleware()` before module middleware, which is exactly why `req.body` is
already populated by the time `SecurityMiddleware` inspects it. Passing
`NestFactory.create(AppModule, { bodyParser: false })` would disable it.

**`express.static` is deliberately not used.** Serving `uploads/` statically would be the
obvious way to make files downloadable, and it is the wrong one: a static handler serves any
file under the folder to anyone who guesses its name, which would defeat the per-tenant
separation. Uploaded files are served through `GET /api/invoices/:id/document` instead, which
resolves the path from the database record rather than the URL and checks tenant ownership
first.

---

## 6. Verifying it works

From `root/backend`, after `npm install`:

```bash
npx tsc --noEmit                              # must be silent
npm run start:dev                             # then http://localhost:3000/api/docs
npx jest --config ./test/jest-e2e.json        # 26 tests
```

### Router-level proof

The demonstration is a contrast — same middleware, four requests, only one of which
triggers it:

| Request | Entries added to `upload-audit-*.log` |
|---|---|
| `GET /api/invoices` | 0 |
| `POST /api/meter-readings` — same module, different route | 0 |
| `GET /api/invoices/:id/document` — right path, wrong method | 0 |
| `POST /api/meter-readings/upload` | **1** |

Row three is the sharpest: the identical URL to an upload route, but a `GET`, and nothing
fires — because the binding specifies `method: RequestMethod.POST`. That contrast is not
producible with a wildcard.

### Other checks

| What | How | Expected |
|---|---|---|
| Security headers | `curl -D- http://localhost:3000/api/invoices -H "x-role: System Administrator"` | `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, no `X-Powered-By` |
| Role validation | same with `-H "x-role: Hacker"` | 403 JSON envelope + entry in `security-threats-*.log` |
| XSS blocking | POST `{"vendor":"<script>alert(1)</script>"}` to `/api/invoices` | 400 + threat log entry |
| Error persistence | `curl http://localhost:3000/api/invoices/nope -H "x-role: System Administrator"` | 404 JSON + entry in `error-*.log` |
| Password redaction | POST to `/api/users/login`, then grep the debug log for the password | zero matches; `[REDACTED]` present |
| Password not exposed | `GET /api/users` | no `password` field on any record |
| Rate limiting | 1001 requests in a window | 429 + entry in `error-*.log` |
| Interval writes | one request, then watch `custom-debug-*.log` | 0 bytes for ~4s, then the batch appears |
| Retention | back-date a managed log file, call the sweep | deleted; unmanaged `.log` files untouched |
| Swagger exclusion | note debug log size, load `/api/docs`, check again | unchanged |
| Upload validation | Swagger → any upload route: valid file → 201; wrong extension → 400; no file → 400 | as stated |
| Forged file type | rename an `.exe` to `.pdf`, set `Content-Type: application/pdf`, upload | 400 "not a real PDF file"; nothing left in `uploads/` |

---

## 7. Known limitations

Worth stating plainly rather than being caught out by:

- **Signature checking covers PDF, JPEG and PNG only.** Those are the formats the three
  upload routes accept. A format with no fixed magic number would need a different strategy;
  CSV already uses one (binary-content detection rather than signature matching).
- **Uploads are separated by tenant folder, not access-controlled at the filesystem level.**
  Tenant ownership is enforced in the service layer on both upload and download.
- **There is no upload UI.** `api.upload()` exists in the frontend client, but no page
  calls it yet — uploads are demonstrated through Swagger.
- **The in-memory database resets on restart**, so uploaded files outlive the records that
  reference them.
- **Buffered log entries can be lost in an abrupt crash** — up to 5 seconds' worth. Server
  errors, rate-limit rejections and security threats bypass the buffer for this reason, so
  the entries that matter most are never at risk.
- **Read endpoints are role-scoped, not owner-scoped.** A Campus Visitor can list service
  requests and work orders because their dashboard needs to show their own; the filtering to
  "mine" happens client-side. Owner-level filtering would need a caller identity beyond the
  `x-role` / `x-org-id` headers the API currently takes.
- **Three `*_archives.html` pages still read a legacy `enertrack_universal_v1` localStorage
  store** rather than the API, so they populate only after a flow that writes that key has
  been used. Pre-existing, unrelated to middleware.
- **The six B2B roles** (Super Admin, Certified Energy Auditor, Account Officer, Economic
  Buyer, Facility Manager, Department Head) have no dashboard pages, so signing in as one
  lands on the landing page. The API supports them; the UI does not yet.
