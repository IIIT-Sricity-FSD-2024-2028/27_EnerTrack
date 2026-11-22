# Person 4: Sustainability

Start after `feat/redux-foundation` is on `main`. Read `src/store/README.md` first.

**You own:** `initiativesSlice`, `sustainabilityReportsSlice`,
`sustainabilityMetricsSlice`.
**You use:** `usersSlice` (Person 1) for names, and `wastageReportsSlice`
(Person 5) on the Archives page.
**Not yours:** `sustainability/audit/*` and `sustainability/archives/*`
(wastage, Person 5).

These pages are the largest in the app (`Initiatives.jsx` ~900 lines,
`Report.jsx` ~900, `Archives.jsx` ~760, `Monitoring.jsx` ~680). Keep the UI as
it is. Only the data plumbing changes.

## PR 1: `feat/redux-sustainability-initiatives`
| Slice | Path / id | Notes |
|---|---|---|
| `initiativesSlice` | `/initiatives`, `initiative_id` | plain CRUD: `createInitiative`, `updateInitiative({ id, changes })`, `removeInitiative(id)`. Selectors: `selectActiveInitiatives`, `selectCompletedInitiatives` (archive), `selectInitiativesByStatus` (Kanban columns) |

Pages:
- `sustainability/Initiatives.jsx`:
  - It starts from `INITIAL_DEMO_INITIATIVES` and replaces them when the API
    answers. **Remove the demo seed.** The store starts empty, and the page
    shows its loading / empty state from `selectInitiativesStatus`.
  - The on-track toggle, status move, edit and delete (lines ~191, 226, 315,
    370, 412) all become `updateInitiative` / `removeInitiative`.
  - Optimistic updates: today the page changes local state first and rolls
    back on error (`prevInit`). Either drop that (the slice updates as soon as
    the server answers, which is fast enough), or keep it with a small reducer
    `initiativePatchedLocally` and roll back on `.rejected`. Dropping it is
    simpler, and that is the recommendation.
- `sustainability/Overview.jsx`: initiatives from the store (active count).

## PR 2: `feat/redux-sustainability-reports`
| Slice | Path / id | Extra thunks |
|---|---|---|
| `sustainabilityReportsSlice` | `/sustainability-reports`, `report_id` | `generateSustainabilityReport(params)` → POST `/sustainability-reports/generate`. It returns a **preview**, which is not saved. Store it in `state.sustainabilityReports.draft` (cleared by a `draftCleared` reducer). Saving the draft is the normal `createSustainabilityReport(payload)`. |

Pages:
- `sustainability/Report.jsx`: generate → `draft` from the store; save →
  `createSustainabilityReport`; leaving the page → `draftCleared`.
- `sustainability/Archives.jsx`: reports tab, `removeSustainabilityReport`;
  initiatives tab, `selectCompletedInitiatives` + `removeInitiative`; wastage
  tab, Person 5's selector + their `removeWastageReport`. Users for names
  come from `fetchUsers()` / `selectAllUsers`.

## PR 3: `feat/redux-sustainability-metrics`
| Slice | State | Thunks |
|---|---|---|
| `sustainabilityMetricsSlice` | not an entity list: `{ summary, summaryStatus, series: { [queryKey]: data }, seriesStatus }` | `fetchMetricsSummary()` → GET `/sustainability-metrics/summary` (Overview cards). `fetchMetricsSeries({ from, to, granularity })` → GET `/sustainability-metrics/summary?from=&to=&granularity=`, stored under `queryKey = \`${from}|${to}|${granularity}\``, so switching back to an old range is instant. Selector `selectMetricsSeries(state, config)` |

Build this slice with `createSlice` + `apiThunk` directly, not `createCrudSlice`
(there is no CRUD). Use the `condition` option to skip a key that is
already loaded.

Pages:
- `sustainability/Overview.jsx` (+ `components/MetricCard`): summary from the store.
- `sustainability/Monitoring.jsx`: both fetch sites (~lines 58 and 103)
  dispatch `fetchMetricsSeries(config)`; the chart reads `selectMetricsSeries`.
  The "pipeline message" text stays local UI state, driven by `seriesStatus`.

## Acceptance checks (Sustainability Officer, backend running)
- Initiatives: create, edit, toggle on-track, move status, delete; Kanban
  columns are correct after each change, without a reload.
- Report: generate preview, save; it appears in Archives; delete it there.
- Archives: all three tabs, search, delete.
- Overview: cards and active-initiative count match.
- Monitoring: change range / granularity, go back to a previous range with no
  new request (check the Network tab).
- `grep -rn "api/client" src/pages/sustainability/*.jsx src/pages/sustainability/components` → nothing.
