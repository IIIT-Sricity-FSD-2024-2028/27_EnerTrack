/**
 * alertsSlice.js: /alerts (id: alert_id). Owner: Person 1.
 *
 * CRUD from createCrudSlice (see its header). Extra:
 *   decideAlert({ id, decision, notes, asset, faultType })
 *     POST /alerts/:id/decide, one step on the server: "fault" raises a
 *     Fault linked to the alert, "monitor" keeps it in the queue,
 *     "false_alarm" resolves it. Resolves to { alert, fault }; the alert is
 *     updated here and the new fault is added by faultsSlice.
 */
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

export const decideAlert = apiThunk(
  "alerts/decide",
  ({ id, decision, notes, asset, faultType }) =>
    api.post(`/alerts/${id}/decide`, {
      decision,
      ...(notes ? { notes } : {}),
      ...(decision === "fault" ? { asset, fault_type: faultType } : {}),
    }),
);

const alerts = createCrudSlice({
  name: "alerts",
  path: "/alerts",
  idKey: "alert_id",
  extraReducers: (builder, { adapter, isRow }) => {
    builder.addCase(decideAlert.fulfilled, (state, { payload }) => {
      if (isRow(payload?.alert)) adapter.upsertOne(state, payload.alert);
    });
  },
});

export const {
  fetchAll: fetchAlerts,
  fetchOne: fetchAlert,
  create: createAlert,
  update: updateAlert,
  remove: removeAlert,
} = alerts.thunks;

export const {
  selectAll: selectAllAlerts,
  selectById: selectAlertById,
  selectStatus: selectAlertsStatus,
  selectError: selectAlertsError,
} = alerts.selectors;

export default alerts.reducer;
