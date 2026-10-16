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
import { notifyOnStateChange } from "../../../legacy/notifications";
import universalDB from "../../../legacy/universalDB";
import { addWastageComment, isNetworkError, normalizeWastageReport, updateWastageReport } from "../../finance/financeApi";
import { reportRef } from "../../finance/financeUtils";
import { DismissModal, SendBackModal, TargetModal } from "./AuditModals";
import ReportPreview from "./ReportPreview";
import WastageAuditCard from "./WastageAuditCard";
import { normalizeStatus } from "./auditShared";

// Reports waiting on Finance; everything else in the queue waits on the officer.
const WITH_FINANCE = ["Forwarded to Finance", "Cost Impact Added"];

/** Server rows when the backend is up; the local copies only when offline. */
async function loadRawReports() {
  try {
    const rows = await api.get("/wastage-reports");
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    console.warn("[SO Wastage] Backend unavailable, using local data.");
    return universalDB.data.workflow.wastageReports || [];
  }
}

export default function WastageAuditQueue({ reloadKey = 0, showToast }) {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // report being saved
  const [modal, setModal] = useState(null); // { kind: 'dismiss'|'sendBack'|'target', report }
  const [localReload, setLocalReload] = useState(0);
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
        showToast?.(error.message || "Could not load the wastage audit queue.", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, reloadKey, localReload, showToast]);

  // Reload whenever another tab (e.g. the Finance Analyst) changes the
  // shared local data.
  useEffect(() => {
    function handleStorage(event) {
      if (event.key === "enertrack_universal_v1") setLocalReload((k) => k + 1);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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

  function notify(report, action, extra = {}) {
    notifyOnStateChange({ id: report.shortId, type: report.type, reporterEmail: report.reporterEmail, ...extra }, action, officerName);
  }

  async function handleAction(report, action) {
    const now = new Date().toISOString();

    if (action === "validate") {
      if (!(await saveReport(report, { status: "Validated", validatedAt: now }))) return;
      showToast?.("Report validated successfully.", "success");
      notify(report, "validated");
    } else if (action === "forward") {
      if (!(await saveReport(report, { status: "Forwarded to Finance", forwardedAt: now }))) return;
      showToast?.("Report forwarded to Finance Analyst.", "success");
      notify(report, "forwarded");
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
      notify(report, "delivered");
    } else if (action === "dismiss" || action === "sendBack" || action === "target" || action === "preview") {
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
    notify(report, "dismissed", { dismissReason: reason });
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
    notify(report, "forwarded");
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
    notify(report, "target_set");
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
        {loading && reports.length === 0 ? (
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
      {modal?.kind === "target" && (
        <TargetModal report={modal.report} busy={busyId === modal.report.id} onSubmit={handleSetTarget} onClose={() => setModal(null)} />
      )}
    </section>
  );
}
