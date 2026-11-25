/**
 * store/index.js: the one Redux store.
 *
 * Adding a slice: import its reducer and add ONE line to `reducers` below,
 * keyed by the slice's `name`. Keep the list grouped by owner so merges
 * between teammates stay one-line conflicts at worst.
 *
 * `auth` and `ui` survive resetData (sign-out, act-as); every other slice is
 * emptied back to its initial state.
 */
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { SESSION_EXPIRED_EVENT } from "../api/client";
import { bindBackendStatus } from "../api/backendStatus";
import { resetData } from "./actions";
import { logout } from "./slices/authSlice";

import auth from "./slices/authSlice";
import ui from "./slices/uiSlice";
// Person 1: shared reference data
import users from "./slices/usersSlice";
import organizations from "./slices/organizationsSlice";
import campus from "./slices/campusSlice";
import buildings from "./slices/buildingsSlice";
import departments from "./slices/departmentsSlice";
import meters from "./slices/metersSlice";
// Person 1: technician / dispatch
import alerts from "./slices/alertsSlice";
import faults from "./slices/faultsSlice";
import meterReadings from "./slices/meterReadingsSlice";
import workOrders from "./slices/workOrdersSlice";
import {
  availabilityReducer as availability,
  dispatchQueueReducer as dispatchQueue,
  myJobsReducer as myJobs,
} from "./slices/dispatchSlice";
// Person 2: admin / auditor
import notifications from "./slices/notificationsSlice";
// Person 4: sustainability
import initiatives from "./slices/initiativesSlice";
import sustainabilityReports from "./slices/sustainabilityReportsSlice";
import sustainabilityMetrics from "./slices/sustainabilityMetricsSlice";
import targets from "./slices/targetsSlice";
// Person 3: finance
import energyCosts from "./slices/energyCostsSlice";
import financialReports from "./slices/financialReportsSlice";
import invoices from "./slices/invoicesSlice";
import expenseBills, { expenseSettingsReducer as expenseSettings } from "./slices/expenseBillsSlice";
// Person 5: wastage / campus
import wastageReports, { wastageSignalsReducer as wastageSignals } from "./slices/wastageReportsSlice";
import serviceRequests, {
  serviceCatalogueReducer as serviceCatalogue,
} from "./slices/serviceRequestsSlice";

const reducers = {
  auth,
  ui,
  // Person 1: shared reference data
  users,
  organizations,
  campus,
  buildings,
  departments,
  meters,
  // Person 1: technician / dispatch
  alerts,
  faults,
  meterReadings,
  workOrders,
  dispatchQueue,
  myJobs,
  availability,
  // Person 2: admin / auditor          (+ subscriptionPlans, subscriptions, platformInvoices, auditRequests, energyAudits)
  notifications,
  // Person 3: finance                  (energyCosts, financialReports, invoices)
  // Person 4: sustainability
  initiatives,
  targets,
  // Person 5: wastage / campus
  sustainabilityReports,
  sustainabilityMetrics,
  targets,
  // Person 5: wastage / campus
  wastageReports,
  wastageSignals,
  // Person 3: finance
  energyCosts,
  financialReports,
  invoices,
  expenseBills,
  expenseSettings,
  // Person 4: sustainability           (initiatives, sustainabilityReports, sustainabilityMetrics)
  // Person 5: wastage / campus         (+ wastageReports)
  serviceRequests,
  serviceCatalogue,
};

const appReducer = combineReducers(reducers);

function rootReducer(state, action) {
  if (action.type === resetData.type && state) {
    // Every key left undefined falls back to its slice's initial state.
    return appReducer({ auth: state.auth, ui: state.ui }, action);
  }
  return appReducer(state, action);
}

export const store = configureStore({ reducer: rootReducer });

// The API client reports reachability without importing the store.
bindBackendStatus(store.dispatch);

// The backend refused our token (expired, or it restarted with a new key).
// api/client.js has already cleared storage; sign out here too so the route
// guards send the person to sign-in and no stale data stays in memory.
window.addEventListener(SESSION_EXPIRED_EVENT, () => store.dispatch(logout()));
