# Person 5: Wastage workflow + campus occupant

Start after `feat/redux-foundation` is on `main`. Read `src/store/README.md` first.
The service-request part (PR 2) also needs **`feat/auto-dispatch` merged**:
`/service-requests/catalogue|mine|campus-issues|reports`, `plus-one` and
`CampusIssues.jsx` only exist there.

**You own:** `wastageReportsSlice`, `serviceRequestsSlice`.
**You use:** `buildingsSlice`, `usersSlice` (Person 1).
**Others use yours:** Person 3 (finance archives), Person 4 (sustainability
archives), Person 1 (technician pages use service requests). Publish your
thunk and selector names in the slice header early, and tell them.

The wastage report is one record that passes between three roles: the campus
occupant reports it, Sustainability audits it, and Finance reviews the cost.
Today each of those pages loads and patches it separately (and some through
`financeApi.js` with a `universalDB` fallback). After this, one slice serves
all of them.

## PR 1: `feat/redux-wastage`
| Slice | Path / id |
|---|---|
| `wastageReportsSlice` | `/wastage-reports`, `wastage_report_id` |

Thunks:
| Thunk | Endpoint | Store effect |
|---|---|---|
| `fetchWastageReports` / `createWastageReport` / `removeWastageReport` | CRUD | factory |
| `updateWastageReport({ report, changes })` | PATCH `/wastage-reports/:id` with `{ status, details: { ...report.details, ...detailChanges } }`. The backend **replaces** `details`, so send all of it (logic from `financeApi.updateWastageReport`) | upsert |
| `addWastageComment({ id, author, text })` | POST `/:id/comments` (the server appends, so a concurrent comment is never lost) | upsert returned report |
| `archiveWastageReport(id)` | PATCH `/:id/archive` | upsert |
| `uploadWastagePhotos({ id, files })` | `api.upload(\`/wastage-reports/${id}/photos\`, "files", files)` | upsert |
| `raiseWorkOrderFromWastage(id)` | POST `/:id/work-order` (comes with `feat/auto-dispatch`; add this thunk once that is merged) | upsert report, **and** dispatch Person 1's `fetchWorkOrders({ force: true })` |
| `fetchWastagePhotoUrl(path)` | `api.getBlobUrl(path)`. **Not stored** (blob URLs are UI state; the card revokes them) | none |

Selectors (with `createSelector`):
- `selectWastageRows(state)`: each row through `normalizeWastageReport(r, currentUser)`.
  Move that function out of `finance/financeApi.js` into your slice file, and
  tell Person 3.
- `selectMyWastageReports` (reporter = me), `selectWastageAuditQueue`
  (Sustainability's statuses), `selectWastageReviewQueue` (Finance's
  statuses), `selectArchivedWastageReports`. Copy the status filters from the
  pages that use them today.

Pages:
- `campus/Wastage.jsx`, `WastageForm.jsx`, `WastageCard.jsx`,
  `WastageArchiveCard.jsx`: create, then upload photos; archive; comment.
  `Wastage.jsx` also imports `legacy/sensorSimulator` and `legacy/notifications`.
  Those are local helpers, not server data, so leave them, but remove
  `universalDB`.
- `finance/overview/WastageReviewQueue.jsx` (+ `WastageReportCard`): review queue
  selector, `updateWastageReport`, `addWastageComment`.
- `sustainability/audit/WastageAuditQueue.jsx`, `WastageAuditCard.jsx`,
  `AuditModals.jsx`: audit queue selector, update, comment,
  `raiseWorkOrderFromWastage`. Remove `universalDB`.
- `sustainability/archives/WastageArchive.jsx`: archived selector.
- `campus/Archives.jsx`: wastage part (service-request part in PR 2).

## PR 2: `feat/redux-service-requests` (after auto-dispatch merges)
| Slice | Path / id |
|---|---|
| `serviceRequestsSlice` | `/service-requests`, `service_request_id` |

State extras: `catalogue` (list for the "report an issue" picker),
`mineIds`, `campusIssueIds` (ids that point into `entities`, so a request
updated anywhere updates everywhere).

| Thunk | Endpoint |
|---|---|
| `fetchServiceRequests` / `updateServiceRequest` | CRUD (technician side; Person 1 uses them) |
| `fetchServiceCatalogue` | GET `/service-requests/catalogue` → `catalogue` |
| `fetchMyServiceRequests` | GET `/service-requests/mine` → upsert + `mineIds` |
| `fetchCampusIssues` | GET `/service-requests/campus-issues` → upsert + `campusIssueIds` |
| `submitServiceReport(payload)` | POST `/service-requests/reports` → upsert, add to `mineIds`. It may return a "duplicate found" answer; keep returning it so `DuplicateModal` still works |
| `plusOneServiceRequest(id)` | POST `/:id/plus-one` |
| `confirmFixed(id)` / `stillBroken(id)` | POST `/:id/confirm-fixed` / `/:id/still-broken` |
| `setServiceRequestPriority({ id, level })` | PUT `/:id/priority` (Person 1's Overview uses it) |

Each POST should upsert the row it gets back. If an endpoint returns
something other than the request, refetch with `fetchServiceRequest(id)`. Check
in the Network tab and note it in the slice header.

Pages: `campus/Dashboard.jsx` (+ `ReportForm`, `ReportResult`, `MyReports`,
`AuditTimeline`, `DuplicateModal`), `campus/CampusIssues.jsx`,
`campus/Archives.jsx` (service-request part). Buildings come from
`fetchBuildings()` / `selectAllBuildings`. Keep
`serviceRequestHelpers.js` as pure helpers, or use them inside selectors.

## Acceptance checks (backend running)
- Campus Visitor: report wastage with photos, see it in my reports, comment,
  archive; report an issue, +1 an existing issue, confirm fixed / still broken.
- Sustainability Officer: audit queue, request changes, validate, raise a work
  order (it shows up for the technician without a reload of their page).
- Financial Analyst: review queue, add cost impact, comment; archived reports
  appear in Finance Archives.
- One report changed by one role is current for the next role as soon as they
  open the page.
- `grep -rn "universalDB\|financeApi" src/pages/campus src/pages/sustainability/audit src/pages/finance/overview/WastageReviewQueue.jsx` → nothing.
