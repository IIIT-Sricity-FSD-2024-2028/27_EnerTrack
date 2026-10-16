/**
 * MaintenanceApprovals — "Pending Maintenance Authorizations" box.
 *
 * Lists the work orders in "approval" status: a technician sent a cost
 * estimate and work cannot start until the Financial Analyst signs it off.
 *
 *   Approve → inprogress: the assigned technician can start the work
 *   Reject  → new, same technician: they see "Rejected" and can send a
 *             revised estimate (the estimate stays in details so they can
 *             see what was turned down)
 *
 * The old page also listed service requests in "Awaiting Estimate Approval"
 * and "Validated (Awaiting Payment)". Nothing sets either status any more —
 * the estimate travels on the work order — so those rows were dropped.
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

/** Loads the work orders waiting for approval. */
async function fetchApprovalItems() {
  const wos = await api.get("/work-orders");
  return Array.isArray(wos) ? wos.filter((w) => w.status === "approval") : [];
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

export default function MaintenanceApprovals() {
  const showToast = useToast();
  const [workOrders, setWorkOrders] = useState([]);
  const [busyId, setBusyId] = useState(null);
  // Bumping this number re-runs the effect below, i.e. reloads the list.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetchApprovalItems()
      .then(setWorkOrders)
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

  const count = workOrders.length;
  const est = (e) => e || { materials: 0, labor: 0, total: 0 };

  return (
    <section className="fo-panel" aria-labelledby="approvalsTitle">
      <div className="fo-panel-head">
        <div>
          <h2 id="approvalsTitle">Maintenance approvals</h2>
          <p>Cost estimates from technicians waiting for sign-off.</p>
        </div>
        <span className={count ? "fo-count has-items" : "fo-count"}>{count} pending</span>
      </div>

      {count === 0 && <div className="fo-empty">Nothing to approve. New estimates from technicians will appear here.</div>}

      {workOrders.map((wo) => {
        const woId = wo.work_order_id || wo.id || "";
        const e = est(wo.details?.estimate);
        // The type lives in details, like every other extra field.
        const type = wo.details?.type;
        return (
          <ApprovalRow
            key={woId}
            title={`${formatWOId(woId)} - ${wo.title}`}
            typeLabel={type ? type.charAt(0).toUpperCase() + type.slice(1) : "Maintenance"}
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
                // Keeps the technician: they revise the estimate. Clearing
                // assigned_to_id took the order off their board and hid the
                // "estimate rejected" step on both technician pages.
                onReject={() =>
                  update("/work-orders", woId, { status: "new" },
                    "Estimate rejected. Sent back to the technician to revise.", "warning")
                }
              />
            }
          />
        );
      })}
    </section>
  );
}
