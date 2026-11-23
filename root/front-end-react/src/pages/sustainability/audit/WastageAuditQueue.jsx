/**
 * WastageAuditQueue — "Wastage Audit Queue" on the Sustainability Officer
 * overview (ported from renderWastageAuditQueue() and the window._audit*
 * handlers in js/sustainability_officer/overviewPage.js).
 *
 * Workflow 2, the officer's steps:
 *   Reported        → Validate / Dismiss (with reason)
 *   Validated       → Forward to Finance
 *   Returned to SO  → Set New Target / Send Back to Finance
 *   Target Set      → Finalize Report / Edit Target
 *   Finalized       → Preview report / Send report to occupant (→ Delivered)
 * Reports sitting with Finance ("Forwarded to Finance", "Cost Impact Added")
 * are listed without buttons. Dismissed and Delivered reports go to archives.
 *
 * This component owns the list (state) and the save logic; each report is
 * drawn by <WastageAuditCard>, which reports clicks back through props.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import { useAuth } from "../../../auth/useAuth";
import { addWastageComment, normalizeWastageReport, updateWastageReport } from "../../finance/financeApi";
import { reportRef } from "../../finance/financeUtils";
import { DismissModal, SendBackModal, TargetModal, VerifyTargetModal } from "./AuditModals";
import ReportPreview from "./ReportPreview";
import WastageAuditCard from "./WastageAuditCard";
import { normalizeStatus } from "./auditShared";

// Reports waiting on Finance; everything else in the queue waits on the officer.
const WITH_FINANCE = ["Forwarded to Finance", "Cost Impact Added"];

/** The server is the only record; if it cannot be reached, the queue says so. */
async function loadRawReports() {
  const rows = await api.get("/wastage-reports");
  return Array.isArray(rows) ? rows : [];
}

