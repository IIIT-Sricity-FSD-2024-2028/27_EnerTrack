/**
 * subscriptionPlansSlice.js: /subscription-plans (id: plan_id). Owner: Person 2.
 *
 * CRUD comes from createCrudSlice; see its header. Retire / Reactivate is a
 * plain updateSubscriptionPlan({ id, changes: { is_active } }). Extra:
 *   fetchPublicPlans()  GET /subscription-plans/public: the live tiers for the
 *                       landing page, which has no session. Stored apart from
 *                       the full rows in state.subscriptionPlans.publicPlans
 *                       (with publicStatus), because it is a trimmed copy.
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

export const fetchPublicPlans = apiThunk(
  "subscriptionPlans/fetchPublic",
  async () => {
    const rows = await api.get("/subscription-plans/public");
    return Array.isArray(rows) ? rows : [];
  },
  {
    // Loads once, like fetchAll; { force: true } reloads.
    condition: (arg, { getState }) => {
      if (arg?.force) return true;
      const { publicStatus } = getState().subscriptionPlans;
      return publicStatus !== "loading" && publicStatus !== "succeeded";
    },
  },
);

const plans = createCrudSlice({
  name: "subscriptionPlans",
  path: "/subscription-plans",
  idKey: "plan_id",
  initialState: { publicPlans: [], publicStatus: "idle" },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPublicPlans.pending, (state) => {
        if (state.publicStatus !== "succeeded") state.publicStatus = "loading";
      })
      .addCase(fetchPublicPlans.fulfilled, (state, { payload }) => {
        state.publicPlans = payload;
        state.publicStatus = "succeeded";
      })
      .addCase(fetchPublicPlans.rejected, (state, { meta }) => {
        if (meta.condition) return; // skipped, not failed
        if (state.publicStatus !== "succeeded") state.publicStatus = "failed";
      });
  },
});

export const {
  fetchAll: fetchSubscriptionPlans,
  fetchOne: fetchSubscriptionPlan,
  create: createSubscriptionPlan,
  update: updateSubscriptionPlan,
  remove: removeSubscriptionPlan,
} = plans.thunks;

export const {
  selectAll: selectAllSubscriptionPlans,
  selectById: selectSubscriptionPlanById,
  selectStatus: selectSubscriptionPlansStatus,
  selectError: selectSubscriptionPlansError,
} = plans.selectors;

/** Tiers that can still be offered (a retired one is refused by the server). */
export const selectActiveSubscriptionPlans = createSelector(
  [selectAllSubscriptionPlans],
  (rows) => rows.filter((p) => p.is_active),
);

export const selectPublicPlans = (state) => state.subscriptionPlans.publicPlans;
export const selectPublicPlansStatus = (state) =>
  state.subscriptionPlans.publicStatus;

export default plans.reducer;
