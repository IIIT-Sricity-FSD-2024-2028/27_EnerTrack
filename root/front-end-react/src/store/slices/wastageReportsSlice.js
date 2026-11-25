import { createCrudSlice } from "../createCrudSlice";
import { createResourceSlice } from "../createResourceSlice";

// Shared wastage rows used by the Sustainability Overview and Archives.
const reports = createCrudSlice({
  name: "wastageReports",
  path: "/wastage-reports",
  idKey: "wastage_report_id",
});

export const { fetchAll: fetchWastageReports, remove: removeWastageReport } = reports.thunks;
export const {
  selectAll: selectAllWastageReports,
  selectStatus: selectWastageReportsStatus,
} = reports.selectors;
export default reports.reducer;

// The signals endpoint supplies the Overview's attention counts.
const signals = createResourceSlice({ name: "wastageSignals", path: "/wastage-reports/signals" });
export const { fetch: fetchWastageSignals } = signals.thunks;
export const { selectData: selectWastageSignals } = signals.selectors;
export const wastageSignalsReducer = signals.reducer;
