# `src/store`: Redux conventions

All server data lives here. Pages **never** call `api/client.js` themselves. They
read with `useSelector` and change data with `dispatch`.

```
store/
  store.js            the store: register your reducer here (one line)
  actions.js          resetData: empties every data slice on sign-out / act-as
  apiThunk.js         createAsyncThunk that keeps isNetworkError on errors
  createCrudSlice.js  factory: one resource → slice + CRUD thunks + selectors
  createResourceSlice.js  factory: one computed value (summary, queue, ...)
  loadState.js        status / refreshing / error every slice carries
  useLiveData.js      hook: load some slices on open and poll them
  files.js            fetchFileUrl(path): a protected file as a blob URL
  derive/             pure functions selectors use (finance row shapes, ...)
  slices/             one file per backend resource
```

## 1. Add a slice for a resource

```js
// store/slices/invoicesSlice.js
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

// Extra (non-CRUD) endpoints: one apiThunk each, declared before the slice.
export const archiveInvoice = apiThunk("invoices/archive", (id) =>
  api.patch(`/invoices/${id}`, { archived: true }),
);

const invoices = createCrudSlice({
  name: "invoices", // = key in store/store.js = state.invoices
  path: "/invoices", // REST base path
  idKey: "invoice_id", // primary key the backend sends
  extraReducers: (builder, { adapter }) => {
    builder.addCase(archiveInvoice.fulfilled, (state, { payload }) => {
      adapter.upsertOne(state, payload); // backend returns the saved row
    });
  },
});

export const {
  fetchAll: fetchInvoices,
  fetchOne: fetchInvoice,
  create: createInvoice,
  update: updateInvoice, // dispatch(updateInvoice({ id, changes }))
  remove: removeInvoice,
} = invoices.thunks;

export const {
  selectAll: selectAllInvoices,
  selectById: selectInvoiceById,
  selectStatus: selectInvoicesStatus,
  selectError: selectInvoicesError,
} = invoices.selectors;

export default invoices.reducer;
```

Then add one line to `reducers` in `store/store.js` (in your own block).

### Naming (keep it identical everywhere)

| thing      | name                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| slice file | `<resource>Slice.js` (camelCase plural: `workOrdersSlice.js`)                                                                                        |
| state key  | same as slice `name`: `state.workOrders`                                                                                                             |
| thunks     | `fetchWorkOrders`, `fetchWorkOrder`, `createWorkOrder`, `updateWorkOrder`, `removeWorkOrder`, then verbs for extras: `archiveInvoice`, `decideAlert` |
| selectors  | `selectAllWorkOrders`, `selectWorkOrderById`, `selectWorkOrdersStatus`, `selectWorkOrdersError`, and derived ones `selectOpenWorkOrders`...          |

### Rules

- **Store raw backend rows** (snake_case). Reshape for the UI in a selector
  built with `createSelector`, never in the reducer. Selectors live in the
  slice file.
- **One owner per slice file.** If you need a thunk in someone else's slice, ask
  them, or send them a small PR.
- **Never `api.*` in a page.** If a page needs an endpoint, add a thunk.
  Lint enforces it: importing the default `api` from `api/client` fails
  anywhere outside `src/store` and `src/api`.
- **The store never imports from `src/pages`.** A pure helper both need
  (row shapes, status rules) lives in `store/derive/`, and the page imports
  it from there.
- **No local copies of server data.** `useState` is for UI only: modals,
  filters, search text, form fields, busy flags.
- Endpoints that only return a one-off value and are not app data (e.g.
  `POST /users/generate-password`) are still thunks, they just don't store
  anything.
- Shared lists (users, organizations, campus, buildings, departments, meters)
  belong to Person 1. Import their selectors; never fetch them again yourself.
- Use `apiThunk`, never bare `createAsyncThunk`, or `isNetworkError(err)` stops
  working.

## 2. Use it in a page

