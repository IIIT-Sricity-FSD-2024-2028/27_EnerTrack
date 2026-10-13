/**
 * Maintenance.jsx — Fault Detection & Diagnostics.
 *
 * Ported from front-end/js/technician/maintenancePage.js.
 *
 * Same shape as Overview.jsx and Alerts.jsx: this page fetches and owns all
 * the data and is the only file that talks to the backend. The cards below
 * it only draw what they are given and report clicks back up.
 *
 * Which faults are listed: active or pending ones that do not have a work
 * order yet. Once a fault is flagged for repair, the new work order carries
 * its id in linked_fault_id, and that is what takes it off this page.
 *
 * Fixes over the old page, which hid its errors behind console.warn:
 *   - the work order is sent in the shape the backend accepts (linked_fault_id,
 *     with type and description inside `details`); the old request was
 *     rejected, so no work order was ever actually created
 *   - no PATCH to the non-existent fault status "flagged"
 */
import { useEffect, useState } from "react";
import api from "../../api/client";

import Modal from "./components/Modal";
import ToastStack from "./components/ToastStack";
import { useToast } from "./components/useToast";
import FaultTiles from "./maintenance/FaultTiles";
import NotesSection from "./maintenance/NotesSection";
import SensorReadout from "./maintenance/SensorReadout";
import Classification from "./maintenance/Classification";
import WorkOrderModal from "./maintenance/WorkOrderModal";
import { faultsAwaitingDiagnosis } from "./techUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/technician/tech_maintenance.css";
import "./technician.css";

/**
 * Gets every list the page needs. Only fetches — it does not touch React
 * state, so it lives outside the component.
 */
async function fetchMaintenance() {
  const faults = await api.get("/faults");
  const users = await api.get("/users");
  const alerts = await api.get("/alerts");
  const readings = await api.get("/meter-readings");
  const meters = await api.get("/meters");
  const workOrders = await api.get("/work-orders");

  return {
    faults: faults || [],
    users: users || [],
    alerts: alerts || [],
    readings: readings || [],
    meters: meters || [],
    workOrders: workOrders || [],
  };
}

