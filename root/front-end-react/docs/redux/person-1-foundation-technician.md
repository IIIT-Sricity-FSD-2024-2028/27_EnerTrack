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

## PR 2: `feat/redux-technician-alerts-faults` (after auto-dispatch merges: `/alerts/:id/decide` lives there)
| Slice | Path / id | Extra thunks |
|---|---|---|
| `alertsSlice` | `/alerts`, `alert_id` | `decideAlert({ id, ...body })` → `POST /alerts/:id/decide` |
| `faultsSlice` | `/faults`, `fault_id` | — (status changes use `updateFault`) |
| `meterReadingsSlice` | `/meter-readings`, `reading_id` | — |

Pages: `technician/Alerts.jsx` (+ `alerts/*`), `technician/Maintenance.jsx`
(+ `maintenance/*`). Buildings, meters and users come from the shared slices.

## PR 3: `feat/redux-technician-work-orders` (after auto-dispatch merges)
| Slice | Path / id | Extra thunks |
|---|---|---|
| `workOrdersSlice` | `/work-orders`, `work_order_id` | `closeWorkOrder(wo)`: PATCH the work order to `closed`, then the linked service request, fault and alert, and update all four slices. Replaces `technician/workorders/closeWorkOrder.js` |
| `dispatchSlice` | not CRUD; state `{ queue, mine, availability }` | `fetchDispatchQueue` (GET `/dispatch/queue`), `fetchMyJobs` (GET `/dispatch/mine`), `fetchAvailability` / `setAvailability` (GET/PUT `/dispatch/availability`), `sendFault` (POST `/dispatch/faults/:id/send`), `assignTicket` (POST `/dispatch/tickets/:id/assign`), `sweepTimeouts` (POST `/dispatch/sweep`), `setDeadline` (PUT `/dispatch/work-orders/:id/deadline`), `decideExtension` (POST `.../extension/decide`), and the junior technician's `jobAction({ id, action, body })` for `acknowledge|decline|start|finish|made-safe|resume|needs-parts|extension` |

Each dispatch action answers with the changed work order. The slice upserts it
into `workOrders`: `dispatchSlice` dispatches `workOrderUpserted`, or
workOrders listens with `addMatcher(isFulfilled(...dispatchActions))`.

Pages: `technician/Overview.jsx` (+ `overview/*`), `technician/WorkOrders.jsx`
(+ `workorders/*`), `technician-jr/Overview.jsx`, `WorkOrders.jsx`,
`DispatchInbox.jsx`, `JrActionPanel.jsx`.
`serviceRequests` belongs to Person 5. Use their `selectAllServiceRequests`,
`updateServiceRequest` and `setServiceRequestPriority` (agree on the names
with them early).

## PR 4: `feat/redux-cleanup` (last)
- ESLint `no-restricted-imports`: block `**/api/client` (except `isNetworkError`,
  `pingBackend`) and `**/legacy/universalDB` under `src/pages/**` and `src/layout/**`.
- Merge the three toast systems (finance `ToastProvider`, technician
  `useToast`, admin `addToast`) into `ui.toasts` + one `<Toasts />`.
- Delete unused `legacy/*` files; final role-by-role smoke test.

## Reviewing teammates' PRs: checklist
- No `api.` in pages; no `useState` holding server lists.
- Thunks use `apiThunk`; slice registered in its owner's block in `store/index.js`.
- Mutations update in place (no `fetchX({force:true})` after the slice's own CRUD).
- Selectors reshape; reducers store raw rows.
