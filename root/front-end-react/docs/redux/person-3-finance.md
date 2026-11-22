# Person 3: Finance

Start after `feat/redux-foundation` is on `main`. Read `src/store/README.md` first.

**You own:** `energyCostsSlice`, `financialReportsSlice`, `invoicesSlice`.
**You use:** `departmentsSlice`, `buildingsSlice`, `usersSlice` (Person 1),
`workOrdersSlice` (Person 1), `wastageReportsSlice` (Person 5).
**Not yours:** `finance/Subscription.jsx` (Person 2),
`finance/overview/WastageReviewQueue.jsx` (Person 5).

## Background: `pages/finance/financeApi.js`
Today every finance page loads through this file. It has three parts:
1. **Loaders** (`loadEnergyCosts`, `loadReports`, `loadInvoices`,
   `loadDepartmentsAndBuildings`, `loadWastageReports`) → replaced by thunks.
2. **Offline fallback** to `legacy/universalDB` → **delete it**. It never runs:
   its `isNetworkError` checks for the message "Cannot reach server", but the
   API client says "Can't reach the backend…". The offline banner already
   tells people when the server is down.
3. **`normalize*` functions** (snake_case → the camelCase shape the pages use)
   → keep them, but call them inside **selectors**, so the store holds raw rows.

By the end, `financeApi.js` holds only the `normalize*` helpers (or is
deleted, with them moved into the slice files). Person 5 imports
`normalizeWastageReport`. Agree with them whether it moves to
`wastageReportsSlice.js`.

## PR 1: `feat/redux-finance-costs`
| Slice | Path / id | Notes |
|---|---|---|
| `energyCostsSlice` | `/energy-costs`, `energy_cost_id` | plain CRUD. Selector `selectEnergyCostRows = createSelector([selectAllEnergyCosts, selectAllDepartments, selectAllBuildings], (costs, depts, bldgs) => costs.map(r => normalizeCost(r, namesFrom(depts, bldgs))))` |

Pages:
- `finance/Costs.jsx` + `costs/CostFormModal`, `CostViewModal`,
  `CostBreakdown`: `createEnergyCost`, `updateEnergyCost({ id, changes })`,
  `removeEnergyCost(id)`. **Delete the `offline` / `saveLocalFinance` branches.**
- `finance/Overview.jsx` + `overview/SummaryCards`, `DepartmentCostBars`,
  `CostImpactModal`: read `selectEnergyCostRows` and report selectors.
  Totals and variance should be selectors, not `useMemo` in the page, when
  more than one component needs them.

## PR 2: `feat/redux-finance-reports-invoices`
| Slice | Path / id | Extra thunks |
|---|---|---|
| `financialReportsSlice` | `/financial-reports`, `financial_report_id` | archive = `updateFinancialReport({ id, changes: { archived: true } })`, no extra thunk needed. Selectors: `selectReportRows` (normalized), `selectActiveReports`, `selectArchivedReports` |
| `invoicesSlice` | `/invoices`, `invoice_id` | `uploadInvoiceDocument({ id, file })` → `api.upload(\`/invoices/${id}/document\`, "file", file)`, upsert the returned invoice. `fetchInvoiceDocumentUrl(id)` → `api.getBlobUrl(\`/invoices/${id}/document\`)`. This one is **not stored** (a blob: URL is UI state); the modal revokes it. Selectors: `selectInvoiceRows`, `selectActiveInvoices`, `selectArchivedInvoices` |

Pages:
- `finance/Reports.jsx` + `reports/ReportFormModal`, `ReportViewModal`,
  `ReportsTable`, `MetricsCalculator`. The `callApi(...)` helper becomes
  `dispatch(thunk).unwrap()` in try/catch.
- `reports/InvoicesSection.jsx`, `InvoiceFormModal`, `InvoiceViewModal`,
  `AttachDocumentModal` (upload thunk), `InvoicePdfModal` (blob-URL thunk).
- `finance/Archives.jsx`: archived selectors for reports and invoices, plus
  wastage from Person 5's `selectArchivedWastageReports` (or whatever name they
  give it).

## PR 3: `feat/redux-finance-maintenance-approvals`
`finance/overview/MaintenanceApprovals.jsx` loads `/work-orders` and PATCHes
approvals. Switch it to Person 1's `fetchWorkOrders` and
`updateWorkOrder({ id, changes })`. If it also PATCHes another path (check
`update(path, id, body)`), ask the slice owner for that thunk. Merge this after
Person 1's work-orders PR.

## Cleanup in your PRs
- Remove `universalDB` imports from every finance file.
- Remove `isNetworkError` from `financeApi.js`. Pages that need it import it
  from `api/client.js`.
- `components/NotificationBell.jsx` (finance's own local-only bell, using
  `legacy/notifications`): leave it alone unless Person 2's notifications slice
  replaces it. Coordinate with them.

## Acceptance checks (Financial Analyst, backend running)
- Costs: add / edit / delete. Totals, variance and status badges are unchanged.
- Reports: create, edit, archive, delete. ROI / NPV / payback show as before.
- Invoices: create, edit, archive, delete, attach PDF, view PDF.
- Archives page shows archived reports, invoices and wastage.
- Overview cards and department bars match the Costs page.
- No `api/client`, `universalDB` or loader functions left in `src/pages/finance`
  (except `isNetworkError` imports).
