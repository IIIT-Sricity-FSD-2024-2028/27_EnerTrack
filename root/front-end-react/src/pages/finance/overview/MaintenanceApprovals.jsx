/**
 * MaintenanceApprovals — "Pending Maintenance Authorizations" box.
 *
 * Three kinds of item wait for the Financial Analyst:
 *   1. Service requests whose cost estimate needs approval
 *   2. Internal work orders in "approval" status
 *   3. Finished, verified jobs waiting for payment authorization
 *
 * The component loads its own data with useEffect and reloads it after
 * every approve / reject, like renderFinanceWorkflow() did.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import { useToast } from "../components/toastContext";
import { formatCurrency } from "../financeUtils";

/** "wo-ab12cd" → "WO-AB12CD" (same rule as the original formatWOId) */
function formatWOId(id) {
  if (!id) return "WO-XXXX";
  if (id.startsWith("WO-")) return id;
  const parts = id.split("-");
  if (parts.length > 1) return "WO-" + parts[1].toUpperCase();
  return "WO-" + id.substring(0, 4).toUpperCase();
}

/** Loads service requests and the work orders waiting for approval. */
async function fetchApprovalItems() {
  const [srs, wos] = await Promise.all([api.get("/service-requests"), api.get("/work-orders")]);
  return {
    // The backend's key is service_request_id (the original page read sr.id,
    // which was undefined, so its buttons PATCHed /service-requests/undefined).
    serviceRequests: (Array.isArray(srs) ? srs : []).map((sr) => ({
      ...sr,
      id: sr.service_request_id || sr.id,
      location: sr.location || sr.issue_type,
    })),
    workOrders: Array.isArray(wos) ? wos.filter((w) => w.status === "approval") : [],
  };
}

/** One approval row. The parent decides what the buttons do. */
function ApprovalRow({ title, kind, typeLabel, figures, total, totalLabel, actions }) {
  return (
    <article className="fo-row">
      <div className="fo-row-top">
        <div className="fo-row-title">
          <strong title={title}>{title}</strong>
          {typeLabel && <span>{typeLabel}</span>}
        </div>
        <span className={`fo-chip ${kind.tone}`}>{kind.label}</span>
      </div>
      <div className="fo-figures">
        {figures.map(([label, value]) => (
          <div key={label}>
            {label}
            <strong>{formatCurrency(value)}</strong>
          </div>
        ))}
        <div className="total">
          {totalLabel}
          <strong>{total == null ? "—" : formatCurrency(total)}</strong>
        </div>
      </div>
      <div className="fo-actions">{actions}</div>
    </article>
  );
}

/** Approve / reject buttons for a cost estimate. */
function EstimateActions({ busy, onApprove, onReject }) {
  return (
    <>
      <button type="button" className="fo-btn primary" onClick={onApprove} disabled={busy}>
        Approve estimate
      </button>
      <button type="button" className="fo-btn" onClick={onReject} disabled={busy}>
        Reject
      </button>
    </>
  );
}

const ESTIMATE = { label: "Estimate to approve", tone: "action" };
const PAYMENT = { label: "Payment to authorize", tone: "ready" };

export default function MaintenanceApprovals() {
  const showToast = useToast();
  const [items, setItems] = useState({ serviceRequests: [], workOrders: [] });
  const [busyId, setBusyId] = useState(null);
  // Bumping this number re-runs the effect below, i.e. reloads the list.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetchApprovalItems()
      .then(setItems)
      .catch((error) => console.error("API error fetching workflow items", error));
  }, [reloadKey]);

  /** PATCHes one record, shows a toast and reloads the list. */
  async function update(path, id, body, successMessage, successType) {
    setBusyId(id);
    try {
      await api.patch(`${path}/${id}`, body);
      showToast(successMessage, successType);
      setReloadKey((k) => k + 1);
    } catch (error) {
      showToast(error.message || "Failed to update", "warning");
    }
    setBusyId(null);
  }

  const { serviceRequests, workOrders } = items;
  const pendingEstimates = serviceRequests.filter((sr) => sr.status === "Awaiting Estimate Approval");
  const validatedJobs = serviceRequests.filter((sr) => sr.status === "Validated (Awaiting Payment)");
  const nothingPending =
    pendingEstimates.length === 0 && validatedJobs.length === 0 && workOrders.length === 0;

  const count = pendingEstimates.length + workOrders.length + validatedJobs.length;
  const est = (e) => e || { materials: 0, labor: 0, total: 0 };

  return (
    <section className="fo-panel" aria-labelledby="approvalsTitle">
      <div className="fo-panel-head">
        <div>
          <h2 id="approvalsTitle">Maintenance approvals</h2>
          <p>Cost estimates waiting for sign-off, and finished jobs waiting for payment.</p>
        </div>
        <span className={count ? "fo-count has-items" : "fo-count"}>{count} pending</span>
      </div>

      {nothingPending && <div className="fo-empty">Nothing to approve. New estimates from technicians will appear here.</div>}

      {pendingEstimates.map((sr) => {
        const e = est(sr.costProposal);
        return (
          <ApprovalRow
            key={sr.id}
            title={`${sr.location} - ${sr.category}`}
            typeLabel={sr.costProposal?.type || "Service request"}
            kind={ESTIMATE}
            figures={[["Materials", e.materials], ["Labour", e.labor]]}
            totalLabel="Total estimate"
            total={e.total}
            actions={
              <EstimateActions
                busy={busyId === sr.id}
                onApprove={() =>
                  update("/service-requests", sr.id, { status: "Approved (Executing)" },
                    "Estimate approved. Technician can proceed.", "success")
                }
                onReject={() =>
                  update("/service-requests", sr.id, { status: "Accepted" },
                    "Estimate rejected. Sent back to technician.", "warning")
                }
              />
            }
          />
        );
      })}

      {workOrders.map((wo) => {
        const woId = wo.work_order_id || wo.id || "";
        const e = est(wo.estimate || wo.details?.estimate);
        return (
          <ApprovalRow
            key={woId}
            title={`${formatWOId(woId)} - ${wo.title}`}
            typeLabel={wo.type ? wo.type.charAt(0).toUpperCase() + wo.type.slice(1) : "Maintenance"}
            kind={ESTIMATE}
            figures={[["Materials", e.materials], ["Labour", e.labor]]}
            totalLabel="Total estimate"
            total={e.total}
            actions={
              <EstimateActions
                busy={busyId === woId}
                onApprove={() =>
                  update("/work-orders", woId, { status: "inprogress" },
                    "Internal Work Order estimate approved.", "success")
                }
                onReject={() =>
                  update("/work-orders", woId, { status: "new", assigned_to_id: null },
                    "Internal Work Order estimate rejected. Tech notified.", "warning")
                }
              />
            }
          />
        );
      })}

      {validatedJobs.map((sr) => (
        <ApprovalRow
          key={sr.id}
          title={`${sr.location} - ${sr.category}`}
          typeLabel="Job complete and verified"
          kind={PAYMENT}
          figures={[]}
          totalLabel="Final invoice"
          total={sr.costProposal ? sr.costProposal.total : null}
          actions={
            <button
              type="button"
              className="fo-btn positive"
              disabled={busyId === sr.id}
              onClick={() =>
                update("/service-requests", sr.id, { status: "Closed" },
                  "Payment authorized. Job closed successfully.", "success")
              }
            >
              Authorize payment and close job
            </button>
          }
        />
      ))}
    </section>
  );
}
