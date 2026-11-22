# `src/store`: Redux conventions

All server data lives here. Pages **never** call `api/client.js` themselves. They
read with `useSelector` and change data with `dispatch`.

```
store/
  index.js            the store: register your reducer here (one line)
  actions.js          resetData: empties every data slice on sign-out / act-as
  apiThunk.js         createAsyncThunk that keeps isNetworkError on errors
  createCrudSlice.js  factory: one resource → slice + CRUD thunks + selectors
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
  name: "invoices",            // = key in store/index.js = state.invoices
  path: "/invoices",           // REST base path
  idKey: "invoice_id",         // primary key the backend sends
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
  update: updateInvoice,     // dispatch(updateInvoice({ id, changes }))
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

Then add one line to `reducers` in `store/index.js` (in your own block).

### Naming (keep it identical everywhere)
| thing | name |
|---|---|
| slice file | `<resource>Slice.js` (camelCase plural: `workOrdersSlice.js`) |
| state key | same as slice `name`: `state.workOrders` |
| thunks | `fetchWorkOrders`, `fetchWorkOrder`, `createWorkOrder`, `updateWorkOrder`, `removeWorkOrder`, then verbs for extras: `archiveInvoice`, `decideAlert` |
| selectors | `selectAllWorkOrders`, `selectWorkOrderById`, `selectWorkOrdersStatus`, `selectWorkOrdersError`, and derived ones `selectOpenWorkOrders`... |

### Rules
- **Store raw backend rows** (snake_case). Reshape for the UI in a selector
  built with `createSelector`, never in the reducer. Selectors live in the
  slice file.
- **One owner per slice file.** If you need a thunk in someone else's slice, ask
  them, or send them a small PR.
- **Never `api.*` in a page.** If a page needs an endpoint, add a thunk.
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
  action on a *different* endpoint changed this list server-side.
- `.unwrap()` turns the thunk result back into a normal promise that throws
  `{ message, isNetworkError }`, so existing try/catch + toast code keeps working.
- Do not re-fetch after create/update/remove. The slice already has the saved row.

## 3. Session (`authSlice`)

Pages keep using `useAuth()` (same shape as before: `user`, `role`,
`adoptSession`, `logout`, `impersonate`, `stopImpersonating`, ...).
Sign-in / sign-up / password / account changes are thunks in
`slices/authSlice.js` (`signIn`, `signUpCampus`, `requestAudit`,
`changePassword`, `updateDetails`, `deleteAccount`).

On sign-out, session expiry, or act-as, `resetData` empties every data slice
automatically. You don't need to handle it.

## 4. Before you open a PR
- `npm run lint` and `npm run build` pass.
- `grep -rn "api/client" <your page folders>` only finds `isNetworkError` imports.
- Redux DevTools (browser extension) shows `x/fetchAll/pending → fulfilled`,
  and a create/update/delete changes the list without a second fetch.
- Sign out, sign in as a different role: no data from the first person shows.
