/**
 * Proposals — /admin/proposals ("EnerTrack Proposal"). Organization Admin
 * only: this is where a client answers the proposal EnerTrack's auditor sent.
 * Replaces js/system_admin/modules/proposalManager.js.
 *
 * What the page shows depends on how far the organisation has got:
 *   no audit yet        -> "Start with a site audit" + Request button
 *   audit under way     -> "Audit requested" / "Audit underway"
 *   proposal received   -> the proposal, with Accept / Request changes /
 *                          Decline
 *   answered proposals  -> a history table
 *
 * Every rule (tier big enough, no second subscription, dates) is checked by
 * the backend; this page only asks and shows the answer.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import AdminPage from "./AdminPage";
import Modal from "./Modal";
import { addToast, formatCurrency } from "./adminHelpers";

// The words of each answer's popup, and its toast afterwards
const ANSWERS = {
  accept: {
    title: "Accept this proposal",
    text: "Your subscription starts today and billing begins from this month.",
    small:
      "Your auditor is notified, and your team's dashboards are enabled immediately.",
    confirm: "Accept and start",
    needsNote: false,
    toast: "Accepted. Your subscription is live.",
  },
  "request-changes": {
    title: "Request changes",
    text: "What would you like changed?",
    small:
      "Your auditor sees this and sends a revised proposal. Nothing is charged in the meantime.",
    confirm: "Send to auditor",
    needsNote: true,
    toast: "Sent. Your auditor will revise the proposal.",
  },
  decline: {
    title: "Decline this proposal",
    text: "Let your auditor know why.",
    small: "Nothing is charged. You can be re-quoted later.",
    confirm: "Decline",
    needsNote: true,
    toast: "Declined.",
  },
};

// Small grey uppercase label used above facts and lists
const labelStyle = {
  textTransform: "uppercase",
  letterSpacing: ".04em",
  fontSize: "11px",
  fontWeight: 700,
};

export default function Proposals() {
  const { user } = useAuth();
  const [audits, setAudits] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  // The open popup: null, { type: "request" }, or
  // { type: "answer", action: "accept" | "request-changes" | "decline", audit }
  const [modal, setModal] = useState(null);

  // Load this organisation's audits (the backend only sends its own) and the
  // tiers, to show the recommended one's name, seats and features
  useEffect(() => {
    Promise.all([
      api.get("/energy-audits").catch(() => []),
      api.get("/subscription-plans").catch(() => []),
    ])
      .then(([auditList, planList]) => {
        setAudits(Array.isArray(auditList) ? auditList : []);
        setPlans(Array.isArray(planList) ? planList : []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function reloadAudits() {
    const list = await api.get("/energy-audits").catch(() => audits);
    setAudits(Array.isArray(list) ? list : audits);
  }

  // Called by the "Request an energy audit" popup
  async function handleRequest(note) {
    setModal(null);
    try {
      await api.post("/energy-audits/request", note ? { note } : {});
      await reloadAudits();
      addToast(
        setToasts,
        "Audit requested. Your auditor has been notified.",
        "success",
      );
    } catch (err) {
      addToast(
        setToasts,
        err.message || "Could not request an audit.",
        "error",
      );
    }
  }

  // Called by the Accept / Request changes / Decline popup
  async function handleAnswer(action, audit, note) {
    setModal(null);
    try {
      await api.patch(
        `/energy-audits/${audit.audit_id}/proposal/${action}`,
        action === "accept"
          ? { accepted_by: user.user_id }
          : { response_note: note, responded_by: user.user_id },
      );
      // Accepting also creates the subscription and makes the organisation
      // active, so read the audits again rather than guess
      await reloadAudits();
      addToast(setToasts, ANSWERS[action].toast, "success");
    } catch (err) {
      addToast(
        setToasts,
        err.message || "Could not send your answer.",
        "error",
      );
    }
  }

  const planOf = (id) => plans.find((p) => p.plan_id === id);
  const openProposals = audits.filter(
    (a) =>
      a.proposal &&
      (a.status === "proposed" || a.status === "changes-requested"),
  );
  const answered = audits.filter(
    (a) => a.proposal && (a.status === "accepted" || a.status === "declined"),
  );

  return (
    <AdminPage
      subtitle="What EnerTrack's auditor recommends for your organisation, and what it would cost."
      requiredRole="Organization Admin"
      loading={loading}
      toasts={toasts}
    >
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Proposal from EnerTrack</h2>
            <p>
              What your certified auditor recommends for your organisation, and
              what it would cost. Accepting starts your subscription.
            </p>
          </div>
        </div>

        <Stage
          audits={audits}
          onRequest={() => setModal({ type: "request" })}
        />

        {openProposals.map((audit) => (
          <ProposalCard
            key={audit.audit_id}
            audit={audit}
            plan={planOf(audit.proposal.recommended_plan_id)}
            onAnswer={(action) => setModal({ type: "answer", action, audit })}
          />
        ))}

        {answered.length > 0 && <History audits={answered} planOf={planOf} />}
      </section>

      {/* ── Popups (only one is open at a time) ── */}
      {modal?.type === "request" && (
        <NoteModal
          title="Request an energy audit"
          confirmLabel="Request audit"
          text="A certified auditor will be assigned and will contact you to arrange the site visit."
          small="Nothing is charged for this. You only pay once you accept the proposal that follows."
          noteLabel="Anything they should know? (optional)"
          noteId="auditNote"
          placeholder="e.g. two blocks, no sub-metering, bills have doubled since 2024"
          noteRequired={false}
          onConfirm={handleRequest}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "answer" && (
        <NoteModal
          title={ANSWERS[modal.action].title}
          confirmLabel={ANSWERS[modal.action].confirm}
          danger={modal.action === "decline"}
          text={ANSWERS[modal.action].text}
          small={ANSWERS[modal.action].small}
          noteLabel={ANSWERS[modal.action].needsNote ? "Your note" : null}
          noteId="respNote"
          placeholder="e.g. we are hiring four more technicians next term — will this tier still fit?"
          noteRequired={ANSWERS[modal.action].needsNote}
          onConfirm={(note) => handleAnswer(modal.action, modal.audit, note)}
          onClose={() => setModal(null)}
        />
      )}
    </AdminPage>
  );
}

