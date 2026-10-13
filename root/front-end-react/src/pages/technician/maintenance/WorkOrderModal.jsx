/**
 * WorkOrderModal — the popup form that turns a diagnosed fault into a work
 * order, after "Flag Scheduled Maintenance" or "Flag Immediate Repair".
 *
 * It owns the form fields while the popup is open and hands the finished
 * values to the page with onSubmit({ priority, assigneeId, notes }). The page
 * does the actual POST.
 *
 * The page only renders this while the popup is open, so every time it
 * opens it is a fresh component and the fields start from the fault again.
 *
 * Ported from getWOModalHTML() in js/technician/maintenancePage.js.
 */
import { useState } from "react";
import Modal from "../components/Modal";
import { assignableUsers } from "../techUtils";

/** Suggested priority for a scheduled repair, from the fault's severity. */
function defaultPriority(kind, severity) {
  if (kind === "immediate") {
    return "immediate";
  }
  if (severity === "high" || severity === "critical") {
    return "high";
  }
  if (severity === "moderate") {
    return "medium";
  }
  return "low";
}

/** Carry the technician's notes over, newest stage first. */
function defaultNotes(fault) {
  if (fault.quickfix_notes) {
    return fault.quickfix_notes;
  }
  if (fault.prelim_notes) {
    return fault.prelim_notes;
  }
  return "Diagnostics flagged this fault.";
}

export default function WorkOrderModal({
  kind,
  fault,
  users,
  onSubmit,
  onCancel,
}) {
  // useState only uses its starting value the first time the component is
  // drawn — which is exactly when the popup opens.
  const [priority, setPriority] = useState(
    defaultPriority(kind, fault.severity),
  );
  const [assigneeId, setAssigneeId] = useState(fault.assigned_to_id || "");
  const [notes, setNotes] = useState(defaultNotes(fault));

  const technicians = assignableUsers(users);

  let title = "Setup Scheduled Work Order";
  let confirmLabel = "Create Work Order";
  if (kind === "immediate") {
    title = "Setup Immediate Repair Work Order";
    confirmLabel = "Create Urgent Work Order";
  }

  // An immediate repair is always top priority, so it gets a single option.
  let priorityOptions;
  if (kind === "immediate") {
    priorityOptions = <option value="immediate">Immediate (Emergency)</option>;
  } else {
    priorityOptions = (
      <>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </>
    );
  }

  function handleConfirm() {
    onSubmit({ priority, assigneeId, notes });
  }

  return (
    <Modal
      title={title}
      confirmLabel={confirmLabel}
      danger={kind === "immediate"}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    >
      <div className="wo-form">
        <div className="field">
          <label htmlFor="woAsset">Asset</label>
          <input
            id="woAsset"
            type="text"
            value={fault.asset_name || "Unknown Asset"}
            readOnly
          />
        </div>

        <div className="wo-form-row">
          <div className="field">
            <label htmlFor="woPriority">Priority</label>
            <select
              id="woPriority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              {priorityOptions}
            </select>
          </div>
          <div className="field">
            <label htmlFor="woAssignee">Assignee</label>
            <select
              id="woAssignee"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {technicians.map((tech) => (
                <option key={tech.user_id} value={tech.user_id}>
                  {tech.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="woNotes">Diagnostic Notes to Transfer</label>
          <textarea
            id="woNotes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
