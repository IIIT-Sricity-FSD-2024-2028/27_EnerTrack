/**
 * WastageAuditQueue — "Wastage cases" on the Sustainability Officer overview.
 *
 * A case is a pattern of waste the officer opened from a signal (see
 * WasteSignals) or from Monitoring. Single reports never come here.
 *
 *   Open            → Plan the remedy, then:
 *                       no cost        → Set target
 *                       needs spending → Send to Finance
 *                     or Dismiss
 *   Returned to SO  → Set target / Send back to Finance
 *   Target Set      → Check target now / Edit target (the deadline moves it on)
 *   Verify Target   → Check the result (met or missed)
 *   Target Met      → Close the case (tells the people who reported it)
 *   Target Missed   → Set a new target / Close the case
 * Cases with Finance ("Forwarded to Finance", "Cost Impact Added") are listed
 * without buttons. Dismissed and Closed cases go to archives.
 *
 * This component owns the list (state) and the save logic; each case is
 * drawn by <WastageAuditCard>, which reports clicks back through props.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import { useAuth } from "../../../auth/useAuth";
import { addWastageComment, normalizeWastageReport, updateWastageReport } from "../../finance/financeApi";
import { reportRef } from "../../finance/financeUtils";
import { DismissModal, SendBackModal, TargetModal, VerifyTargetModal } from "./AuditModals";
import { RemedyModal } from "./CaseModals";
import WastageAuditCard from "./WastageAuditCard";
import { normalizeStatus } from "./auditShared";

// Cases waiting on Finance; everything else in the queue waits on the officer.
const WITH_FINANCE = ["Forwarded to Finance", "Cost Impact Added"];
const FINISHED = ["Dismissed", "Closed"];

/** The server is the only record; if it cannot be reached, the queue says so. */
async function loadRawReports() {
  const rows = await api.get("/wastage-reports");
  return Array.isArray(rows) ? rows : [];
}