/* ── Where the organisation is: request an audit, or audit under way ── */

function Stage({ audits, onRequest }) {
  const running = audits.find(
    (a) => a.status === "scheduled" || a.status === "in-progress",
  );
  const hasProposal = audits.some((a) => a.proposal);

  if (running) {
    const scheduled = running.status === "scheduled";
    return (
      <div
        className="table-card"
        style={{ padding: "20px", marginBottom: "16px" }}
      >
        <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>
          {scheduled ? "Audit requested" : "Audit underway"}
        </h3>
        <p className="muted-cell">
          {scheduled
            ? "A certified energy auditor has been assigned and will be in touch to arrange the site visit."
            : "Your auditor is writing up the site survey. A proposal follows once they are done."}
        </p>
      </div>
    );
  }

  // Already has a proposal (open or answered): nothing to add here
  if (hasProposal) return null;

  // Never asked for an audit: the request button IS the page
  return (
    <div
      className="table-card"
      style={{ padding: "24px", marginBottom: "16px" }}
    >
      <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>
        Start with a site audit
      </h3>
      <p className="muted-cell" style={{ maxWidth: "60ch", lineHeight: 1.6 }}>
        A certified energy auditor visits your campus, records what metering you
        already have, and writes up where the savings are — each measure with
        its cost, its saving and its payback. You then get one proposal with the
        recommended tier and what it costs.
      </p>
      <p className="muted-cell" style={{ marginTop: "10px" }}>
        Nothing is charged until you accept that proposal.
      </p>
      <button
        className="btn-dark"
        type="button"
        style={{ marginTop: "16px" }}
        onClick={onRequest}
      >
        Request an energy audit
      </button>
    </div>
  );
}

/* ── One proposal waiting for an answer ── */

