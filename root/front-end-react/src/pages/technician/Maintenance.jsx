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
 *
 * Data comes from the Redux store, refreshed every 30 seconds by useLiveData.
 */
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../auth/useAuth";
import { useLiveData } from "../../store/useLiveData";
import {
  fetchFaults,
  selectAllFaults,
  updateFault as updateFaultThunk,
} from "../../store/slices/faultsSlice";
import {
  fetchAlerts,
  selectAllAlerts,
  updateAlert,
} from "../../store/slices/alertsSlice";
import { fetchUsers, selectAllUsers } from "../../store/slices/usersSlice";
import {
  fetchMeterReadings,
  selectAllMeterReadings,
} from "../../store/slices/meterReadingsSlice";
import { fetchMeters, selectAllMeters } from "../../store/slices/metersSlice";
import {
  fetchWorkOrders,
  selectAllWorkOrders,
} from "../../store/slices/workOrdersSlice";
import { sendFault } from "../../store/slices/dispatchSlice";

import Modal from "./components/Modal";
import { useToast } from "../../ui/useToast";
import FaultTiles from "./maintenance/FaultTiles";
import NotesSection from "./maintenance/NotesSection";
import SensorReadout from "./maintenance/SensorReadout";
import Classification from "./maintenance/Classification";
import WorkOrderModal from "./maintenance/WorkOrderModal";
import { faultsAwaitingDiagnosis, userName } from "./techUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/technician/tech_maintenance.css";
import "./technician.css";

// Every list the page needs.
const LOADS = [
  fetchFaults,
  fetchUsers,
  fetchAlerts,
  fetchMeterReadings,
  fetchMeters,
  fetchWorkOrders,
];

export default function TechnicianMaintenance() {
  const { user } = useAuth();
  const showToast = useToast();
  const dispatch = useDispatch();

  const faults = useSelector(selectAllFaults);
  const users = useSelector(selectAllUsers);
  const alerts = useSelector(selectAllAlerts);
  const readings = useSelector(selectAllMeterReadings);
  const meters = useSelector(selectAllMeters);
  const workOrders = useSelector(selectAllWorkOrders);

  // A refresh does not wipe a half-typed note: NotesSection keeps its draft
  // as long as its key (the fault id) stays the same.
  const { loading, error, reload } = useLiveData(LOADS);

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

  /**
   * PATCH a fault and report the result. Returns true if it worked, so
   * NotesSection knows whether to leave edit mode.
   */
  async function updateFault(id, body, message, toastType) {
    setBusyId(id);
    let ok = false;
    try {
      await dispatch(updateFaultThunk({ id, changes: body })).unwrap();
      showToast(message, toastType);
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
      await dispatch(
        updateFaultThunk({ id, changes: { status: "resolved" } }),
      ).unwrap();
      // The alert that raised this fault is finished too.
      if (fault && fault.alert_id) {
        await dispatch(
          updateAlert({ id: fault.alert_id, changes: { status: "resolved" } }),
        ).unwrap();
      }
      showToast(`Fault ${id} resolved and logged.`, "success");
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

    // The system turns the fault into a job: team from the kind of fault,
    // one ranked technician, an acknowledge window and a deadline. Picking a
    // person here overrides the choice.
    setBusyId(id);
    try {
      // Reloads faults, work orders and the queue itself when it succeeds.
      await dispatch(
        sendFault({
          faultId: fault.fault_id,
          kind: kind === "immediate" ? "immediate" : "scheduled",
          priority: values.priority,
          assigneeId: values.assigneeId,
          notes: values.notes,
        }),
      ).unwrap();
      let toastType = "info";
      if (kind === "immediate") {
        toastType = "warning";
      }
      showToast(`Flagged for ${kind} repair. Sent to a technician.`, toastType);
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
          <h2>Select a fault to begin diagnostics</h2>
        </div>
        <div className="empty-state">Nothing is waiting for diagnosis.</div>
      </div>
    );
  } else {
    const id = selected.fault_id;
    const busy = busyId === id;
    // Whoever a fault is assigned to diagnoses it; everyone else can follow
    // along but not change it. An unassigned fault is open to anyone, so it
    // can still be picked up. Same rule as work orders.
    const readOnly =
      Boolean(selected.assigned_to_id) &&
      selected.assigned_to_id !== user?.user_id;

    workspace = (
      <div className="card">
        <div className="diagnostics-header">
          <div>
            <h2>Active Diagnostics — {id}</h2>
            <small className="sub">
              {selected.asset_name || "—"}
              {selected.alert_id ? ` · from alert ${selected.alert_id}` : ""}
            </small>
          </div>
        </div>

        {readOnly && (
          <p className="callout stage-note mb-16">
            Assigned to {userName(users, selected.assigned_to_id)}. You can
            follow the diagnosis here; only they can update it.
          </p>
        )}

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
              readOnly={readOnly}
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
              readOnly={readOnly}
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
              {!readOnly && (
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
              )}
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
              readOnly={readOnly}
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
        <button type="button" className="btn btn-dark" onClick={reload}>
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
          Work out what is wrong with each confirmed fault. Resolve it here if a
          quick fix works, or flag it for a work order if it needs a repair.
        </p>
      </div>

      {content}
      {popup}

    </div>
  );
}
