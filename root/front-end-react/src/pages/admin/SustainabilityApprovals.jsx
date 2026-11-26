/**
 * Sustainability approvals — where the Organization Admin decides on what the
 * Sustainability Officer proposes: targets, initiatives and reports. The Org Admin
 * cannot open the Sustainability Officer's pages, so the decisions live here.
 * The proposer is notified of every decision (server side).
 */
import { useEffect, useId, useMemo, useState } from "react";
import { useToast } from "../../ui/useToast";
import { useDispatch, useSelector } from "react-redux";
import { useLiveData } from "../../store/useLiveData";
import {
  decideTarget as decideTargetThunk,
  fetchTargets,
  selectAllTargets,
} from "../../store/slices/targetsSlice";
import {
  fetchInitiatives,
  selectAllInitiatives,
  updateInitiative,
} from "../../store/slices/initiativesSlice";
import {
  decideSustainabilityReport,
  fetchSustainabilityReports,
  selectAllSustainabilityReports,
} from "../../store/slices/sustainabilityReportsSlice";
import { fetchUsers, selectAllUsers } from "../../store/slices/usersSlice";
import { fetchBuildings, selectAllBuildings } from "../../store/slices/buildingsSlice";
import AdminPage from "./AdminPage";
import TargetCard from "../sustainability/components/TargetCard";
import ReportDocument from "../sustainability/components/ReportDocument";
import { periodName } from "../sustainability/periods";
import "../sustainability/components/targets.css";
import { InitiativeSummary } from "../sustainability/initiativeShared";
import { useTeams, rupees, day } from "../sustainability/initiativeUtils";

/**
 * Approve or reject. Approving asks for an optional remark, rejecting for a
 * required reason; either is sent to the proposer with the decision.
 * `approveHint` is a line shown while confirming (what approving will do).
 */