function ProposalCard({ audit, plan, onAnswer }) {
  const proposal = audit.proposal;
  const findings = audit.findings || [];
  // Add up the yearly saving of every recommendation from the audit
  const saving = findings.reduce(
    (sum, f) => sum + (f.est_annual_saving || 0),
    0,
  );
  const waitingForRevision = audit.status === "changes-requested";

  let campusNote = "";
  if (plan) {
    campusNote =
      plan.max_campuses === null
        ? "unlimited in this tier"
        : `${plan.max_campuses} allowed`;
  }

  return (
    <div
      className="table-card"
      style={{ padding: "20px", marginBottom: "16px" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
        }}
      >
        <div>
          <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>
            {plan?.name ?? proposal.recommended_plan_id}
          </h3>
          <p className="muted-cell">{plan?.tagline ?? ""}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "26px", fontWeight: 700 }}>
            {formatCurrency(proposal.monthly_estimate)}
          </div>
          <div className="muted-cell">per month, before GST</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginTop: "20px",
        }}
      >
        <Fact
          label="Staff counted on site"
          value={`${proposal.estimated_staff}`}
          note={plan ? `${plan.included_seats} included in this tier` : ""}
        />
        <Fact
          label="Campuses"
          value={`${proposal.estimated_campuses}`}
          note={campusNote}
        />
        <Fact
          label="Savings identified"
          value={formatCurrency(saving)}
          note={`${findings.length} recommendation(s) from the audit`}
        />
      </div>

      {plan?.features?.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <div
            className="muted-cell"
            style={{ ...labelStyle, marginBottom: "8px" }}
          >
            What is included
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            {plan.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
      )}

      {waitingForRevision ? (
        <p
          className="muted-cell"
          style={{
            marginTop: "18px",
            padding: "10px 12px",
            background: "#fef3c7",
            borderRadius: "6px",
          }}
        >
          You asked for changes on {proposal.responded_on ?? ""}: “
          {proposal.response_note ?? ""}”
          <br />
          Waiting on a revised proposal from your auditor.
        </p>
      ) : (
        <>
          <p className="muted-cell" style={{ marginTop: "18px" }}>
            This is an estimate based on what the auditor counted. Your first
            invoice bills your actual staff count, so it may differ slightly.
          </p>
          <div className="row-actions" style={{ marginTop: "14px" }}>
            <button
              className="btn-dark"
              type="button"
              onClick={() => onAnswer("accept")}
            >
              Accept and start subscription
            </button>
            <button
              className="btn-outline"
              type="button"
              onClick={() => onAnswer("request-changes")}
            >
              Request changes
            </button>
            <button
              className="btn-outline btn-danger"
              type="button"
              onClick={() => onAnswer("decline")}
            >
              Decline
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── One figure on the proposal card ── */

function Fact({ label, value, note }) {
  return (
    <div>
      <div className="muted-cell" style={labelStyle}>
        {label}
      </div>
      <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>
        {value}
      </div>
      {note && <div className="muted-cell">{note}</div>}
    </div>
  );
}

/* ── Proposals already accepted or declined ── */

function History({ audits, planOf }) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Monthly</th>
              <th>Sent</th>
              <th>Answered</th>
              <th>Outcome</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((a) => (
              <tr key={a.audit_id}>
                <td>
                  <strong>
                    {planOf(a.proposal.recommended_plan_id)?.name ??
                      a.proposal.recommended_plan_id}
                  </strong>
                </td>
                <td>{formatCurrency(a.proposal.monthly_estimate)}</td>
                <td>{a.proposal.sent_on ?? "—"}</td>
                <td>{a.proposal.responded_on ?? "—"}</td>
                <td>
                  <span
                    className={
                      a.status === "accepted" ? "badge active" : "badge churned"
                    }
                  >
                    {a.status}
                  </span>
                </td>
                <td className="muted-cell">
                  {a.proposal.response_note ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── A popup with two sentences and (sometimes) a note box ──
   Used for "Request an energy audit" (optional note) and for answering a
   proposal (Accept: no note; Request changes / Decline: note required). */

function NoteModal({
  title,
  confirmLabel,
  danger = false,
  text,
  small,
  noteLabel,
  noteId,
  placeholder,
  noteRequired,
  onConfirm,
  onClose,
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function handleConfirm() {
    const trimmed = note.trim();
    if (noteRequired && !trimmed) {
      setError("Tell your auditor what to change.");
      return; // the popup stays open
    }
    onConfirm(trimmed);
  }

  return (
    <Modal
      title={title}
      confirmLabel={confirmLabel}
      danger={danger}
      onConfirm={handleConfirm}
      onClose={onClose}
    >
      <p>{text}</p>
      <p className="muted-cell">{small}</p>
      {noteLabel && (
        <div className="form-field full" style={{ marginTop: "12px" }}>
          <label htmlFor={noteId}>{noteLabel}</label>
          <textarea
            id={noteId}
            rows="3"
            placeholder={placeholder}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          ></textarea>
          {noteRequired && <span className="field-error">{error}</span>}
        </div>
      )}
    </Modal>
  );
}
