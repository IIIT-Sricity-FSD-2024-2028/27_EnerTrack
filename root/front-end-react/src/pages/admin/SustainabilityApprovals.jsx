/**
 * Sustainability approvals — where the Organization Admin decides on what the
 * Sustainability Officer proposes: targets and initiatives. The Org Admin
 * cannot open the Sustainability Officer's pages, so the decisions live here.
 * The proposer is notified of every decision (server side).
 */
import { useCallback, useEffect, useId, useState } from "react";
import api from "../../api/client";
import AdminPage from "./AdminPage";
import { addToast } from "./adminHelpers";
import TargetCard from "../sustainability/components/TargetCard";
import ReportDocument from "../sustainability/components/ReportDocument";
import { periodName } from "../sustainability/periods";
import "../sustainability/components/targets.css";

function Decision({ busy, onApprove, onReject, approveLabel = "Approve", rejectLabel = "Reject" }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const reasonId = useId();
  if (!rejecting)
    return (
      <>
        <button type="button" className="tbtn tbtn--primary" disabled={busy} onClick={onApprove}>
          {approveLabel}
        </button>
        <button type="button" className="tbtn tbtn--danger" disabled={busy} onClick={() => setRejecting(true)}>
          {rejectLabel}
        </button>
      </>
    );
  return (
    <div className="treason" style={{ width: "100%", marginTop: 0 }}>
      <label htmlFor={reasonId}>Reason (sent to the proposer)</label>
      <textarea id={reasonId} rows="2" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      <div style={{ display: "flex", gap: "8px" }}>
        <button type="button" className="tbtn tbtn--danger" disabled={busy || !reason.trim()} onClick={() => onReject(reason.trim())}>
          Confirm: {rejectLabel.toLowerCase()}
        </button>
        <button type="button" className="tbtn" disabled={busy} onClick={() => setRejecting(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SustainabilityApprovals() {
  const [targets, setTargets] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [reports, setReports] = useState([]);
  const [openReport, setOpenReport] = useState(null);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [tab, setTab] = useState("targets");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [t, i, u, r] = await Promise.all([
        api.get("/targets"),
        api.get("/initiatives"),
        api.get("/users").catch(() => []),
        api.get("/sustainability-reports"),
      ]);
      setReports(Array.isArray(r) ? r : []);
      setTargets(Array.isArray(t) ? t : []);
      setInitiatives(Array.isArray(i) ? i : []);
      setNames(Object.fromEntries((Array.isArray(u) ? u : []).map((x) => [x.user_id, x.name])));
      setError(null);
    } catch (err) {
      setError(err.message || "Could not load proposals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const decideTarget = async (t, status, note) => {
    setBusyId(t.target_id);
    try {
      const updated = await api.patch(`/targets/${t.target_id}/status`, { status, ...(note ? { note } : {}) });
      setTargets((list) => list.map((x) => (x.target_id === t.target_id ? updated : x)));
      addToast(
        setToasts,
        {
          active: "Target approved. Tracking has started.",
          rejected: "Target rejected.",
          met: "Target closed as met.",
          missed: "Target closed as missed.",
        }[status],
        "success",
      );
    } catch (err) {
      addToast(setToasts, err.message || "Could not save the decision.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const decideInitiative = async (i, status, note) => {
    setBusyId(i.initiative_id);
    try {
      const updated = await api.patch(`/initiatives/${i.initiative_id}`, { status, ...(note ? { decision_note: note } : {}) });
      setInitiatives((list) => list.map((x) => (x.initiative_id === i.initiative_id ? { ...x, ...updated } : x)));
      addToast(setToasts, status === "approved" ? "Initiative approved." : "Initiative rejected.", "success");
    } catch (err) {
      addToast(setToasts, err.message || "Could not save the decision.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const decideReport = async (r, status, note) => {
    setBusyId(r.report_id);
    try {
      const updated = await api.patch(`/sustainability-reports/${r.report_id}/status`, { status, ...(note ? { note } : {}) });
      setReports((list) => list.map((x) => (x.report_id === r.report_id ? { ...x, ...updated } : x)));
      addToast(
        setToasts,
        { approved: "Report approved. Publish it when ready.", draft: "Report sent back to the Sustainability Officer.", published: "Report published." }[status],
        "success",
      );
    } catch (err) {
      addToast(setToasts, err.message || "Could not save the decision.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const waitingReports = reports.filter((r) => r.status === "submitted");
  const readyReports = reports.filter((r) => r.status === "approved");

  const waitingTargets = targets.filter((t) => t.status === "proposed");
  const activeTargets = targets.filter((t) => t.status === "active");
  const waitingInitiatives = initiatives.filter((i) => String(i.status).toLowerCase() === "proposed" && !i.archived_at);
  const by = (id) => (names[id] ? `Proposed by ${names[id]}` : null);

  return (
    <AdminPage
      subtitle="Targets and initiatives the Sustainability Officer has asked you to approve."
      requiredRole="Organization Admin"
      loading={loading}
      toasts={toasts}
    >
      {error && (
        <p role="alert" className="tempty" style={{ color: "#991b1b", borderStyle: "solid" }}>
          {error}
        </p>
      )}

      <div className="arc-tabs" role="tablist" aria-label="Approval type" style={{ display: "inline-flex", gap: "4px", padding: "4px", background: "#e5e7eb", borderRadius: "8px", marginBottom: "16px" }}>
        {[
          ["targets", `Targets (${waitingTargets.length} waiting)`],
          ["initiatives", `Initiatives (${waitingInitiatives.length} waiting)`],
          ["reports", `Reports (${waitingReports.length + readyReports.length} waiting)`],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="tbtn"
            style={tab === id ? { background: "#ffffff", borderColor: "#ffffff" } : { background: "transparent", borderColor: "transparent", fontWeight: 500 }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "targets" && (
        <>
          <section className="tsection" aria-labelledby="wt-heading">
            <h2 id="wt-heading">Waiting for your decision</h2>
            {waitingTargets.length === 0 ? (
              <p className="tempty">No targets are waiting for approval.</p>
            ) : (
              <div className="tlist">
                {waitingTargets.map((t) => (
                  <TargetCard
                    key={t.target_id}
                    target={t}
                    actions={
                      <Decision
                        busy={busyId === t.target_id}
                        onApprove={() => decideTarget(t, "active")}
                        onReject={(note) => decideTarget(t, "rejected", note)}
                      />
                    }
                  >
                    {by(t.created_by_id) && <p className="tcard__basis">{by(t.created_by_id)}</p>}
                  </TargetCard>
                ))}
              </div>
            )}
          </section>

          <section className="tsection" aria-labelledby="at-heading">
            <h2 id="at-heading">Active targets</h2>
            {activeTargets.length === 0 ? (
              <p className="tempty">No active targets.</p>
            ) : (
              <div className="tlist">
                {activeTargets.map((t) => (
                  <TargetCard
                    key={t.target_id}
                    target={t}
                    actions={
                      <>
                        {["met", "missed"].map((outcome) => (
                          <button
                            key={outcome}
                            type="button"
                            className={`tbtn${outcome === "missed" ? " tbtn--danger" : ""}`}
                            disabled={busyId === t.target_id}
                            onClick={() => {
                              if (window.confirm(`Close this target as ${outcome} now, before its deadline? This cannot be undone.`))
                                decideTarget(t, outcome);
                            }}
                          >
                            Close as {outcome}
                          </button>
                        ))}
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "initiatives" && (
        <section className="tsection" aria-labelledby="wi-heading">
          <h2 id="wi-heading">Waiting for your decision</h2>
          {waitingInitiatives.length === 0 ? (
            <p className="tempty">No initiatives are waiting for approval.</p>
          ) : (
            <div className="tlist">
              {waitingInitiatives.map((i) => (
                <article key={i.initiative_id} className="tcard">
                  <div className="tcard__head">
                    <h3 className="tcard__title">{i.title}</h3>
                    <span className="tcard__chip tcard__chip--wait">Waiting for approval</span>
                  </div>
                  {i.description && <p className="tcard__note">{i.description}</p>}
                  <p className="tcard__basis" style={{ fontSize: "13px" }}>
                    {[
                      i.source_finding && `From an energy audit${i.expected_saving_amount ? ` (promised ${i.expected_saving_amount.toLocaleString("en-GB")} a year)` : ""}`,
                      i.metric &&
                        i.expected_saving != null &&
                        `Expected to save ${Number(i.expected_saving).toLocaleString("en-GB")} ${{ energy_kwh: "kWh", water_kl: "kL", gas_m3: "m³", emissions_kg: "kg CO₂e" }[i.metric]} a year`,
                      i.target_reduction && `Target reduction ${i.target_reduction}`,
                      typeof i.capex === "number" && `Cost ${i.capex.toLocaleString("en-GB")}`,
                      i.target_date &&
                        `Finish by ${new Date(`${i.target_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
                      // Who it will use: at Start work each type gets its own job.
                      i.onsite_work
                        ? `Needs ${(i.teams || [])
                            .map((t) => ({ electrician: "Electrician", plumber: "Plumber", hvac: "HVAC", cleaning: "Cleaning" })[t] || t)
                            .join(", ")} on site`
                        : "No on-site work",
                      by(i.created_by_id),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="tcard__actions">
                    <Decision
                      busy={busyId === i.initiative_id}
                      onApprove={() => decideInitiative(i, "approved")}
                      onReject={(note) => decideInitiative(i, "rejected", note)}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === "reports" && (
        <>
          {[
            ["Waiting for your approval", waitingReports, "No reports are waiting for approval."],
            ["Approved, ready to publish", readyReports, "Nothing is waiting to be published."],
          ].map(([heading, list, empty]) => (
            <section key={heading} className="tsection">
              <h2>{heading}</h2>
              {list.length === 0 ? (
                <p className="tempty">{empty}</p>
              ) : (
                <div className="tlist">
                  {list.map((r) => (
                    <article key={r.report_id} className="tcard">
                      <div className="tcard__head">
                        <h3 className="tcard__title">{r.title}</h3>
                        <span className={`tcard__chip ${r.status === "approved" ? "tcard__chip--good" : "tcard__chip--wait"}`}>
                          {r.status === "approved" ? "Approved" : "Waiting for approval"}
                        </span>
                      </div>
                      <p className="tcard__basis" style={{ fontSize: "13px" }}>
                        {[
                          r.from ? periodName(r.from, r.to) : r.period,
                          names[r.generated_by_id] && `Prepared by ${names[r.generated_by_id]}`,
                          Array.isArray(r.data_gaps) && `${r.data_gaps.length} data gap${r.data_gaps.length === 1 ? "" : "s"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {openReport === r.report_id && (
                        <div className="arc-card__doc" style={{ marginTop: "12px", padding: "16px", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                          <ReportDocument report={r} />
                        </div>
                      )}
                      <div className="tcard__actions">
                        <button
                          type="button"
                          className="tbtn"
                          aria-expanded={openReport === r.report_id}
                          onClick={() => setOpenReport(openReport === r.report_id ? null : r.report_id)}
                        >
                          {openReport === r.report_id ? "Hide report" : "View report"}
                        </button>
                        {r.status === "submitted" ? (
                          <Decision
                            busy={busyId === r.report_id}
                            onApprove={() => decideReport(r, "approved")}
                            onReject={(note) => decideReport(r, "draft", note)}
                            rejectLabel="Send back"
                          />
                        ) : (
                          <button type="button" className="tbtn tbtn--primary" disabled={busyId === r.report_id} onClick={() => decideReport(r, "published")}>
                            Publish
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </AdminPage>
  );
}
