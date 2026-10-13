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
 * date by hand: it is the one the user clicked if that is still open,
 * otherwise the first open alert. So after an alert is acknowledged or
 * resolved, the next one is selected automatically.
 *
 * The "Action Taken" text is saved as a message on the alert's thread
 * (POST /alerts/:id/messages), because the alert itself has no field for it.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";

import Modal from "./components/Modal";
import ToastStack from "./components/ToastStack";
import { useToast } from "./components/useToast";
import AlertQueue from "./alerts/AlertQueue";
import AlertDetail from "./alerts/AlertDetail";
import AlertLog from "./alerts/AlertLog";

import "../../styles/shared/tech_shared.css";
import "../../styles/technician/tech_alerts.css";
import "./technician.css";

/**
 * Gets every alert. Only fetches — it does not touch React state, so it
 * lives outside the component.
 */
async function fetchAlerts() {
  const alerts = await api.get("/alerts");
  return alerts || [];
}

export default function TechnicianAlerts() {
  const { role } = useAuth();
  const { toasts, showToast } = useToast();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The alert the user clicked in the queue (null = none clicked yet).
  const [selectedId, setSelectedId] = useState(null);

  // The alert whose request is running, so its buttons are disabled.
  const [busyId, setBusyId] = useState(null);

  // The alert waiting for "Are you sure?" in the popup (null = popup closed).
  // It stores the id rather than true/false so the popup always resolves the
  // alert it was opened for, even if a refresh changes the selection.
  const [confirmId, setConfirmId] = useState(null);

  // Same lint-safe pattern as Overview.jsx: setState only inside the
  // .then / .catch callbacks.
  function loadData() {
    return fetchAlerts()
      .then((list) => {
        setError("");
        setAlerts(list);
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

  async function acknowledgeAlert(id, action) {
    setBusyId(id);
    try {
      await api.patch(`/alerts/${id}`, { status: "acknowledged" });
      // Record what was done, so the Alert Log can show it.
      await api.post(`/alerts/${id}/messages`, {
        sender_role: role,
        content: action,
      });
      showToast(`Alert ${id} acknowledged. Action: ${action}`, "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
  }

  async function resolveAlert(id) {
    setBusyId(id);
    try {
      await api.patch(`/alerts/${id}`, { status: "resolved" });
      showToast(`Alert ${id} resolved.`, "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
  }

  function confirmResolve() {
    const id = confirmId;
    setConfirmId(null); // close the popup
    resolveAlert(id);
  }

  // ── Split the alerts for the two tables ──────────────
  const openAlerts = alerts.filter((a) => a.status === "open");
  const loggedAlerts = alerts.filter(
    (a) => a.status === "acknowledged" || a.status === "resolved",
  );

  // ── Which alert the detail panel shows ───────────────
  let selected = openAlerts.find((a) => a.alert_id === selectedId);
  if (!selected) {
    selected = openAlerts[0]; // undefined when no open alerts are left
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
          alerts={openAlerts}
          selectedId={selectedAlertId}
          onSelect={setSelectedId}
        />
        <AlertDetail
          alert={selected}
          busy={selected !== undefined && busyId === selected.alert_id}
          onAcknowledge={acknowledgeAlert}
          onResolveClick={() => setConfirmId(selected.alert_id)}
        />
        <AlertLog
          alerts={loggedAlerts}
          busyId={busyId}
          onResolve={resolveAlert}
        />
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

      {confirmId !== null && (
        <Modal
          title="Resolve Alert"
          confirmLabel="Resolve"
          onConfirm={confirmResolve}
          onCancel={() => setConfirmId(null)}
        >
          <p>
            Are you sure you want to resolve <strong>{confirmId}</strong>?
          </p>
        </Modal>
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}
