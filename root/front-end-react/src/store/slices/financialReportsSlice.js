/**
 * financialReportsSlice.js: /financial-reports (id: financial_report_id).
 * Owner: Person 3.
 *
 * CRUD from createCrudSlice (see its header). Archiving is an update:
 *   dispatch(updateFinancialReport({ id, changes: { archived: true } }))
 *
 * Rows are kept newest first, so the first report is the latest one (the
 * Overview ROI card and the metrics calculator read it). Reports carry no
 * reliable date (the seeded ones have none), but the server adds each new
 * report to the end of its list, so newest first is the server's order
 * reversed, and a report just created goes to the top.
 *
 * Selectors (normalized with normalizeReport; generatedBy is the author's
 * name when the users list is loaded):
 *   selectReportRows       every report
 *   selectActiveReports    not archived (the Reports table)
 *   selectArchivedReports  archived (the Archives page)
 */
import { createSelector } from "@reduxjs/toolkit";
import { createCrudSlice } from "../createCrudSlice";
import { normalizeReport } from "../../pages/finance/financeApi";
import { selectAllUsers } from "./usersSlice";

const financialReports = createCrudSlice({
  name: "financialReports",
  path: "/financial-reports",
  idKey: "financial_report_id",
  // Matchers run after the factory's own cases, so the rows are already in.
  extraReducers: (builder) => {
    builder
      .addMatcher(
        (action) => action.type === "financialReports/fetchAll/fulfilled",
        (state) => {
          state.ids.reverse();
        },
      )
      .addMatcher(
        (action) => action.type === "financialReports/create/fulfilled",
        (state, { payload }) => {
          const id = payload?.financial_report_id;
          if (id === undefined || !state.entities[id]) return;
          state.ids = [id, ...state.ids.filter((x) => x !== id)];
        },
      );
  },
});

export const {
  fetchAll: fetchFinancialReports,
  fetchOne: fetchFinancialReport,
  create: createFinancialReport,
  update: updateFinancialReport,
  remove: removeFinancialReport,
} = financialReports.thunks;

export const {
  selectAll: selectAllFinancialReports,
  selectById: selectFinancialReportById,
  selectStatus: selectFinancialReportsStatus,
  selectError: selectFinancialReportsError,
} = financialReports.selectors;

export const selectReportRows = createSelector(
  [selectAllFinancialReports, selectAllUsers],
  (reports, users) => {
    const names = Object.fromEntries(users.map((u) => [u.user_id, u.name]));
    return reports.map((row) => {
      const report = normalizeReport(row);
      return { ...report, generatedBy: names[row.generated_by_id] || report.generatedBy };
    });
  },
);

export const selectActiveReports = createSelector([selectReportRows], (rows) =>
  rows.filter((r) => !r.archived),
);

export const selectArchivedReports = createSelector([selectReportRows], (rows) =>
  rows.filter((r) => r.archived),
);

export default financialReports.reducer;
