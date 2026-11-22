# Redux migration: team plan

**Goal:** every piece of server data in the React app lives in a Redux Toolkit
slice with CRUD thunks, and every page reads it from the store
(`useSelector`) and changes it through `dispatch`. No page calls
`api/client.js` directly when we are done.

**How:** read [`src/store/README.md`](../../src/store/README.md) first. It
has the factory, the naming rules and the page pattern every slice and page
must follow.

## Who does what

| Person | Area | Slices you own | Plan |
|---|---|---|---|
| 1 (lead) | Foundation, session, shared reference data, technician + dispatch | auth, ui, users, organizations, campus, buildings, departments, meters, alerts, faults, workOrders, meterReadings, dispatch | [person-1-foundation-technician.md](person-1-foundation-technician.md) |
| 2 | Admin + Auditor | subscriptionPlans, subscriptions, platformInvoices, auditRequests, energyAudits, notifications | [person-2-admin-auditor.md](person-2-admin-auditor.md) |
| 3 | Finance | energyCosts, financialReports, invoices | [person-3-finance.md](person-3-finance.md) |
| 4 | Sustainability | initiatives, sustainabilityReports, sustainabilityMetrics | [person-4-sustainability.md](person-4-sustainability.md) |
| 5 | Wastage workflow + campus occupant | wastageReports, serviceRequests | [person-5-wastage-campus.md](person-5-wastage-campus.md) |

## Order

1. **`feat/redux-foundation` (Person 1) merges first.** It adds the store, the
   factory, the session slice, the offline banner slice, and the six shared
   slices. Everyone else branches from `main` *after* it lands.
2. **`feat/auto-dispatch` must also be merged** before anyone touches the
   dispatch / service-request / notification pages. Those pages and endpoints
   (`/dispatch/*`, `/service-requests/catalogue|mine|campus-issues|reports`,
   `NotificationBell`, `DispatchInbox`, `CampusIssues`) only exist on that
   branch. Persons 2, 3 and 4 can start without it; Person 5's campus part
   waits for it.
3. Persons 2–5 work in parallel, **one PR per slice group** (each plan lists
   its PRs). Small PRs, each one leaves the app working.
4. Person 1 does the final cleanup PR: an ESLint rule that forbids
   `api/client` in pages, the toast systems merged into `ui`, legacy imports
   removed.

## Shared rules (short version)
- Branch: `feat/redux-<area>-<what>`, e.g. `feat/redux-finance-invoices`.
- Only add your own line(s) to `reducers` in `src/store/index.js`, inside
  your block. Nothing else in `store/index.js`, `createCrudSlice.js`,
  `apiThunk.js` or `actions.js`. Ask Person 1.
- Need a thunk in someone else's slice? Message them, or send a small PR to
  their slice file. Never copy the fetch into your page.
- Shared lists (users, organizations, campus, buildings, departments, meters):
  `dispatch(fetchUsers())` and `useSelector(selectAllUsers)` from Person 1's
  slices. Never `api.get("/users")` again.
- Keep the backend's snake_case rows in the store; reshape for the UI in a
  `createSelector` in your slice file.
- Before each PR: `npm run lint`, `npm run build`, sign in as each affected
  role with the backend running, and do every create / edit / delete on the
  pages you changed.

## Definition of done (whole project)
- `grep -rn "api/client" src/pages src/layout` finds only `isNetworkError` imports.
- `grep -rn "legacy/universalDB" src/pages` finds nothing.
- Every list page loads from the store, and edits update the list with no full re-fetch.
- Sign-out and act-as never show the previous person's data.
