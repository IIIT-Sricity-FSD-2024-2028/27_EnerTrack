/**
 * Alerts.jsx — Real-Time Anomaly Alerts.
 *
 * Ported from front-end/js/technician/alertsPage.js.
 *
 * Same shape as Overview.jsx: this page fetches and owns the alerts, works
 * out what each part of the screen needs, and passes it down. AlertQueue,
 * AlertDetail and AlertLog only draw what they are given.
 *
 * The selected alert is worked out during render rather than kept up to
 * date by hand: it is the one the user clicked if that is still in the
 * queue, otherwise the first one. So after an alert leaves the queue, the
 * next one is selected automatically.
 *
 * Each alert gets one decision (see AlertDetail): real fault, monitor, or
 * false alarm. A real fault creates a Fault linked to the alert, which is
 * the step that hands it to Fault Detection & Diagnostics.
 *
 * The "Action Taken" text is saved as a message on the alert's thread
 * (POST /alerts/:id/messages), because the alert itself has no field for it.
 *
 * Data comes from the Redux store (alerts, faults, meters, buildings),
 * refreshed every 30 seconds by useLiveData.
 */
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveData } from "../../store/useLiveData";
import {
  decideAlert as decideAlertThunk,
  fetchAlerts,
  selectAllAlerts,
} from "../../store/slices/alertsSlice";
import { fetchFaults, selectAllFaults } from "../../store/slices/faultsSlice";
import { fetchMeters, selectAllMeters } from "../../store/slices/metersSlice";
import {
  fetchBuildings,
  selectAllBuildings,
} from "../../store/slices/buildingsSlice";

import ToastStack from "./components/ToastStack";
import { useToast } from "./components/useToast";
import AlertQueue from "./alerts/AlertQueue";
import AlertDetail from "./alerts/AlertDetail";
import AlertLog from "./alerts/AlertLog";

import "../../styles/shared/tech_shared.css";
import "../../styles/technician/tech_alerts.css";
import "./technician.css";

// Every alert, the faults (to know which alerts already have one), and the
// meters and buildings (to say which sensor raised an alert, and where).
const LOADS = [fetchAlerts, fetchFaults, fetchMeters, fetchBuildings];

export default function TechnicianAlerts() {
  const { toasts, showToast } = useToast();
  const dispatch = useDispatch();

  const alerts = useSelector(selectAllAlerts);
  const faults = useSelector(selectAllFaults);
  const meters = useSelector(selectAllMeters);
  const buildings = useSelector(selectAllBuildings);
  const { loading, error, reload } = useLiveData(LOADS);

  // The alert the user clicked in the queue (null = none clicked yet).
  const [selectedId, setSelectedId] = useState(null);

  // The alert whose request is running, so its buttons are disabled.
  const [busyId, setBusyId] = useState(null);

  /** An unresolved fault already raised from this alert, if any. */
  function openFaultFor(alertId) {
    return faults.find(
      (f) => f.alert_id === alertId && f.status !== "resolved",
    );
  }

  /** Saves the decision made in AlertDetail. */
  async function decideAlert(alert, { decision, notes, asset, faultType }) {
    const id = alert.alert_id;
    setBusyId(id);
    try {
      // One step on the server: if the fault is refused the alert is left
      // untouched, and what was done is written to the alert log.
      // The alert and any new fault update in the store from the answer.
      const result = await dispatch(
        decideAlertThunk({
          id,
          decision:
            decision === "fault"
              ? "fault"
              : decision === "monitor"
                ? "monitor"
                : "false_alarm",
          notes,
          asset,
          faultType,
        }),
      ).unwrap();
      let message;
      if (decision === "fault") {
        message = `Alert ${id} acknowledged. ${result.fault.fault_id} is on Fault Detection & Diagnostics.`;
      } else if (decision === "monitor") {
        message = `Alert ${id} is being monitored. It stays in the queue until you decide.`;
      } else {
        message = `Alert ${id} resolved as a false alarm.`;
      }
      showToast(message, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
  }

  // ── Split the alerts for the two tables ──────────────
  // The queue holds every alert still waiting on a decision: new ones, and
  // acknowledged ones being monitored (no fault behind them). The log is the
  // record of the rest: resolved, or handed to diagnostics, where fixing the
  // fault resolves the alert. Nothing is resolved from the log itself.
  const queueAlerts = alerts.filter(
    (a) =>
      a.status === "open" ||
      (a.status === "acknowledged" && !openFaultFor(a.alert_id)),
  );
  const loggedAlerts = alerts.filter((a) => !queueAlerts.includes(a));

  // ── Which alert the detail panel shows ───────────────
  let selected = queueAlerts.find((a) => a.alert_id === selectedId);
  if (!selected) {
    selected = queueAlerts[0]; // undefined when the queue is empty
  }

  // The sensor that raised it, and the building that sensor is in.
  let selectedMeter;
  let selectedBuilding;
  if (selected) {
    selectedMeter = meters.find((m) => m.meter_id === selected.meter_id);
  }
  if (selectedMeter) {
    selectedBuilding = buildings.find(
      (b) => b.building_id === selectedMeter.building_id,
    );
  }

  // ── Pick what goes under the header ──────────────────
  let content;
  if (loading) {
    content = <div className="empty-state">Loading…</div>;
  } else if (error) {
    content = (
      <div className="empty-state">
        <p>{error}</p>
        <button type="button" className="btn btn-dark" onClick={reload}>
          Retry
        </button>
      </div>
    );
  } else {
    let selectedAlertId = null;
    if (selected) {
      selectedAlertId = selected.alert_id;
    }

    content = (
      <div className="alerts-grid">
        <AlertQueue
          alerts={queueAlerts}
          selectedId={selectedAlertId}
          onSelect={setSelectedId}
        />
        {/* key: another alert gets a fresh, empty form. */}
        <AlertDetail
          key={selectedAlertId || "none"}
          alert={selected}
          meter={selectedMeter}
          building={selectedBuilding}
          existingFault={selected && openFaultFor(selected.alert_id)}
          busy={selected !== undefined && busyId === selected.alert_id}
          onDecide={(values) => decideAlert(selected, values)}
        />
        <AlertLog alerts={loggedAlerts} openFaultFor={openFaultFor} />
      </div>
    );
  }

  return (
    <div className="tech-page">
      <div className="page-header">
        <h1>Real-Time Anomaly Alerts</h1>
        <p>
          Monitor the live priority queue, review diagnostics, and escalate or
          acknowledge alerts.
        </p>
      </div>

      <div className="status-bar">
        <div className="status-left">
          <div className="green-dot"></div>
          Monitoring Active
        </div>
        <div className="subtitle">
          Systems are connected and reporting continuous streams.
        </div>
      </div>

      {content}

      <ToastStack toasts={toasts} />
    </div>
  );
}