```jsx
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { isNetworkError } from "../../api/client";
import {
  fetchInvoices, updateInvoice, selectAllInvoices, selectInvoicesStatus,
} from "../../store/slices/invoicesSlice";

export default function Invoices() {
  const dispatch = useDispatch();
  const invoices = useSelector(selectAllInvoices);
  const status = useSelector(selectInvoicesStatus);   // idle|loading|succeeded|failed

  useEffect(() => {
    dispatch(fetchInvoices());          // cached: no request if already loaded
  }, [dispatch]);

  async function save(id, changes) {
    try {
      await dispatch(updateInvoice({ id, changes })).unwrap();
      toast("Saved.");                   // list already updated in place
    } catch (err) {
      toast(isNetworkError(err) ? "Backend offline." : err.message, "error");
    }
  }

  if (status === "loading" && invoices.length === 0) return <Spinner />;
  ...
}
```

- `dispatch(fetchX())` on mount is cheap: the factory skips it once loaded.
  Use `dispatch(fetchX({ force: true }))` for a Refresh button, or after an
  action on a _different_ endpoint changed this list server-side.
- `.unwrap()` turns the thunk result back into a normal promise that throws
  `{ message, isNetworkError }`, so existing try/catch + toast code keeps working.
- Do not re-fetch after create/update/remove. The slice already has the saved row.

### Loading status

Every data slice carries `status`, `refreshing` and `error` (see
`store/loadState.js`):

| `status`    | meaning                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `idle`      | never loaded (also right after sign-out)                                                               |
| `loading`   | first load running, nothing to show yet: show a spinner                                                |
| `succeeded` | data is there. **Stays so while a refresh runs** (`refreshing: true`), so a poll never blanks the page |
| `failed`    | first load failed, nothing to show                                                                     |

`error` is the last failed load's message, even when old data is still shown.

### One computed value, not a list: `createResourceSlice`

For endpoints that return a single object (a summary, the dispatch queue,
someone's availability, a catalogue) use `createResourceSlice` instead:

```js
const queue = createResourceSlice({
  name: "dispatchQueue",
  path: "/dispatch/queue",
  initialData: { queued: [], team_status: [] },
});
export const { fetch: fetchDispatchQueue } = queue.thunks;
export const { selectData: selectDispatchQueue } = queue.selectors;
```

Same caching and `{ force: true }` as `fetchAll`. See
`slices/dispatchSlice.js` for examples.

### Pages that poll: `useLiveData`

Most dashboards load several lists and refresh them every 30 s. Instead of
a `useEffect` + `setInterval` per page:

```jsx
// module level: the same array on every render
const LOADS = [fetchAlerts, fetchFaults, fetchMeters, fetchBuildings];

function Alerts() {
  const alerts = useSelector(selectAllAlerts);
  const { loading, ready, error, reload, updatedAt } = useLiveData(LOADS);
  if (loading) return <Spinner />;
  if (!ready) return <Retry message={error} onRetry={reload} />;
  ...
}
```

`useLiveData(LOADS, { intervalMs: 0 })` loads once with no polling. See
`pages/technician/*` for real uses.

### Actions with server-side side effects

When one request changes several records on the server (dispatch ranking,
an approval that creates an organisation, ...), don't guess the result in
the reducer. Have the thunk reload the affected lists with
`{ force: true }` once it succeeds (see `coordinatorAction` in
`slices/dispatchSlice.js`). The page then only dispatches and shows a toast.

### Messages: `useToast`

```jsx
import { useToast } from "../../ui/useToast";
const showToast = useToast();
showToast("Saved.", "success"); // success | error | warning | info
```

One list for the whole app (`state.ui.toasts`), drawn once by
`ui/Toaster.jsx`. Don't keep toasts in component state.

## 3. Session (`authSlice`)

Pages keep using `useAuth()` (same shape as before: `user`, `role`,
`adoptSession`, `logout`, `impersonate`, `stopImpersonating`, ...).
Sign-in / sign-up / password / account changes are thunks in
`slices/authSlice.js` (`signIn`, `signUpCampus`, `requestAudit`,
`changePassword`, `updateDetails`, `deleteAccount`).

On sign-out, session expiry, or act-as, `resetData` empties every data slice
automatically. You don't need to handle it.

## 4. Before you open a PR

- `npm run lint`, `npm run build` and `npm test` pass. (Lint already fails
  on a direct API call in a page.)
- Redux DevTools (browser extension) shows `x/fetchAll/pending → fulfilled`,
  and a create/update/delete changes the list without a second fetch.
- Sign out, sign in as a different role: no data from the first person shows.
