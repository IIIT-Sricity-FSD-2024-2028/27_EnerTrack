import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import ui, { selectToasts, showToast, toastDismissed } from "./uiSlice";
import { resetData } from "../actions";

function makeStore() {
  const app = combineReducers({ ui });
  // Same reset rule as store/index.js: ui survives resetData.
  const root = (state, action) =>
    action.type === resetData.type && state ? app({ ui: state.ui }, action) : app(state, action);
  return configureStore({ reducer: root });
}

describe("ui toasts", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows a toast and removes it after its time", () => {
    const store = makeStore();
    store.dispatch(showToast("Saved.", "success"));
    expect(selectToasts(store.getState())).toEqual([
      expect.objectContaining({ message: "Saved.", type: "success" }),
    ]);
    vi.advanceTimersByTime(4000);
    expect(selectToasts(store.getState())).toEqual([]);
  });

  it("keeps errors on screen longer", () => {
    const store = makeStore();
    store.dispatch(showToast("Failed.", "error"));
    vi.advanceTimersByTime(4000);
    expect(selectToasts(store.getState())).toHaveLength(1);
    vi.advanceTimersByTime(2000);
    expect(selectToasts(store.getState())).toHaveLength(0);
  });

  it("can be dismissed early, and keeps at most four", () => {
    const store = makeStore();
    const id = store.dispatch(showToast("one", "info"));
    ["two", "three", "four", "five"].forEach((m) => store.dispatch(showToast(m, "info")));
    const messages = selectToasts(store.getState()).map((t) => t.message);
    expect(messages).toEqual(["two", "three", "four", "five"]);
    store.dispatch(toastDismissed(selectToasts(store.getState())[0].id));
    expect(selectToasts(store.getState())).toHaveLength(3);
    expect(typeof id).toBe("number");
  });

  it("survives sign-out (resetData)", () => {
    const store = makeStore();
    store.dispatch(showToast("Signed out.", "info"));
    store.dispatch(resetData());
    expect(selectToasts(store.getState())).toHaveLength(1);
  });
});
