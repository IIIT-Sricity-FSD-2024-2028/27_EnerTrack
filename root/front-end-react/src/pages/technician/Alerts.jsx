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
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";

import ToastStack from "./components/ToastStack";
import { useToast } from "./components/useToast";
import AlertQueue from "./alerts/AlertQueue";
import AlertDetail from "./alerts/AlertDetail";
import AlertLog from "./alerts/AlertLog";

import "../../styles/shared/tech_shared.css";
import "../../styles/technician/tech_alerts.css";
import "./technician.css";

/**
 * Gets every alert, the faults (to know which alerts already have one), and
 * the meters and buildings (to say which sensor raised an alert, and where).
 * Only fetches — it does not touch React state, so it lives outside the
 * component.
 */
async function fetchAlerts() {
  const alerts = await api.get("/alerts");
  const faults = await api.get("/faults");
  const meters = await api.get("/meters");
  const buildings = await api.get("/buildings");
  return {
    alerts: alerts || [],
    faults: faults || [],
    meters: meters || [],
    buildings: buildings || [],
  };
}

/**
 * Alerts and faults share low / moderate / high / critical. The alert's
 * severity is free text, so anything else (e.g. "medium") counts as moderate.
 */
function faultSeverity(alertSeverity) {
  const known = ["low", "moderate", "high", "critical"];
  if (known.includes(alertSeverity)) {
    return alertSeverity;
  }
  return "moderate";
}

/** "False alarm" + "valve was shut" → "False alarm — valve was shut". */
function withNotes(label, notes) {
  if (!notes) {
    return label;
  }
  return label + " — " + notes;
}

export default function TechnicianAlerts() {
  const { role, user } = useAuth();
  const { toasts, showToast } = useToast();

  const [alerts, setAlerts] = useState([]);
  const [faults, setFaults] = useState([]);
  const [meters, setMeters] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The alert the user clicked in the queue (null = none clicked yet).
  const [selectedId, setSelectedId] = useState(null);

  // The alert whose request is running, so its buttons are disabled.
  const [busyId, setBusyId] = useState(null);

  // Same lint-safe pattern as Overview.jsx: setState only inside the
  // .then / .catch callbacks.
  function loadData() {
    return fetchAlerts()
      .then((result) => {
        setError("");
        setAlerts(result.alerts);
        setFaults(result.faults);
        setMeters(result.meters);
        setBuildings(result.buildings);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  // Load when the page opens, then refresh every 30 seconds.
  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

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
      let status = "acknowledged";
      let action;
      let message;

      if (decision === "fault") {
        let fault = openFaultFor(id);
        // The fault first: if it is refused, the alert is left untouched.
        if (!fault) {
          fault = await api.post("/faults", {
            alert_id: id,
            asset_name: asset,
            fault_type: faultType,
            severity: faultSeverity(alert.severity),
            status: "active",
            // Whoever confirmed it is the one diagnosing it, until reassigned.
            ...(user?.user_id ? { assigned_to_id: user.user_id } : {}),
            // Diagnostics carries these notes on into the work order.
            ...(notes ? { prelim_notes: notes } : {}),
          });
        }
        action = withNotes(`Sent to diagnostics as ${fault.fault_id}`, notes);
        message = `Alert ${id} acknowledged. ${fault.fault_id} is on Fault Detection & Diagnostics.`;
      } else if (decision === "monitor") {
        action = withNotes("Monitoring", notes);
        message = `Alert ${id} is being monitored. It stays in the queue until you decide.`;
      } else {
        status = "resolved";
        action = withNotes("False alarm", notes);
        message = `Alert ${id} resolved as a false alarm.`;
      }

      await api.patch(`/alerts/${id}`, { status: status });
      // Record what was done, so the Alert Log can show it.
      await api.post(`/alerts/${id}/messages`, {
        sender_role: role,
        content: action,
      });
      showToast(message, "success");
      await loadData();
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
        <button type="button" className="btn btn-dark" onClick={loadData}>
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
