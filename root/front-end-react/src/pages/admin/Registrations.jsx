/**
 * Registrations — /admin/registrations. Super Admin only.
 *
 * "Register your organisation" on the public site only files a request:
 * nothing exists until a Super Admin approves it here. Approving creates the
 * organisation (as a prospect) and its Organization Admin, who can then sign
 * in with the password they chose. Rejecting creates nothing and records a
 * note the person sees if they try to sign in.
 *
 * The backend still calls these "audit requests" (/audit-requests, approve /
 * deny); only the screen uses the plainer words.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import AdminPage from "./AdminPage";
import Modal from "./Modal";
import { addToast } from "./adminHelpers";

const STATUS_LABELS = { approved: "Approved", denied: "Rejected" };

/** "17 Oct 2026" */
function formatDay(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Registrations() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  // The open popup: null, or { kind: "approve" | "deny", request }
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function loadRequests() {
    return api
      .get("/audit-requests")
      .then((rows) => setRequests(Array.isArray(rows) ? rows : []))
      .catch((err) =>
        addToast(
          setToasts,
          err.message || "Could not load registrations.",
          "error",
        ),
      )
      .finally(() => setLoading(false));
  }

  // Load once, when the page opens.
  useEffect(() => {
    loadRequests();
  }, []);

  function openDecision(kind, request) {
    setNote("");
    setDecision({ kind, request });
  }

  async function confirmDecision() {
    if (busy) return;
    const { kind, request } = decision;
    // Who decided comes from the sign-in token on the server.
    const body = {};
    if (kind === "deny" && note.trim()) body.note = note.trim();

    setBusy(true);
    try {
      await api.patch(`/audit-requests/${request.request_id}/${kind}`, body);
      addToast(
        setToasts,
        kind === "approve"
          ? `Approved ${request.name}. Their administrator can sign in now.`
          : `Rejected ${request.name}.`,
        "success",
      );
    } catch (err) {
      // For example "already decided", or the name was taken in the meantime.
      addToast(setToasts, err.message, "error");
    }
    setBusy(false);
    setDecision(null);
    await loadRequests();
  }

  // The backend sends newest first. Waiting requests read better oldest
  // first, like a queue.
  const pending = requests.filter((r) => r.status === "pending").reverse();
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <AdminPage
      subtitle="Organisations asking to join EnerTrack. Approve one to create its account."
      requiredRole="Super Admin"
      loading={loading}
      toasts={toasts}
    >
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Waiting for approval</h2>
            <p>
              Approving creates the organisation and its administrator, using
              the details below. It cannot be undone from here.
            </p>
          </div>
        </div>

        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Administrator</th>
                  <th>Email domain</th>
                  <th>Floor area</th>
                  <th>Requested</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        No organisations are waiting for approval.
                      </div>
                    </td>
                  </tr>
                ) : (
                  pending.map((r) => (
                    <tr key={r.request_id}>
                      <td>
                        <strong>{r.name}</strong>
                        <div className="muted-cell">
                          {r.type}
                          {r.location ? `, ${r.location}` : ""}
                        </div>
                      </td>
                      <td>
                        {r.admin_name}
                        <div className="muted-cell">{r.admin_email}</div>
                        {r.admin_phone && (
                          <div className="muted-cell">{r.admin_phone}</div>
                        )}
                      </td>
                      <td>{r.email_domain || "-"}</td>
                      <td>
                        {r.floor_area_sqm
                          ? Number(r.floor_area_sqm).toLocaleString("en-IN") +
                            " m²"
                          : "-"}
                      </td>
                      <td>{formatDay(r.requested_at)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-btn btn-danger"
                            type="button"
                            onClick={() => openDecision("deny", r)}
                          >
                            Reject
                          </button>
                          <button
                            className="btn-dark"
                            type="button"
                            onClick={() => openDecision("approve", r)}
                          >
                            Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Decided</h2>
            <p>Every registration that has been approved or rejected.</p>
          </div>
        </div>

        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Administrator</th>
                  <th>Decision</th>
                  <th>Decided</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {decided.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="empty-state">
                        Nothing has been decided yet.
                      </div>
                    </td>
                  </tr>
                ) : (
                  decided.map((r) => (
                    <tr key={r.request_id}>
                      <td>
                        <strong>{r.name}</strong>
                        <div className="muted-cell">{r.type}</div>
                      </td>
                      <td>
                        {r.admin_name}
                        <div className="muted-cell">{r.admin_email}</div>
                      </td>
                      <td>
                        <span
                          className={`badge ${r.status === "approved" ? "active" : ""}`}
                        >
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td>{formatDay(r.decided_at)}</td>
                      <td>{r.decision_note || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {decision?.kind === "approve" && (
        <Modal
          title="Approve registration"
          confirmLabel={busy ? "Approving…" : "Approve"}
          confirmDisabled={busy}
          onConfirm={confirmDecision}
          onClose={() => setDecision(null)}
        >
          <p>
            Approve <strong>{decision.request.name}</strong>?
          </p>
          <p className="muted-cell">
            This creates the organisation as a prospect and makes{" "}
            {decision.request.admin_name} ({decision.request.admin_email}) its
            Organization Admin. They can sign in straight away with the
            password they chose.
          </p>
        </Modal>
      )}

      {decision?.kind === "deny" && (
        <Modal
          title="Reject registration"
          confirmLabel={busy ? "Rejecting…" : "Reject"}
          danger
          confirmDisabled={busy}
          onConfirm={confirmDecision}
          onClose={() => setDecision(null)}
        >
          <p>
            Reject <strong>{decision.request.name}</strong>? Nothing is
            created.
          </p>
          <div className="form-field full" style={{ marginTop: "12px" }}>
            <label htmlFor="rejectNote">Reason (optional)</label>
            <textarea
              id="rejectNote"
              rows={3}
              maxLength={500}
              placeholder="For example: we do not cover your region yet."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <span className="muted-cell">
              Shown to {decision.request.admin_name} if they try to sign in.
            </span>
          </div>
        </Modal>
      )}
    </AdminPage>
  );
}