function Decision({ busy, onApprove, onReject, approveLabel = "Approve", rejectLabel = "Reject", approveHint }) {
  const [mode, setMode] = useState(null); // null | "approve" | "reject"
  const [text, setText] = useState("");
  const noteId = useId();
  if (!mode)
    return (
      <>
        <button type="button" className="tbtn tbtn--primary" disabled={busy} onClick={() => setMode("approve")}>
          {approveLabel}
        </button>
        <button type="button" className="tbtn tbtn--danger" disabled={busy} onClick={() => setMode("reject")}>
          {rejectLabel}
        </button>
      </>
    );
  const approving = mode === "approve";
  const close = () => {
    setMode(null);
    setText("");
  };
  return (
    <div className="treason" style={{ width: "100%", marginTop: 0 }}>
      <label htmlFor={noteId}>{approving ? "Remark (optional, sent to the proposer)" : "Reason (required, sent to the proposer)"}</label>
      <textarea id={noteId} rows="2" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      {approving && approveHint && <p style={{ margin: "0 0 8px", fontSize: "12.5px", color: "#4b5563" }}>{approveHint}</p>}
      <div style={{ display: "flex", gap: "8px" }}>
        {approving ? (
          <button type="button" className="tbtn tbtn--primary" disabled={busy} onClick={() => onApprove(text.trim())}>
            Confirm: {approveLabel.toLowerCase()}
          </button>
        ) : (
          <button type="button" className="tbtn tbtn--danger" disabled={busy || !text.trim()} onClick={() => onReject(text.trim())}>
            Confirm: {rejectLabel.toLowerCase()}
          </button>
        )}
        <button type="button" className="tbtn" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Loaded fresh when the page opens (no polling). Module level, so useLiveData
// gets the same array on every render.
const LOADS = [fetchTargets, fetchInitiatives, fetchSustainabilityReports];

export default function SustainabilityApprovals() {
  const dispatch = useDispatch();
  const targets = useSelector(selectAllTargets);
  const initiatives = useSelector(selectAllInitiatives);
  const reports = useSelector(selectAllSustainabilityReports);
  // Only for names and building labels: a failed load just leaves them out.
  const users = useSelector(selectAllUsers);
  const buildings = useSelector(selectAllBuildings);
  const { loading, error } = useLiveData(LOADS, { intervalMs: 0 });
  const [openReport, setOpenReport] = useState(null);
  const showToast = useToast();
  const [tab, setTab] = useState("targets");
  const [busyId, setBusyId] = useState(null);
  const { label: teamLabel } = useTeams();
  const names = useMemo(() => Object.fromEntries(users.map((x) => [x.user_id, x.name])), [users]);

  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchBuildings());
  }, [dispatch]);

  const decideTarget = async (t, status, note) => {
    setBusyId(t.target_id);
    try {
      await dispatch(decideTargetThunk({ id: t.target_id, status, note })).unwrap();
      showToast({
          active: "Target approved. Tracking has started.",
          rejected: "Target rejected.",
          met: "Target closed as met.",
          missed: "Target closed as missed.",
        }[status],
        "success",
      );
    } catch (err) {
      showToast(err.message || "Could not save the decision.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const decideInitiative = async (i, status, note) => {
    setBusyId(i.initiative_id);
    try {
      const { row: updated } = await dispatch(
        updateInitiative({ id: i.initiative_id, changes: { status, ...(note ? { decision_note: note } : {}) } }),
      ).unwrap();
      const sent = (updated?.jobs || []).length;
      showToast(status === "approved"
          ? `Initiative approved. Work has started${sent ? `: ${sent} job${sent === 1 ? "" : "s"} sent` : ""}.`
          : "Initiative rejected. The proposer has been told why.",
        "success",
      );
    } catch (err) {
      showToast(err.message || "Could not save the decision.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const decideReport = async (r, status, note) => {
    setBusyId(r.report_id);
    try {
      await dispatch(decideSustainabilityReport({ id: r.report_id, status, note })).unwrap();
      showToast({ approved: "Report approved. Publish it when ready.", draft: "Report sent back to the Sustainability Officer.", published: "Report published." }[status],
        "success",
      );
    } catch (err) {
      showToast(err.message || "Could not save the decision.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const waitingReports = reports.filter((r) => r.status === "submitted");
  const readyReports = reports.filter((r) => r.status === "approved");

  const waitingTargets = targets.filter((t) => t.status === "proposed");
  const activeTargets = targets.filter((t) => t.status === "active");
  const waitingInitiatives = initiatives.filter((i) => String(i.status).toLowerCase() === "proposed" && !i.archived_at);
  // Everything already decided, newest decision first.
  const decidedInitiatives = initiatives
    .filter((i) => String(i.status).toLowerCase() !== "proposed")
    .sort((a, b) => String(b.decided_at || b.start_date || "").localeCompare(String(a.decided_at || a.start_date || "")));
  const statusChip = (s) =>
    ({
      rejected: ["Rejected", "tcard__chip--bad"],
      completed: ["Completed", "tcard__chip--good"],
    })[s] || ["In progress", "tcard__chip--active"];
  const by = (id) => (names[id] ? `Proposed by ${names[id]}` : null);

  return (
    <AdminPage
      subtitle="Targets and initiatives the Sustainability Officer has asked you to approve."
      requiredRole="Organization Admin"
      loading={loading}
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
                        onApprove={(note) => decideTarget(t, "active", note)}
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
                  </div>
                  {i.description && <p className="tcard__note">{i.description}</p>}
                  <p className="tcard__basis" style={{ fontSize: "13px" }}>
                    {[
                      i.source_finding && `From an energy audit${i.expected_saving_amount ? ` (promised ${rupees(i.expected_saving_amount)} a year)` : ""}`,
                      i.metric &&
                        i.expected_saving != null &&
                        `Expected to save ${Number(i.expected_saving).toLocaleString("en-GB")} ${{ energy_kwh: "kWh", water_kl: "kL", gas_m3: "m³", emissions_kg: "kg CO₂e" }[i.metric]} a year`,
                      i.target_reduction && `Target reduction ${i.target_reduction}`,
                      typeof i.capex === "number" && `Cost ${rupees(i.capex)}`,
                      i.target_date &&
                        `Finish by ${new Date(`${i.target_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
                      // Who it will use: on approval each type gets its own job.
                      i.onsite_work ? `Needs ${(i.teams || []).map(teamLabel).join(", ")} on site` : "No on-site work",
                      by(i.created_by_id),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {i.onsite_work && (i.teams || []).length > 0 && (
                    <ul className="tcard__tasks">
                      {i.teams.map((t) => (
                        <li key={t}>
                          <strong>{teamLabel(t)}:</strong> {i.team_tasks?.[t] || "No task given."}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="tcard__actions">
                    <Decision
                      busy={busyId === i.initiative_id}
                      approveLabel="Approve and start"
                      approveHint={
                        i.onsite_work
                          ? `Approving starts the work now and sends ${(i.teams || []).length} job${(i.teams || []).length === 1 ? "" : "s"} (${(i.teams || []).map(teamLabel).join(", ")}), due ${i.target_date || "on the target date"}.`
                          : "Approving starts the work now."
                      }
                      onApprove={(note) => decideInitiative(i, "approved", note)}
                      onReject={(note) => decideInitiative(i, "rejected", note)}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === "initiatives" && (
        <section className="tsection" aria-labelledby="hi-heading">
          <h2 id="hi-heading">Decided</h2>
          {decidedInitiatives.length === 0 ? (
            <p className="tempty">Nothing decided yet.</p>
          ) : (
            <div className="tlist">
              {decidedInitiatives.map((i) => {
                const [chip, chipClass] = statusChip(String(i.status).toLowerCase());
                return (
                  <details key={i.initiative_id} className="tcard tcard--history">
                    <summary className="tcard__head">
                      <h3 className="tcard__title">
                        {i.title}
                        <span className="tcard__when">
                          {String(i.status).toLowerCase() === "rejected" ? "Rejected" : "Approved"}
                          {i.decided_at ? ` ${day(i.decided_at)}` : ""}
                          {i.decided_by_name ? ` by ${i.decided_by_name}` : ""}
                        </span>
                      </h3>
                      <span className={`tcard__chip ${chipClass}`}>
                        {chip}
                        {i.archived_at ? " · archived" : ""}
                      </span>
                    </summary>
                    <InitiativeSummary init={i} buildings={buildings} targets={targets} />
                  </details>
                );
              })}
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
                            onApprove={(note) => decideReport(r, "approved", note)}
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
