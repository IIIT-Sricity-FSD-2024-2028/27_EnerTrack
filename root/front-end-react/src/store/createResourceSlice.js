/**
 * createResourceSlice.js: a slice for ONE value the backend computes (not a
 * list of records): a summary, a queue, someone's availability, a catalogue.
 *
 *   const queue = createResourceSlice({ name: "dispatchQueue", path: "/dispatch/queue",
 *                                       initialData: { queued: [], team_status: [] } });
 *
 * gives you
 *   queue.reducer                  register it in store/store.js
 *   queue.thunks.fetch(arg?)       GET path → state.data (cached like fetchAll;
 *                                  `{ force: true }` reloads)
 *   queue.actions.dataSet(value)   replace the data (e.g. with a PUT's answer)
 *   queue.selectors.selectData / selectStatus / selectError
 *
 * State: { data, status, refreshing, error } (see store/loadState.js).
 */
import { createSlice } from "@reduxjs/toolkit";
import api from "../api/client";
import { apiThunk } from "./apiThunk";
import { addLoadCases, loadCondition, loadInitial } from "./loadState";

export function createResourceSlice({
  name,
  path,
  initialData = null,
  extraReducers,
}) {
  const fetch = apiThunk(`${name}/fetch`, () => api.get(path), {
    condition: loadCondition(name),
  });

  const slice = createSlice({
    name,
    initialState: { data: initialData, ...loadInitial },
    reducers: {
      dataSet(state, { payload }) {
        state.data = payload;
      },
    },
    extraReducers: (builder) => {
      addLoadCases(builder, fetch, (state, { payload }) => {
        state.data = payload ?? initialData;
      });
      if (extraReducers) extraReducers(builder);
    },
  });

  return {
    slice,
    reducer: slice.reducer,
    actions: slice.actions,
    thunks: { fetch },
    selectors: {
      selectData: (state) => state[name].data,
      selectStatus: (state) => state[name].status,
      selectError: (state) => state[name].error,
    },
  };
}