export default function WastageAuditQueue({ reloadKey = 0, onChanged, showToast }) {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // case being saved
  const [modal, setModal] = useState(null); // { kind, report }
  const [loadError, setLoadError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState("action"); // 'action' | 'finance'
  const [foodLogs, setFoodLogs] = useState([]); // kg a day per place, for food cases

  const officerName = user?.name || "Sustainability Officer";

  useEffect(() => {
    let active = true;

    Promise.all([
      loadRawReports(),
      // Only used to show who opened each case; optional.
      api.get("/users").catch(() => []),
      // Food cases show General Maintenance's weigh-ins; optional.
      api.get("/food-waste-logs/summary").catch(() => []),
    ])
      .then(([rows, users, food]) => {
        if (!active) return;
        setFoodLogs(Array.isArray(food) ? food : []);
        const directory = {};
        (Array.isArray(users) ? users : []).forEach((u) => {
          if (u.user_id) directory[u.user_id] = u;
        });
        setLoadError(null);
        setReports(
          rows.map((raw) => {
            const r = normalizeWastageReport(raw, user);
            const opener = directory[raw.reporter_id] || null;
            return {
              ...r,
              status: normalizeStatus(r.status),
              shortId: reportRef(r.id),
              reporterName: opener?.name || (r.reporterName && r.reporterName !== "Unknown" ? r.reporterName : "Sustainability Officer"),
            };
          }),
        );
      })
      .catch((error) => {
        if (!active) return;
        console.error("[SO Wastage] Failed to load cases", error);
        setLoadError(error.message || "The server could not be reached.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, reloadKey, retryKey]);

  /**
   * Saves the changes and swaps the updated case into state.
   * Returns null (after an error toast) if the server refuses.
   */
  async function saveReport(report, changes) {
    setBusyId(report.id);
    try {
      const updated = await updateWastageReport(report, changes);
      setReports((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      // A case that closes or is dismissed changes the signals panel too.
      if (changes.status && FINISHED.includes(changes.status)) onChanged?.();
      return updated;
    } catch (error) {
      showToast?.("Could not save the case: " + error.message, "error");
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function handleAction(report, action) {
    const now = new Date().toISOString();

    if (action === "forward") {
      if (!(await saveReport(report, { status: "Forwarded to Finance", forwardedAt: now }))) return;
      showToast?.("Sent to Finance for the remedy's cost and payback.", "success");
    } else if (action === "close") {
      const saved = await saveReport(report, {
        status: "Closed",
        closedAt: now,
        closedBy: officerName,
        soArchived: true,
        soArchivedAt: now,
      });
      if (!saved) return;
      showToast?.(
        report.sourceRequestIds?.length ? "Case closed. The people who reported the waste have been told." : "Case closed.",
        "success",
      );
    } else if (action === "raiseWorkOrder") {
      // Sends the physical part of the remedy to the right team as a job.
      try {
        await api.post(`/wastage-reports/${report.id}/work-order`, {});
        showToast?.("Work order created and sent to a technician.", "success");
        setRetryKey((k) => k + 1);
      } catch (error) {
        showToast?.(error.message, "error");
      }
    } else if (action === "checkNow") {
      // Check before the deadline: move to Verify Target, then open the check.
      const saved = await saveReport(report, { status: "Verify Target", checkedEarlyAt: now });
      if (!saved) return;
      setModal({ kind: "verify", report: saved });
    } else if (["dismiss", "sendBack", "target", "verify", "remedy"].includes(action)) {
      setModal({ kind: action, report });
    }
  }

  async function handleRemedy(remedy) {
    const report = modal.report;
    const saved = await saveReport(report, { remedy: { ...remedy, plannedBy: officerName } });
    if (!saved) return;
    setModal(null);
    showToast?.(
      remedy.type === "spend" ? "Remedy saved. Send it to Finance for the cost and payback." : "Remedy saved. Set a target next.",
      "success",
    );
  }

  async function handleDismiss({ reason, comment }) {
    const report = modal.report;
    const now = new Date().toISOString();
    const comments = [
      ...(report.comments || []),
      { author: officerName, role: "Sustainability Officer", text: `Dismissed this case. Reason: ${reason}. ${comment}`, timestamp: now },
    ];
    const saved = await saveReport(report, {
      status: "Dismissed",
      dismissedAt: now,
      dismissReason: reason,
      dismissComment: comment,
      soArchived: true,
      soArchivedAt: now,
      comments,
    });
    if (!saved) return;
    setModal(null);
    showToast?.("Case dismissed.", "info");
  }

  async function handleSendBack({ reason, notes }) {
    const report = modal.report;
    const now = new Date().toISOString();
    const saved = await saveReport(report, {
      status: "Forwarded to Finance",
      costImpact: null, // Finance re-assesses from scratch
      returnedAt: null,
      sentBackAt: now,
      revisionRequest: { reason, notes, requestedAt: now, requestedBy: officerName },
    });
    if (!saved) return;
    setModal(null);
    showToast?.("Case sent back to Finance for revision.", "warning");
  }

  async function handleSetTarget({ value, unit, deadline }) {
    const report = modal.report;
    const now = new Date().toISOString();
    const saved = await saveReport(report, {
      status: "Target Set",
      metricTarget: { value, unit, deadline, setAt: now, setBy: officerName },
      targetSetAt: now,
    });
    if (!saved) return;
    setModal(null);
    showToast?.(`${report.type} target set to ${value} ${unit}.`, "success");
  }

  async function handleVerify({ status, outcome }) {
    const report = modal.report;
    const saved = await saveReport(report, {
      status,
      targetOutcome: { ...outcome, checkedAt: new Date().toISOString(), checkedBy: officerName },
    });
    if (!saved) return;
    setModal(null);
    showToast?.(
      status === "Target Met"
        ? "Recorded as met. Close the case to tell the people who reported the waste."
        : "Recorded as missed. Set a new target, or close the case.",
      "success",
    );
  }

  async function handleAddComment(report, text) {
    setBusyId(report.id);
    try {
      const updated = await addWastageComment(report, { author: officerName, role: "Sustainability Officer", text });
      setReports((list) => list.map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      showToast?.("Could not save the comment: " + error.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  const visible = reports
    .filter((r) => !r.details?.soArchived && !FINISHED.includes(r.status))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const withFinance = visible.filter((r) => WITH_FINANCE.includes(r.status));
  const needsAction = visible.filter((r) => !WITH_FINANCE.includes(r.status));
  const shown = tab === "finance" ? withFinance : needsAction;

  return (
    <section className="so-panel" id="wastageAuditSection" aria-labelledby="wastageAuditTitle">
      <div className="so-panel-head">
        <div>
          <h2 id="wastageAuditTitle">Wastage cases</h2>
          <p>Plan a remedy for each case. Free fixes go straight to a target; anything that costs money goes to Finance first.</p>
        </div>
        <div className="so-tabs" role="tablist" aria-label="Filter wastage cases">
          <button type="button" role="tab" aria-selected={tab === "action"} onClick={() => setTab("action")}>
            Needs your action ({needsAction.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === "finance"} onClick={() => setTab("finance")}>
            With Finance ({withFinance.length})
          </button>
        </div>
      </div>

      <div id="wastageAuditContainer" role="tabpanel">
        {loadError && reports.length === 0 ? (
          <div className="so-empty" role="alert">
            Wastage cases could not be loaded: {loadError}{" "}
            <button
              type="button"
              className="so-btn"
              onClick={() => {
                setLoading(true);
                setRetryKey((k) => k + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : loading && reports.length === 0 ? (
          <div className="so-empty">Loading wastage cases…</div>
        ) : shown.length === 0 ? (
          <div className="so-empty">
            {tab === "finance"
              ? "Nothing is with Finance. Only remedies that need spending go there."
              : "No open cases. Open one from a waste signal above."}
          </div>
        ) : (
          shown.map((report) => (
            <WastageAuditCard
              key={report.id}
              report={report}
              busy={busyId === report.id}
              foodLogs={foodLogs}
              onAction={(action) => handleAction(report, action)}
              onAddComment={(text) => handleAddComment(report, text)}
            />
          ))
        )}
      </div>

      {modal?.kind === "remedy" && (
        <RemedyModal report={modal.report} busy={busyId === modal.report.id} onSubmit={handleRemedy} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "dismiss" && (
        <DismissModal report={modal.report} busy={busyId === modal.report.id} onSubmit={handleDismiss} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "sendBack" && (
        <SendBackModal report={modal.report} busy={busyId === modal.report.id} onSubmit={handleSendBack} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "verify" && (
        <VerifyTargetModal report={modal.report} busy={busyId === modal.report.id} onSubmit={handleVerify} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "target" && (
        <TargetModal report={modal.report} busy={busyId === modal.report.id} onSubmit={handleSetTarget} onClose={() => setModal(null)} />
      )}
    </section>
  );
}
