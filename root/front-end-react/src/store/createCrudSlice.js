/**
 * createCrudSlice.js: one backend resource → one Redux slice with CRUD.
 *
 *   const meters = createCrudSlice({ name: "meters", path: "/meters", idKey: "meter_id" });
 *
 * gives you
 *
 *   meters.reducer                       register it in store/index.js
 *   meters.thunks.fetchAll(arg?)         GET    /meters          → replaces the list
 *   meters.thunks.fetchOne(id)           GET    /meters/:id      → upserts one row
 *   meters.thunks.create(body)           POST   /meters          → adds the saved row
 *   meters.thunks.update({ id, changes })PATCH  /meters/:id      → upserts the saved row
 *   meters.thunks.remove(id)             DELETE /meters/:id      → removes the row
 *   meters.selectors.selectAll / selectById / selectIds / selectTotal
 *   meters.selectors.selectStatus        "idle" | "loading" | "succeeded" | "failed"
 *   meters.selectors.selectError         message of the last failed fetchAll, or null
 *
 * State shape: { ids: [], entities: {}, status, error, ...initialState }.
 * Rows are stored exactly as the backend sends them (snake_case). Put any
 * reshaping for the UI in a selector, not in the reducer.
 *
 * fetchAll is cached: once a list has loaded, calling it again does nothing,
 * so every page can safely `dispatch(fetchMeters())` on mount. Pass
 * `{ force: true }` to reload anyway (e.g. a "Refresh" button, or after a
 * change made by a different endpoint).
 *
 * create/update/remove do not re-fetch the list: the backend answers with the
 * saved row and the slice updates in place. If an endpoint answers without the
 * row, update falls back to merging `changes`, and create reloads the list.
 *
 * Anything that is not plain CRUD (archive, approve, upload, ...) goes in the
 * slice's own file as an apiThunk, handled through the `extraReducers` option:
 *
 *   createCrudSlice({ ..., extraReducers: (builder, { adapter }) => {
 *     builder.addCase(archiveInvoice.fulfilled, (state, { payload }) =>
 *       adapter.upsertOne(state, payload));
 *   }});
 */
import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import api from "../api/client";
import { apiThunk } from "./apiThunk";

export function createCrudSlice({
  name,
  path,
  idKey,
  initialState = {},
  reducers = {},
  extraReducers,
  sortComparer,
}) {
  const adapter = createEntityAdapter({
    selectId: (row) => row[idKey],
    sortComparer,
  });

  const fetchAll = apiThunk(
    `${name}/fetchAll`,
    async () => {
      const rows = await api.get(path);
      return Array.isArray(rows) ? rows : [];
    },
    {
      // Skip when a load is already running, or already done (unless forced).
      condition: (arg, { getState }) => {
        const { status } = getState()[name];
        if (status === "loading") return false;
        if (status === "succeeded" && !arg?.force) return false;
        return true;
      },
    },
  );

  const fetchOne = apiThunk(`${name}/fetchOne`, (id) =>
    api.get(`${path}/${id}`),
  );

  const create = apiThunk(`${name}/create`, async (body, { dispatch }) => {
    const row = await api.post(path, body);
    // No row back means we cannot place it ourselves: reload the list.
    if (!row || row[idKey] === undefined)
      await dispatch(fetchAll({ force: true }));
    return row;
  });

  const update = apiThunk(`${name}/update`, async ({ id, changes }) => {
    const row = await api.patch(`${path}/${id}`, changes);
    return { id, changes, row };
  });

  const remove = apiThunk(`${name}/remove`, async (id) => {
    await api.delete(`${path}/${id}`);
    return id;
  });

  const isRow = (row) =>
    row && typeof row === "object" && row[idKey] !== undefined;

  const slice = createSlice({
    name,
    initialState: adapter.getInitialState({
      status: "idle",
      error: null,
      ...initialState,
    }),
    reducers,
    extraReducers: (builder) => {
      builder
        .addCase(fetchAll.pending, (state) => {
          state.status = "loading";
          state.error = null;
        })
        .addCase(fetchAll.fulfilled, (state, { payload }) => {
          adapter.setAll(state, payload);
          state.status = "succeeded";
        })
        .addCase(fetchAll.rejected, (state, { error }) => {
          state.status = "failed";
          state.error = error.message;
        })
        .addCase(fetchOne.fulfilled, (state, { payload }) => {
          if (isRow(payload)) adapter.upsertOne(state, payload);
        })
        .addCase(create.fulfilled, (state, { payload }) => {
          if (isRow(payload)) adapter.upsertOne(state, payload);
        })
        .addCase(update.fulfilled, (state, { payload }) => {
          if (isRow(payload.row)) adapter.upsertOne(state, payload.row);
          else
            adapter.updateOne(state, {
              id: payload.id,
              changes: payload.changes,
            });
        })
        .addCase(remove.fulfilled, (state, { payload }) => {
          adapter.removeOne(state, payload);
        });
      if (extraReducers) extraReducers(builder, { adapter });
    },
  });

  const selectSlice = (state) => state[name];
  const selectors = {
    ...adapter.getSelectors(selectSlice),
    selectStatus: (state) => selectSlice(state).status,
    selectError: (state) => selectSlice(state).error,
  };

  return {
    slice,
    reducer: slice.reducer,
    actions: slice.actions,
    adapter,
    thunks: { fetchAll, fetchOne, create, update, remove },
    selectors,
  };
}
