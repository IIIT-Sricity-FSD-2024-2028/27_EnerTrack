/**
 * StatusCard — moves an engagement between Scheduled and In progress.
 *
 * Those are the only two statuses the auditor sets by hand. After that,
 * sending the proposal makes it "proposed", and the client's answer makes
 * it "changes-requested", "accepted" or "declined". (The old page had a
 * "Mark completed" button, but the backend no longer has that status.)
 */
import api from "../../../api/client";
import { label } from "../auditorUtils";

export default function StatusCard({ audit, onSaved, showToast }) {
  const manual = audit.status === "scheduled" || audit.status === "in-progress";

  function setStatus(status) {
    const body = { status: status };

    // Starting the visit records today as the visit date, if none is set.
    if (status === "in-progress" && !audit.conducted_on) {
      body.conducted_on = new Date().toISOString().slice(0, 10);
    }

    api
      .patch("/energy-audits/" + audit.audit_id, body)
      .then((updated) => {
        onSaved(updated);
        showToast("Engagement marked " + label(status) + ".", "success");
      })
      .catch((err) => {
        showToast(err.message, "error");
      });
  }

  return (
    <div className="card">
      <h2>Engagement status</h2>
      <p className="sub">Currently {label(audit.status)}.</p>

      {manual && (
        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
          <button
            type="button"
            className="btn btn-light"
            onClick={() => setStatus("scheduled")}
          >
            Scheduled
          </button>
          <button
            type="button"
            className="btn btn-green"
            onClick={() => setStatus("in-progress")}
          >
            In progress
          </button>
        </div>
      )}

      {!manual && (
        <p className="muted" style={{ fontSize: "12px", marginTop: "12px" }}>
          The proposal has been sent, so the status now follows the
          client&apos;s answer.
        </p>
      )}
    </div>
  );
}
