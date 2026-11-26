# Person 1 (lead): foundation, session, shared data, technician + dispatch

## PR 1: `feat/redux-foundation` ✅ (done, lands first)
- `@reduxjs/toolkit` + `react-redux`; `<Provider>` in `main.jsx`.
- `store/index.js`, `actions.js` (`resetData`), `apiThunk.js`, `createCrudSlice.js`.
- `authSlice`: session in the store, localStorage still written first (the
  API client reads the token there). `useAuth()` keeps its old shape;
  `AuthContext.jsx` / `context.js` removed. Auth and account pages dispatch
  `signIn`, `signUpCampus`, `requestAudit`, `changePassword`, `updateDetails`,
  `deleteAccount`.
- `uiSlice.backend`: the offline banner now reads from the store.
- Shared CRUD slices: `users` (+ `bulkCreateUsers`, `generatePassword`),
  `organizations` (+ `fetchOrganizationSavings`), `campus`, `buildings`,
  `departments`, `meters`.
- Session expiry (401) dispatches `logout`, which clears every data slice.

## PR 2: `feat/redux-technician` ✅ (done; branched from the foundation, with `main` merged in)
Combined the planned "alerts/faults" and "work orders" PRs into one, because
the pages share most of their lists.

Shared additions (everyone can use them, see `src/store/README.md`):
- `loadState.js`: `status` stays `succeeded` while a refresh runs
  (`refreshing: true`), so polling never blanks a page.
- `createResourceSlice.js`: slices for one computed value (not a list).
- `useLiveData(LOADS)`: load + poll every 30 s, returns
  `{ loading, ready, error, reload, updatedAt }`.

| Slice | Path / id | Extra thunks |
|---|---|---|
| `alertsSlice` | `/alerts`, `alert_id` | `decideAlert({ id, decision, notes, asset, faultType })` → `{ alert, fault }`; alert and new fault update in place |
| `faultsSlice` | `/faults`, `fault_id` | none; notes/status use `updateFault` |
| `meterReadingsSlice` | `/meter-readings`, `reading_id` | none |
| `workOrdersSlice` | `/work-orders`, `work_order_id` | `createWorkOrderFromRequest({ body, requestId })`, `closeWorkOrder(id)` (closes order + its service request, fault, alert). Old `workorders/closeWorkOrder.js` deleted |
| `dispatchSlice` | `dispatchQueue`, `myJobs`, `availability` (resource slices) | coordinator: `sendFault`, `assignTicket`, `setJobDeadline`, `decideExtension`, `sweepTimeouts`; technician: `setAvailability`, `jobAction({ id, action, body })`. Each reloads the lists it affects |
| `serviceRequestsSlice` (base, **owner: Person 5**) | `/service-requests`, `service_request_id` + `serviceCatalogue` | `setServiceRequestPriority`, `fetchServiceCatalogue` |
| `notificationsSlice` (base, **owner: Person 2**) | `/notifications`, `notification_id` | `selectAllNotifications` (newest first), `selectUnreadCount` |

Pages migrated: `technician/Overview`, `Alerts`, `Maintenance`, `WorkOrders`;
`technician-jr/Overview`, `WorkOrders`, `DispatchInbox`. None import
`api/client` any more.

Verified against the running backend: every load, decide (monitor + fault),
fault notes, sendFault → new work order, closeWorkOrder (order closed, fault
and alert resolved), sweep, availability toggle, and a sign-in switch
clearing the previous role's data.

## PR 4: `feat/redux-cleanup` ✅ (done)
- ESLint `no-restricted-imports`: the default `api` import from `api/client`
  fails lint everywhere outside `src/store` and `src/api`. Named helpers
  (`isNetworkError`, `pingBackend`, `SESSION_EXPIRED_EVENT`) stay allowed.
- The last direct API calls moved into slices:
  - technician `Expenses`: `fileExpenseBill`, `resubmitExpenseBill`,
    `withdrawExpenseBill`, `attachExpenseBillFiles`, `removeExpenseBillAttachment`
  - food weigh-ins: new `foodWasteLogsSlice` (`fetchFoodWasteSummary`,
    `logFoodWaste`), used by `FoodLogCard`, the officer's food cases and the
    target modal
  - waste signals: `setSignalWatched`, `openWastageCase`, `checkWastageTarget`
  - finance `InitiativesSection`: the initiatives and buildings slices
  - `useTeams()`: `fetchServiceCatalogue`
  - photos and receipts: `store/files.js` `fetchFileUrl(path)`
- Pure helpers the store used from page folders moved to `store/derive/`
  (`finance.js`, `auditImpact.js`); `financeUtils` re-exports the shared ones.
- `src/legacy/` deleted (nothing imported it). `npm test` runs vitest.
- Not done, on purpose: merging the four toast systems. They're UI only
  (no server data) and each area styles its own; that's a design change,
  not a Redux one.

## Reviewing teammates' PRs: checklist
- No `api.` in pages; no `useState` holding server lists.
- Thunks use `apiThunk`; slice registered in its owner's block in `store/index.js`.
- Mutations update in place (no `fetchX({force:true})` after the slice's own CRUD).
- Selectors reshape; reducers store raw rows.
