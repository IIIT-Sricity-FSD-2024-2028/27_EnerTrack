import { describe, expect, it } from "vitest";
import { configureStore, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { addLoadCases, loadCondition, loadInitial, unwrapLoad } from "./loadState";

// A cached load like fetchBuildings(): slow enough that a second dispatch
// arrives while the first is still running (what StrictMode does in dev).
const fetchThings = createAsyncThunk(
  "things/fetch",
  () => new Promise((resolve) => setTimeout(() => resolve(["a"]), 10)),
  { condition: loadCondition("things") },
);
const things = createSlice({
  name: "things",
  initialState: { data: [], ...loadInitial },
  reducers: {},
  extraReducers: (b) => addLoadCases(b, fetchThings, (s, { payload }) => { s.data = payload; }),
});
const makeStore = () => configureStore({ reducer: { things: things.reducer } });

describe("unwrapLoad", () => {
  it(".unwrap() throws on a skipped load (the bug)", async () => {
    const store = makeStore();
    const first = store.dispatch(fetchThings());
    await expect(store.dispatch(fetchThings()).unwrap()).rejects.toThrow(/condition callback/);
    await first;
  });

  it("treats a skipped load as success", async () => {
    const store = makeStore();
    const first = unwrapLoad(store.dispatch(fetchThings()));
    await expect(unwrapLoad(store.dispatch(fetchThings()))).resolves.toBeUndefined();
    await expect(first).resolves.toEqual(["a"]);
    // and once loaded, a later visit is skipped without an error too
    await expect(unwrapLoad(store.dispatch(fetchThings()))).resolves.toBeUndefined();
  });

  it("still throws on a real failure", async () => {
    const failing = createAsyncThunk("things/fetch", () => { throw new Error("Backend down"); });
    const store = makeStore();
    await expect(unwrapLoad(store.dispatch(failing()))).rejects.toMatchObject({ message: "Backend down" });
  });
});