export default function WastageAuditQueue({ reloadKey = 0, showToast }) {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // report being saved
  const [modal, setModal] = useState(null); // { kind: 'dismiss'|'sendBack'|'target', report }
  const [loadError, setLoadError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState("action"); // 'action' | 'finance'

  const officerName = user?.name || "Sustainability Officer";

  useEffect(() => {
    let active = true;

    Promise.all([
      loadRawReports(),
      // Only used to show reporter names and notify them; optional.
      api.get("/users").catch(() => []),
    ])
      .then(([rows, users]) => {
        if (!active) return;
        const directory = {};
        (Array.isArray(users) ? users : []).forEach((u) => {
          if (u.user_id) directory[u.user_id] = u;
        });
        setLoadError(null);
        setReports(
          rows.map((raw) => {
            const r = normalizeWastageReport(raw, user);
            const reporter = directory[raw.reporter_id] || null;
            return {
              ...r,
              status: normalizeStatus(r.status),
              shortId: reportRef(r.id),
              priority: r.details?.priority || "Medium",
              reporterName: reporter?.name || (r.reporterName && r.reporterName !== "Unknown" ? r.reporterName : "Occupant"),
              reporterEmail: reporter?.email || raw.reporterEmail,
            };
          }),
        );
      })
      .catch((error) => {
        if (!active) return;
        console.error("[SO Wastage] Failed to load reports", error);
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
   * Saves the changes and swaps the updated report into state.
   * Returns null (after an error toast) if the server refuses.
   */
  async function saveReport(report, changes) {
    setBusyId(report.id);
    try {
      const updated = await updateWastageReport(report, changes);
      setReports((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      return updated;
    } catch (error) {
      showToast?.("Could not save the report: " + error.message, "error");
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function handleAction(report, action) {
    const now = new Date().toISOString();

    if (action === "validate") {
      if (!(await saveReport(report, { status: "Validated", validatedAt: now }))) return;
      showToast?.("Report validated successfully.", "success");
    } else if (action === "forward") {
      if (!(await saveReport(report, { status: "Forwarded to Finance", forwardedAt: now }))) return;
      showToast?.("Report forwarded to Finance Analyst.", "success");
    } else if (action === "finalize") {
      if (!(await saveReport(report, { status: "Finalized", finalizedAt: now, finalizedBy: officerName }))) return;
      showToast?.("Report finalized. Preview it, then send it to the occupant.", "success");
    } else if (action === "deliver") {
      const saved = await saveReport(report, {
        status: "Delivered",
        deliveredAt: now,
        deliveredBy: officerName,
        soArchived: true,
        soArchivedAt: now,
      });
      if (!saved) return;
      showToast?.("Report sent to the occupant.", "success");
    } else if (action === "raiseWorkOrder") {
      // Turns a validated report into a job for a technician (dispatch).
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
    } else if (action === "dismiss" || action === "sendBack" || action === "target" || action === "preview" || action === "verify") {
      setModal({ kind: action, report });
    }
  }

  async function handleDismiss({ reason, comment }) {
    const report = modal.report;
    const now = new Date().toISOString();
    const comments = [
      ...(report.comments || []),
      { author: officerName, role: "Sustainability Officer", text: `Dismissed this report. Reason: ${reason}. ${comment}`, timestamp: now },
    ];
    const saved = await saveReport(report, {
      status: "Dismissed",
      dismissedAt: now,
      dismissReason: reason,
      dismissComment: comment,
      archived: true,
      archivedAt: now,
      comments,
    });
    if (!saved) return;
    setModal(null);
    showToast?.("Report dismissed with reason.", "info");
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
    showToast?.("Report sent back to Finance for revision.", "warning");
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
        ? "Recorded as met. The occupant has been told."
        : "Recorded as missed. The occupant has been told; you can set a new target.",
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

  // Not archived by the officer, not dismissed, not delivered — newest first.
  // details.archived is the occupant's own archive (PATCH /:id/archive, allowed
  // from Target Set onwards); it must not hide a report the officer still has
  // to finalize and send, so only soArchived counts here.
  const visible = reports
    .filter((r) => !r.details?.soArchived && r.status !== "Dismissed" && r.status !== "Delivered")
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const withFinance = visible.filter((r) => WITH_FINANCE.includes(r.status));
  const needsAction = visible.filter((r) => !WITH_FINANCE.includes(r.status));
  const shown = tab === "finance" ? withFinance : needsAction;

  return (
    <section className="so-panel" id="wastageAuditSection" aria-labelledby="wastageAuditTitle">
      <div className="so-panel-head">
        <div>
          <h2 id="wastageAuditTitle">Wastage reports</h2>
          <p>Check each campus report against its sensor, send real issues to Finance, then close them out with a target.</p>
        </div>
        <div className="so-tabs" role="tablist" aria-label="Filter wastage reports">
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
            Wastage reports could not be loaded: {loadError}{" "}
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
          <div className="so-empty">Loading wastage reports…</div>
        ) : shown.length === 0 ? (
          <div className="so-empty">
            {tab === "finance"
              ? "Nothing is with Finance right now. Forward a validated report to get a cost estimate."
              : "No reports need your action. New campus reports will appear here."}
          </div>
        ) : (
          shown.map((report) => (
            <WastageAuditCard
              key={report.id}
              report={report}
              busy={busyId === report.id}
              onAction={(action) => handleAction(report, action)}
              onAddComment={(text) => handleAddComment(report, text)}
            />
          ))
        )}
      </div>

      {modal?.kind === "dismiss" && (
        <DismissModal report={modal.report} busy={busyId === modal.report.id} onSubmit={handleDismiss} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "sendBack" && (
        <SendBackModal report={modal.report} busy={busyId === modal.report.id} onSubmit={handleSendBack} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "preview" && (
        <ReportPreview
          report={modal.report}
          busy={busyId === modal.report.id}
          onSend={async () => {
            await handleAction(modal.report, "deliver");
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
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