export default function TechnicianMaintenance() {
  const { toasts, showToast } = useToast();

  const [faults, setFaults] = useState([]);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [readings, setReadings] = useState([]);
  const [meters, setMeters] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The fault the user clicked (null = none clicked yet).
  const [selectedId, setSelectedId] = useState(null);

  // The fault whose request is running, so its buttons are disabled.
  const [busyId, setBusyId] = useState(null);

  // Which popup is open, and for which fault:
  //   null                                  no popup
  //   { kind: "close", faultId }            "Close Fault" confirm
  //   { kind: "scheduled", faultId }        scheduled work-order form
  //   { kind: "immediate", faultId }        urgent work-order form
  // It stores the fault id for the same reason as confirmId on the Alerts
  // page: a refresh can change the selection while a popup is open.
  const [dialog, setDialog] = useState(null);

  // Same lint-safe pattern as Overview.jsx: setState only inside the
  // .then / .catch callbacks.
  function loadData() {
    return fetchMaintenance()
      .then((result) => {
        setError("");
        setFaults(result.faults);
        setUsers(result.users);
        setAlerts(result.alerts);
        setReadings(result.readings);
        setMeters(result.meters);
        setWorkOrders(result.workOrders);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  // Load when the page opens, then refresh every 30 seconds. A refresh does
  // not wipe a half-typed note: NotesSection keeps its draft as long as its
  // key (the fault id) stays the same.
  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  /**
   * PATCH a fault and report the result. Returns true if it worked, so
   * NotesSection knows whether to leave edit mode.
   */
  async function updateFault(id, body, message, toastType) {
    setBusyId(id);
    let ok = false;
    try {
      await api.patch(`/faults/${id}`, body);
      showToast(message, toastType);
      await loadData();
      ok = true;
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
    return ok;
  }

  async function closeFault(id) {
    const fault = faults.find((f) => f.fault_id === id);
    setBusyId(id);
    try {
      await api.patch(`/faults/${id}`, { status: "resolved" });
      // The alert that raised this fault is finished too.
      if (fault && fault.alert_id) {
        await api.patch(`/alerts/${fault.alert_id}`, { status: "resolved" });
      }
      showToast(`Fault ${id} resolved and logged.`, "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
  }

  async function createWorkOrder(id, kind, values) {
    const fault = faults.find((f) => f.fault_id === id);
    if (!fault) {
      return;
    }

    let title = "Scheduled Maintenance: " + (fault.asset_name || "Asset");
    let type = "scheduled";
    if (kind === "immediate") {
      title = "Urgent Repair: " + (fault.asset_name || "Asset");
      type = "emergency";
    }

    // Only fields the backend's CreateWorkOrderDto allows; anything else is
    // rejected with a 400. Extra information goes inside `details`.
    // details.description is the asset everywhere (the board card shows it
    // as "Asset"), so the technician's notes get their own field.
    const body = {
      title: title,
      status: "new",
      priority: values.priority,
      assigned_to_id: values.assigneeId || null,
      linked_fault_id: fault.fault_id,
      details: {
        type: type,
        description: fault.asset_name || "Asset",
        diagnostic_notes: values.notes,
      },
    };

    setBusyId(id);
    try {
      await api.post("/work-orders", body);
      let toastType = "info";
      if (kind === "immediate") {
        toastType = "warning";
      }
      showToast(`Flagged for ${kind} repair. Work order created.`, toastType);
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
    setBusyId(null);
  }

  // ── Which faults still need diagnosis ────────────────
  const openFaults = faultsAwaitingDiagnosis(faults, workOrders);

  // ── Which fault the workspace shows ──────────────────
  let selected = openFaults.find((f) => f.fault_id === selectedId);
  if (!selected) {
    selected = openFaults[0]; // undefined when nothing is left to diagnose
  }

  // ── The popup, if one is open ────────────────────────
  let popup = null;
  if (dialog !== null) {
    const dialogFault = faults.find((f) => f.fault_id === dialog.faultId);

    if (dialog.kind === "close") {
      popup = (
        <Modal
          title="Close Fault"
          confirmLabel="Close Fault"
          onConfirm={() => {
            const id = dialog.faultId;
            setDialog(null);
            closeFault(id);
          }}
          onCancel={() => setDialog(null)}
        >
          <p>
            Confirm quick fix was successful and close fault{" "}
            <strong>{dialog.faultId}</strong>?
          </p>
        </Modal>
      );
    } else if (dialogFault) {
      popup = (
        <WorkOrderModal
          kind={dialog.kind}
          fault={dialogFault}
          users={users}
          onSubmit={(values) => {
            const id = dialog.faultId;
            const kind = dialog.kind;
            setDialog(null);
            createWorkOrder(id, kind, values);
          }}
          onCancel={() => setDialog(null)}
        />
      );
    }
  }

  // ── The diagnostics workspace ────────────────────────
  let workspace;
  if (!selected) {
    workspace = (
      <div className="card">
        <div className="diagnostics-header">
          <h2>Select an alert to begin diagnostics</h2>
        </div>
        <div className="empty-state">Nothing is waiting for diagnosis.</div>
      </div>
    );
  } else {
    const id = selected.fault_id;
    const busy = busyId === id;

    workspace = (
      <div className="card">
        <div className="diagnostics-header">
          <div>
            <h2>Active Diagnostics — {selected.alert_id || id}</h2>
            <small className="sub">{selected.asset_name || "—"}</small>
          </div>
        </div>

        <div className="main-grid">
          {/* LEFT: notes */}
          <div>
            <NotesSection
              key={"prelim-" + id}
              title="1. Preliminary Inspection Notes"
              description="Document initial findings, environmental factors, and baseline checks before attempting repairs."
              placeholder="e.g., Confirmed no planned maintenance was active. Inspected cooling intake and exhaust path for obstructions..."
              savedText={selected.prelim_notes || ""}
              saveLabel="Save Notes"
              busy={busy}
              onSave={(text) =>
                updateFault(
                  id,
                  { prelim_notes: text },
                  "Preliminary inspection notes saved.",
                  "success",
                )
              }
              onDelete={() =>
                updateFault(id, { prelim_notes: "" }, "Notes deleted.", "info")
              }
            />

            <NotesSection
              key={"quickfix-" + id}
              title="2. Quick Fix Attempt"
              description="Record any immediate actions taken and their specific outcome logic."
              placeholder="e.g., Executed cooling line purge and controller reset. Temperature dropped briefly, then returned above operating range after 3 minutes, indicating persistent mechanical friction."
              savedText={selected.quickfix_notes || ""}
              saveLabel="Save Quick Fix Logic"
              busy={busy}
              onSave={(text) =>
                updateFault(
                  id,
                  { quickfix_notes: text },
                  "Quick fix logic saved.",
                  "success",
                )
              }
              onDelete={() =>
                updateFault(
                  id,
                  { quickfix_notes: "" },
                  "Quick fix logic deleted.",
                  "info",
                )
              }
            >
              <div className="close-fault-bar">
                <button
                  type="button"
                  className="btn btn-light btn-full"
                  disabled={busy}
                  onClick={() => setDialog({ kind: "close", faultId: id })}
                >
                  Quick Fix Successful — Close Fault
                </button>
              </div>
            </NotesSection>
          </div>

          {/* RIGHT: data + classification */}
          <div>
            <SensorReadout
              fault={selected}
              allFaults={faults}
              alerts={alerts}
              readings={readings}
              meters={meters}
            />
            <Classification
              fault={selected}
              busy={busy}
              onFlag={(kind) => setDialog({ kind: kind, faultId: id })}
            />
          </div>
        </div>
      </div>
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
    let selectedFaultId = null;
    if (selected) {
      selectedFaultId = selected.fault_id;
    }

    content = (
      <div>
        <FaultTiles
          faults={openFaults}
          users={users}
          selectedId={selectedFaultId}
          onSelect={setSelectedId}
        />
        {workspace}
      </div>
    );
  }

  return (
    <div className="tech-page">
      <div className="page-header">
        <h1>Fault Detection &amp; Diagnostics</h1>
        <p>
          Pick an acknowledged alert, review the inspection and quick fix,
          compare the data, then log the final outcome.
        </p>
      </div>

      {content}
      {popup}

      <ToastStack toasts={toasts} />
    </div>
  );
}
