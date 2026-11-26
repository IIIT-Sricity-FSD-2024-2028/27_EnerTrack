/**
 * foodWasteLogsSlice.js: General Maintenance's food-waste weigh-ins.
 *
 * Only the per-place summary is kept (GET /food-waste-logs/summary): kg a day
 * over the last 7 and 30 days for each place, and whether it is rising. The
 * technician's "Log food waste" card, the officer's food cases and the
 * target modal all read it.
 *
 *   fetchFoodWasteSummary(arg?)   cached like any load; { force: true } reloads
 *   logFoodWaste(body)            POST /food-waste-logs, then reload the summary
 *
 * Selectors: selectFoodWasteSummary (array), selectFoodWastePlaces (names),
 * selectFoodWasteForPlace(state, place) (the row for a place, or undefined).
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createResourceSlice } from "../createResourceSlice";

const summary = createResourceSlice({
  name: "foodWasteSummary",
  path: "/food-waste-logs/summary",
  initialData: [],
});

export const { fetch: fetchFoodWasteSummary } = summary.thunks;
export const {
  selectStatus: selectFoodWasteSummaryStatus,
  selectError: selectFoodWasteSummaryError,
} = summary.selectors;

export const selectFoodWasteSummary = createSelector(
  [summary.selectors.selectData],
  (rows) => (Array.isArray(rows) ? rows : []),
);

export const selectFoodWastePlaces = createSelector([selectFoodWasteSummary], (rows) =>
  rows.map((r) => r.location),
);

/** Places are matched case- and space-insensitively, like the server does. */
export const placeKey = (place) =>
  String(place || "").trim().toLowerCase().replace(/\s+/g, " ");

export const selectFoodWasteForPlace = (state, place) =>
  selectFoodWasteSummary(state).find((r) => placeKey(r.location) === placeKey(place));

export const logFoodWaste = apiThunk("foodWasteSummary/log", async (body, { dispatch }) => {
  const saved = await api.post("/food-waste-logs", body);
  await dispatch(fetchFoodWasteSummary({ force: true }));
  return saved;
});

export default summary.reducer;
