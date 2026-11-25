/**
 * subscriptionsSlice.js: /subscriptions (id: subscription_id). Owner: Person 2.
 *
 * CRUD comes from createCrudSlice; see its header (only fetchAll is used).
 * Extra:
 *   fetchSubscriptionByOrg(orgId)
 *     GET /subscriptions/by-organization/:orgId: the organisation's live
 *     (not cancelled) subscription, which the server sends with its tier
 *     embedded as `plan`. Upserted into the list; read it back with
 *     selectSubscriptionByOrg(state, orgId). Rejects (404) when the
 *     organisation has no live subscription yet.
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

export const fetchSubscriptionByOrg = apiThunk(
  "subscriptions/fetchByOrg",
  (orgId) => api.get(`/subscriptions/by-organization/${orgId}`),
);

const subscriptions = createCrudSlice({
  name: "subscriptions",
  path: "/subscriptions",
  idKey: "subscription_id",
  extraReducers: (builder, { adapter, isRow }) => {
    builder.addCase(fetchSubscriptionByOrg.fulfilled, (state, { payload }) => {
      if (isRow(payload)) adapter.upsertOne(state, payload);
    });
  },
});

export const { fetchAll: fetchSubscriptions, fetchOne: fetchSubscription } =
  subscriptions.thunks;

export const {
  selectAll: selectAllSubscriptions,
  selectById: selectSubscriptionById,
  selectStatus: selectSubscriptionsStatus,
  selectError: selectSubscriptionsError,
} = subscriptions.selectors;

/** The organisation's live (not cancelled) subscription, or null. */
export const selectSubscriptionByOrg = (state, orgId) =>
  selectAllSubscriptions(state).find(
    (s) => s.organization_id === orgId && s.status !== "cancelled",
  ) ?? null;

/** { [plan_id]: number of clients on it }, counting contracts not cancelled. */
export const selectSubscriberCountByPlan = createSelector(
  [selectAllSubscriptions],
  (rows) => {
    const counts = {};
    for (const s of rows) {
      if (s.status !== "cancelled")
        counts[s.plan_id] = (counts[s.plan_id] || 0) + 1;
    }
    return counts;
  },
);

export default subscriptions.reducer;
