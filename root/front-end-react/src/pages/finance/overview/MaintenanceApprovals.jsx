/**
 * MaintenanceApprovals — "Pending Maintenance Authorizations" box.
 *
 * Lists the work orders in "approval" status: a technician sent a cost
 * estimate and work cannot start until the Financial Analyst signs it off.
 *
 *   Approve → inprogress: the assigned technician can start the work
 *   Send back → new, same technician, with the reason Finance wrote: they
 *             see it and can send a revised estimate (the estimate stays in
 *             details so they can see what was turned down)
 *
 * The old page also listed service requests in "Awaiting Estimate Approval"
 * and "Validated (Awaiting Payment)". Nothing sets either status any more —
 * the estimate travels on the work order — so those rows were dropped.
 *
 * The work orders come from the Redux store (workOrdersSlice). They are
 * reloaded when the box appears, since technicians send estimates from their
 * own browsers; an approve / send back updates the order in place, so it
 * leaves the list without another request.
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "../../../ui/useToast";
import { formatCurrency } from "../financeUtils";
import {
  fetchWorkOrders,
  selectWorkOrdersAwaitingApproval,
  updateWorkOrder,
} from "../../../store/slices/workOrdersSlice";

/** "wo-ab12cd" → "WO-AB12CD" (same rule as the original formatWOId) */
function formatWOId(id) {
  if (!id) return "WO-XXXX";
  if (id.startsWith("WO-")) return id;
  const parts = id.split("-");
  if (parts.length > 1) return "WO-" + parts[1].toUpperCase();
  return "WO-" + id.substring(0, 4).toUpperCase();
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

/** Approve, or send back with a reason the technician will read. */
function EstimateActions({ busy, onApprove, onReject }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const ready = reason.trim().length >= 3;

  if (asking) {
    return (
      <div className="fo-reason-box">
        <label>
          Why is it being sent back?
          <textarea
            className="fo-reason"
            rows={3}
            maxLength={300}
            placeholder="For example: get a second quote, or the price is above the usual rate."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </label>
        <div className="fo-reason-actions">
          <button type="button" className="fo-btn primary" disabled={busy || !ready} onClick={() => onReject(reason.trim())}>
            Send back
          </button>
          <button type="button" className="fo-btn" disabled={busy} onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="fo-btn primary" onClick={onApprove} disabled={busy}>
        Approve estimate
      </button>
      <button type="button" className="fo-btn" onClick={() => setAsking(true)} disabled={busy}>
        Send back
      </button>
    </>
  );
}

const ESTIMATE = { label: "Estimate to approve", tone: "action" };

export default function MaintenanceApprovals() {
  const showToast = useToast();
  const dispatch = useDispatch();
  const workOrders = useSelector(selectWorkOrdersAwaitingApproval);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    dispatch(fetchWorkOrders({ force: true }))
      .unwrap()
      .catch((error) => showToast(error.message || "Could not load the estimates.", "error"));
  }, [dispatch, showToast]);

  /** Saves one decision on a work order and shows a toast. */
  async function decide(id, changes, successMessage, successType) {
    setBusyId(id);
    try {
      await dispatch(updateWorkOrder({ id, changes })).unwrap();
      showToast(successMessage, successType);
    } catch (error) {
      showToast(error.message || "Failed to update", "warning");
    }
    setBusyId(null);
  }

  const count = workOrders.length;
  const est = (e) => e || { materials: 0, total: 0 };

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
            figures={[["Materials", e.materials]]}
            totalLabel="Total estimate"
            total={e.total}
            actions={
              <EstimateActions
                busy={busyId === woId}
                onApprove={() =>
                  decide(woId, { status: "inprogress" },
                    "Internal Work Order estimate approved.", "success")
                }
                // Keeps the technician: they revise the estimate. Clearing
                // assigned_to_id took the order off their board and hid the
                // "estimate rejected" step on both technician pages.
                onReject={(reason) =>
                  // Keep the rest of details: on an order the system did not
                  // dispatch, the backend replaces details as a whole, and
                  // sending only the reason wiped the estimate.
                  decide(woId, { status: "new", details: { ...wo.details, decision_reason: reason } },
                    "Sent back to the technician with your reason.", "warning")
                }
              />
            }
          />
        );
      })}
    </section>
  );
}
