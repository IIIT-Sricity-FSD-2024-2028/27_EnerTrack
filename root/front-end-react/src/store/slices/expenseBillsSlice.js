/**
 * expenseBillsSlice.js: /expense-bills (id: expense_bill_id). Owner: Person 3
 * (Finance signs the bills off). The technician's own Expenses page can use
 * the same thunks.
 *
 * CRUD from createCrudSlice (see its header). Rows are the server's view of a
 * bill: they already carry work_order_title, submitted_by_name and the
 * work order's variance / cap figures.
 *
 * Extra:
 *   reviewExpenseBill({ id, changes })
 *     Finance approves a bill ({ status: "approved" }) or holds it
 *     ({ status: "rejected", rejection_reason }). One decision changes the
 *     totals and cap warnings on the other bills of the same work order, so
 *     the list reloads afterwards.
 *   fetchExpenseSettings() / updateExpenseSettings(changes)
 *     GET / PATCH /expense-bills/settings: { auto_approve_cap,
 *     max_auto_approved_per_wo }. A new cap changes every bill's cap
 *     warnings, so saving it reloads the bills too.
 *
 * Selectors:
 *   selectAllExpenseBills, selectPendingExpenseBills (status "submitted"),
 *   selectExpenseSettings
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";
import { createResourceSlice } from "../createResourceSlice";

const expenseBills = createCrudSlice({
  name: "expenseBills",
  path: "/expense-bills",
  idKey: "expense_bill_id",
});

export const {
  fetchAll: fetchExpenseBills,
  fetchOne: fetchExpenseBill,
  create: createExpenseBill,
  update: updateExpenseBill,
  remove: removeExpenseBill,
} = expenseBills.thunks;

export const {
  selectAll: selectAllExpenseBills,
  selectById: selectExpenseBillById,
  selectStatus: selectExpenseBillsStatus,
  selectError: selectExpenseBillsError,
} = expenseBills.selectors;

export const selectPendingExpenseBills = createSelector([selectAllExpenseBills], (bills) =>
  bills.filter((b) => b.status === "submitted"),
);

export const reviewExpenseBill = apiThunk(
  "expenseBills/review",
  async ({ id, changes }, { dispatch }) => {
    const row = await api.patch(`/expense-bills/${id}`, changes);
    await dispatch(fetchExpenseBills({ force: true }));
    return row;
  },
);

/* ── the auto-approve settings: one object, not a list ── */

const settings = createResourceSlice({
  name: "expenseSettings",
  path: "/expense-bills/settings",
  initialData: { auto_approve_cap: 1500, max_auto_approved_per_wo: 2 },
});

export const { fetch: fetchExpenseSettings } = settings.thunks;
export const { selectData: selectExpenseSettings } = settings.selectors;

export const updateExpenseSettings = apiThunk(
  "expenseSettings/update",
  async (changes, { dispatch }) => {
    const saved = await api.patch("/expense-bills/settings", changes);
    dispatch(settings.actions.dataSet(saved));
    await dispatch(fetchExpenseBills({ force: true }));
    return saved;
  },
);

export const expenseSettingsReducer = settings.reducer;
export default expenseBills.reducer;
