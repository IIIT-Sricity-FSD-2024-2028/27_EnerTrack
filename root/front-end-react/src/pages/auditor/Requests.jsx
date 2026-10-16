/**
 * Requests.jsx — Certified Energy Auditor: audit requests waiting for a decision.
 *
 * Asking for an audit used to create the organisation and its administrator
 * on the spot, for anyone. Now it only files a request, and nothing exists
 * until an auditor approves it here. Approving creates the organisation (as a
 * prospect) and its Organization Admin, who can then sign in. Denying creates
 * nothing and records a note the person sees if they try to sign in.
 *
 * The page keeps the list; each button asks for confirmation first, because an
 * approval cannot be undone from here.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";

import Modal from "../technician/components/Modal";
import ToastStack from "../technician/components/ToastStack";
import { useToast } from "../technician/components/useToast";
import Badge from "./components/Badge";
import RequestCard from "./requests/RequestCard";
import { formatDate } from "./auditorUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/shared/platform_shared.css";
import "./auditor.css";

export default function AuditorRequests() {
  const { user } = useAuth();
  const { toasts, showToast } = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // While a confirmation popup is open: { kind: "approve" | "deny", request }.
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function loadRequests() {
    return api
      .get("/audit-requests")
      .then((rows) => {
        setError("");
        setRequests(rows || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
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

    const body = { decided_by: user.user_id };
    if (kind === "deny" && note.trim()) body.note = note.trim();

    setBusy(true);
    try {
      await api.patch(
        "/audit-requests/" + request.request_id + "/" + kind,
        body,
      );
      if (kind === "approve") {
        showToast(
          "Approved " + request.name + ". They can sign in now.",
          "success",
        );
      } else {
        showToast("Denied " + request.name + ".", "success");
      }
    } catch (err) {
      // For example "already decided", or the name was taken in the meantime.
      showToast(err.message, "error");
    }
    setBusy(false);
    setDecision(null);
    await loadRequests();
  }

  // The backend sends newest first. Waiting requests read better oldest first,
  // like a queue.
  const pending = requests.filter((r) => r.status === "pending").reverse();
  const decided = requests.filter((r) => r.status !== "pending");

  let content;
  if (loading) {
    content = (
      <div className="card">
        <p className="muted">Loading requests…</p>
      </div>
    );
  } else if (error) {
    content = (
      <div className="card">
        <h2>Backend unavailable</h2>
        <p className="muted">{error}</p>
        <button type="button" className="btn btn-dark" onClick={loadRequests}>
          Retry
        </button>
      </div>
    );
  } else {
    content = (
      <>
        <div className="header-row" style={{ margin: "4px 0 12px" }}>
          <h2 style={{ margin: 0 }}>Waiting for a decision</h2>
          <span className="sub">{pending.length} request(s)</span>
        </div>

        {pending.length === 0 ? (
          <div className="card">
            <p className="muted">No requests are waiting.</p>
          </div>
        ) : (
          pending.map((request) => (
            <RequestCard
              key={request.request_id}
              request={request}
              onApprove={(r) => openDecision("approve", r)}
              onDeny={(r) => openDecision("deny", r)}
            />
          ))
        )}

        <div className="card">
          <h2>Decided</h2>
          {decided.length === 0 ? (
            <p className="muted">Nothing has been decided yet.</p>
          ) : (
            <table className="auditor-table" style={{ marginTop: "14px" }}>
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Contact</th>
                  <th>Decision</th>
                  <th>Decided</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.request_id}>
                    <td>{r.name}</td>
                    <td>{r.admin_email}</td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    <td>{formatDate(r.decided_at)}</td>
                    <td>{r.decision_note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  }

  return (
    <div>
      <header className="page-header">
        <span className="platform-tag">EnerTrack staff · all tenants</span>
        <h1 style={{ marginTop: "10px" }}>Audit requests</h1>
        <p>
          Organisations that asked for an audit. Nothing is created until you
          approve a request, so a request that is not genuine can simply be
          denied.
        </p>
      </header>

      {content}

      {decision && decision.kind === "approve" && (
        <Modal
          title="Approve request"
          confirmLabel={busy ? "Approving…" : "Approve"}
          onConfirm={confirmDecision}
          onCancel={() => !busy && setDecision(null)}
        >
          <p>
            Approve <strong>{decision.request.name}</strong>? This creates the
            organisation and an Organization Admin account for{" "}
            {decision.request.admin_name} ({decision.request.admin_email}), who
            can then sign in. It cannot be undone from here.
          </p>
        </Modal>
      )}

      {decision && decision.kind === "deny" && (
        <Modal
          title="Deny request"
          confirmLabel={busy ? "Denying…" : "Deny request"}
          danger
          onConfirm={confirmDecision}
          onCancel={() => !busy && setDecision(null)}
        >
          <p>
            Deny <strong>{decision.request.name}</strong>? Nothing will be
            created. If they try to sign in they will see your reason.
          </p>
          <textarea
            value={note}
            maxLength={500}
            rows={3}
            placeholder="Reason (optional)"
            style={{ width: "100%", marginTop: "10px" }}
            onChange={(e) => setNote(e.target.value)}
          />
        </Modal>
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}
