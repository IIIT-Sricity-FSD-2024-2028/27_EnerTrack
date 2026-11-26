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
 *   Technician side (the junior technician's Expenses page):
 *   fileExpenseBill(body)                    POST a new bill (the server decides
 *                                            auto-approval), then reload: the
 *                                            work order's other bills change too
 *   resubmitExpenseBill({ id, changes })     PATCH a held bill back to "submitted"
 *   withdrawExpenseBill(id)                  DELETE a bill, then reload
 *   attachExpenseBillFiles({ id, files })    POST /:id/attachments (multipart)
 *   removeExpenseBillAttachment({ id, filename })
 *                                            DELETE /:id/attachments/:filename
 *   (both answer with the saved bill, which replaces the old one in place)
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
  extraReducers: (builder, { adapter, isRow }) => {
    const upsertIfRow = (state, { payload }) => {
      if (isRow(payload)) adapter.upsertOne(state, payload);
    };
    builder
      .addMatcher(
        (action) =>
          action.type === "expenseBills/attachFiles/fulfilled" ||
          action.type === "expenseBills/removeAttachment/fulfilled",
        upsertIfRow,
      );
  },
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

// A change to one bill moves the totals and cap warnings on the other bills
// of its work order, so these reload the list once the server has answered.
const patchAndReload = async ({ id, changes }, { dispatch }) => {
  const row = await api.patch(`/expense-bills/${id}`, changes);
  await dispatch(fetchExpenseBills({ force: true }));
  return row;
};

export const reviewExpenseBill = apiThunk("expenseBills/review", patchAndReload);
export const resubmitExpenseBill = apiThunk("expenseBills/resubmit", patchAndReload);

export const fileExpenseBill = apiThunk(
  "expenseBills/file",
  async (body, { dispatch }) => {
    const row = await api.post("/expense-bills", body);
    await dispatch(fetchExpenseBills({ force: true }));
    return row;
  },
);

export const withdrawExpenseBill = apiThunk(
  "expenseBills/withdraw",
  async (id, { dispatch }) => {
    await api.delete(`/expense-bills/${id}`);
    await dispatch(fetchExpenseBills({ force: true }));
    return id;
  },
);

export const attachExpenseBillFiles = apiThunk(
  "expenseBills/attachFiles",
  ({ id, files }) => api.upload(`/expense-bills/${id}/attachments`, "files", files),
);

export const removeExpenseBillAttachment = apiThunk(
  "expenseBills/removeAttachment",
  ({ id, filename }) =>
    api.delete(`/expense-bills/${id}/attachments/${encodeURIComponent(filename)}`),
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
