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

/** One approval card. The parent decides what the buttons do. */
function ApprovalCard({ title, typeLabel, estimate, onApprove, onReject, busy }) {
  const c = estimate || { materials: 0, labor: 0, total: 0 };
  return (
    <div className="fa-approval">
      <div className="fa-approval-head">
        <div>
          <h4>{title}</h4>
          <div className="fa-approval-kind">Cost Estimate Approval</div>
        </div>
        <span className="fa-approval-type">{typeLabel}</span>
      </div>
      <div className="fa-estimate">
        <div className="fa-estimate-row">
          <span>Materials</span>
          <span>{formatCurrency(c.materials)}</span>
        </div>
        <div className="fa-estimate-row">
          <span>Labor</span>
          <span>{formatCurrency(c.labor)}</span>
        </div>
        <div className="fa-estimate-total dashed">
          <span>Total Estimated</span>
          <span>{formatCurrency(c.total)}</span>
        </div>
      </div>
      <div className="fa-btn-row">
        <button className="fa-btn-dark" onClick={onApprove} disabled={busy}>
          Approve Estimate
        </button>
        <button className="fa-btn-light" onClick={onReject} disabled={busy}>
          Reject
        </button>
      </div>
    </div>
  );
}

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

  return (
    <div className="box">
      <div className="section-title">Pending Maintenance Authorizations</div>

      {nothingPending && (
        <div className="fa-empty">No pending maintenance or payment authorizations.</div>
      )}

      {pendingEstimates.map((sr) => (
        <ApprovalCard
          key={sr.id}
          title={`${sr.location} - ${sr.category}`}
          typeLabel={sr.costProposal?.type || "Service"}
          estimate={sr.costProposal}
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
      ))}

      {workOrders.map((wo) => {
        const woId = wo.work_order_id || wo.id || "";
        return (
          <ApprovalCard
            key={woId}
            title={`${formatWOId(woId)} - ${wo.title}`}
            typeLabel={wo.type || "Maintenance"}
            estimate={wo.estimate || wo.details?.estimate}
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
        );
      })}

      {validatedJobs.map((sr) => (
        <div className="fa-approval" key={sr.id}>
          <div className="fa-approval-head">
            <div>
              <h4>{`${sr.location} - ${sr.category}`}</h4>
              <div className="fa-approval-kind paid">Payment Authorization (Job Complete &amp; Verified)</div>
            </div>
          </div>
          <div className="fa-estimate">
            <div className="fa-estimate-total">
              <span>Final Invoice Total</span>
              <span>{sr.costProposal ? formatCurrency(sr.costProposal.total) : "—"}</span>
            </div>
          </div>
          <div className="fa-btn-row">
            <button
              className="fa-btn-green"
              disabled={busyId === sr.id}
              onClick={() =>
                update("/service-requests", sr.id, { status: "Closed" },
                  "Payment authorized. Job closed successfully.", "success")
              }
            >
              Authorize Payment / Close Job
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
