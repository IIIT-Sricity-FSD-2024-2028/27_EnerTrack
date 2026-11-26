/**
 * Expenses — /finance/expenses ("Maintenance Spend").
 *
 * Two tabs: technicians' expense bills grouped by work order (approve, or
 * hold with a reason), and the pre-work quotes (MaintenanceApprovals). The
 * bills, the auto-approve cap and the work orders come from the Redux store;
 * a decision or a new cap reloads the bills, because it changes the totals
 * and cap warnings on other bills too.
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import FinanceLayout from "./components/FinanceLayout";
import Modal from "./components/Modal";
import ToastProvider from "./components/ToastProvider";
import { useToast } from "./components/toastContext";
import { formatCurrency } from "./financeUtils";
import BillAttachmentModal from "../../ui/BillAttachmentModal";
import MaintenanceApprovals from "./overview/MaintenanceApprovals";
import {
  fetchExpenseBills,
  fetchExpenseSettings,
  reviewExpenseBill,
  selectAllExpenseBills,
  selectExpenseSettings,
  updateExpenseSettings,
} from "../../store/slices/expenseBillsSlice";
import { fetchWorkOrders, selectAllWorkOrders } from "../../store/slices/workOrdersSlice";
import { useLiveData } from "../../store/useLiveData";

import overviewCss from "../../styles/finance-analyst/finance_overview.css?inline";
import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";
import pageCss from "./overview/overview.css?inline";
import "./expenses.css";

function formatWOId(id) {
  if (!id) return "WO-XXXX";
  if (id.startsWith("WO-")) return id;
  const parts = id.split("-");
  if (parts.length > 1) return "WO-" + parts[1].toUpperCase();
  return "WO-" + id.substring(0, 4).toUpperCase();
}

function renderStatusBadge(bill) {
  if (bill.status === "approved" && bill.auto_approved) {
    return <span className="badge-status badge-auto-approved">Auto</span>;
  }
  if (bill.status === "submitted") {
    return <span className="badge-status badge-submitted">Pending</span>;
  }
  return <span className={`badge-status badge-${bill.status}`}>{bill.status}</span>;
}

function groupBillsByWorkOrder(billList) {
  const map = new Map();
  for (const b of billList) {
    if (!map.has(b.work_order_id)) {
      map.set(b.work_order_id, {
        workOrderId: b.work_order_id,
        workOrderTitle: b.work_order_title,
        workOrderStatus: b.work_order_status,
        submittedByName: b.submitted_by_name,
        variance: b.variance,
        bills: [],
      });
    }
    map.get(b.work_order_id).bills.push(b);
  }
  return Array.from(map.values()).map((g) => {
    const pendingCount = g.bills.filter((x) => x.status === "submitted").length;
    const approvedCount = g.bills.filter((x) => x.status === "approved").length;
    const rejectedCount = g.bills.filter((x) => x.status === "rejected").length;
    const totalNonRejectedBilled = g.bills
      .filter((x) => x.status !== "rejected")
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    return {
      ...g,
      pendingCount,
      approvedCount,
      rejectedCount,
      totalNonRejectedBilled,
    };
  });
}

function defaultFinanceInnerTab(group) {
  if (group.pendingCount > 0) return "submitted";
  if (group.approvedCount > 0) return "approved";
  return "rejected";
}

// Loaded fresh each time the page opens; no polling.
const LOADS = [fetchExpenseBills, fetchWorkOrders, fetchExpenseSettings];

function FinanceExpensesContent() {
  const showToast = useToast();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const topTab = searchParams.get("tab") === "quotes" ? "quotes" : "bills";

  const bills = useSelector(selectAllExpenseBills);
  const quoteCount = useSelector(selectAllWorkOrders).filter((w) => w.status === "approval").length;
  const savedCap = useSelector(selectExpenseSettings).auto_approve_cap;
  const { loading, error } = useLiveData(LOADS, { intervalMs: 0 });
  const [woScope, setWoScope] = useState("active"); // "active" | "archived"
  const [expandedWos, setExpandedWos] = useState({});
  const [woInnerTab, setWoInnerTab] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  // Cap modal state
  const [capModalOpen, setCapModalOpen] = useState(false);
  const [capInput, setCapInput] = useState("1500");
  const [savingCap, setSavingCap] = useState(false);

  // Sign-off / Review modal state
  const [reviewingBill, setReviewingBill] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  // Attachment preview modal state
  const [previewModal, setPreviewModal] = useState(null); // { bill, initialAttachment }

  useEffect(() => {
    if (error) showToast(error || "Failed to load maintenance spend data.", "error");
  }, [error, showToast]);

  function switchTopTab(nextTab) {
    if (nextTab === "quotes") {
      setSearchParams({ tab: "quotes" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  function openCapModal() {
    setCapInput(String(savedCap));
    setCapModalOpen(true);
  }

  async function handleSaveCap() {
    const numeric = Number(capInput);
    if (!Number.isFinite(numeric) || numeric < 0) {
      showToast("Cap must be a non-negative number.", "error");
      return;
    }
    setSavingCap(true);
    try {
      const updated = await dispatch(
        updateExpenseSettings({ auto_approve_cap: numeric }),
      ).unwrap();
      setCapInput(String(updated.auto_approve_cap));
      setCapModalOpen(false);
      showToast(
        updated.auto_approve_cap === 0
          ? "Auto-approval disabled. All bills now require manual Finance sign-off."
          : `Minor expense cap updated to ${formatCurrency(updated.auto_approve_cap)} per Work Order.`,
        "success",
      );
    } catch (err) {
      showToast(err.message || "Failed to update cap.", "error");
    } finally {
      setSavingCap(false);
    }
  }

  const pendingCount = bills.filter((b) => b.status === "submitted").length;

  // Apply search across bills while keeping each Work Order grouped together
  const searchFilteredBills = searchQuery.trim()
    ? bills.filter((b) => {
        const q = searchQuery.toLowerCase();
        return (
          (b.title || "").toLowerCase().includes(q) ||
          (b.vendor || "").toLowerCase().includes(q) ||
          (b.work_order_title || "").toLowerCase().includes(q) ||
          formatWOId(b.work_order_id).toLowerCase().includes(q) ||
          (b.submitted_by_name || "").toLowerCase().includes(q) ||
          (b.bill_number || "").toLowerCase().includes(q)
        );
      })
    : bills;

  const activeGroups = groupBillsByWorkOrder(
    searchFilteredBills.filter((b) => b.work_order_status !== "closed"),
  );
  const archivedGroups = groupBillsByWorkOrder(
    searchFilteredBills.filter((b) => b.work_order_status === "closed"),
  );
  const visibleGroups = woScope === "active" ? activeGroups : archivedGroups;

  function toggleWoGroup(woId) {
    setExpandedWos((prev) => ({ ...prev, [woId]: !prev[woId] }));
  }

  function getActiveInnerTab(group) {
    const counts = {
      submitted: group.pendingCount,
      approved: group.approvedCount,
      rejected: group.rejectedCount,
    };
    const chosen = woInnerTab[group.workOrderId];
    if (chosen && counts[chosen] > 0) {
      return chosen;
    }
    return defaultFinanceInnerTab(group);
  }

  function renderHeaderSignalBadge(group) {
    if (group.variance?.over_estimate) {
      return <span className="badge-variance-over">Over estimate</span>;
    }
    if (group.pendingCount > 0) {
      return <span className="badge-status badge-submitted">{group.pendingCount} to review</span>;
    }
    if (group.rejectedCount > 0) {
      return <span className="badge-cap-warn">Rejected</span>;
    }
    return <span className="badge-status badge-approved">Approved</span>;
  }

  // Actions
  async function handleApprove(billId) {
    setActionBusy(true);
    try {
      await dispatch(
        reviewExpenseBill({ id: billId, changes: { status: "approved" } }),
      ).unwrap();
      showToast("Expense bill verified and cleared for settlement.", "success");
      setReviewingBill(null);
      setRejecting(false);
      setRejectionReason("");
    } catch (err) {
      showToast(err.message || "Failed to approve bill.", "error");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReject(billId, isRevoke = false) {
    if (!rejectionReason.trim()) {
      showToast("Please provide a clarification or hold reason.", "error");
      return;
    }
    setActionBusy(true);
    try {
      await dispatch(
        reviewExpenseBill({
          id: billId,
          changes: { status: "rejected", rejection_reason: rejectionReason.trim() },
        }),
      ).unwrap();
      showToast(
        isRevoke
          ? "Auto-approval held & revoked; technician notified to attach receipt & resubmit."
          : "Expense bill placed on hold; technician notified for clarification.",
        "warning",
      );
      setReviewingBill(null);
      setRejecting(false);
      setRejectionReason("");
    } catch (err) {
      showToast(err.message || "Failed to update bill.", "error");
    } finally {
      setActionBusy(false);
    }
  }

  function openReview(bill) {
    setReviewingBill(bill);
    setRejecting(false);
    setRejectionReason("");
  }

  const isAutoApprovedModal =
    reviewingBill?.status === "approved" &&
    reviewingBill?.auto_approved === true &&
    reviewingBill?.work_order_status !== "closed";
  const isManualApprovedModal =
    reviewingBill?.status === "approved" && !reviewingBill?.auto_approved;

  return (
    <FinanceLayout styles={[sharedCss, overviewCss, pageCss]}>
      <div className="finance-expenses-page">
        {/* Clean Header + Compact Cap Trigger */}
        <div className="fe-header-row">
          <div>
            <h1 style={{ margin: "0 0 4px 0", fontSize: "24px", color: "#0f172a" }}>
              Maintenance Spend
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Authorize pre-work quotes and verify actual expense receipts.
            </p>
          </div>
          {topTab === "bills" && (
            <button
              type="button"
              className="fe-cap-trigger"
              onClick={openCapModal}
            >
              <span>
                {savedCap === 0 ? "Auto-approve: Off" : `Auto-approve cap: ${formatCurrency(savedCap)}`}
              </span>
              <span className="fe-cap-edit-tag">Edit</span>
            </button>
          )}
        </div>

        {/* Unified 2-Tab Switcher */}
        <div className="fe-top-tabs">
          <button
            type="button"
            className={`fe-top-tab ${topTab === "bills" ? "active" : ""}`}
            onClick={() => switchTopTab("bills")}
          >
            Expense Bills ({pendingCount})
          </button>
          <button
            type="button"
            className={`fe-top-tab ${topTab === "quotes" ? "active" : ""}`}
            onClick={() => switchTopTab("quotes")}
          >
            Pre-Work Quotes ({quoteCount})
          </button>
        </div>

        {topTab === "quotes" ? (
          <MaintenanceApprovals />
        ) : (
          <>
            {/* Active / Archived View Pills + Search */}
            <div className="fe-controls">
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`fo-btn ${woScope === "active" ? "primary" : ""}`}
                  onClick={() => setWoScope("active")}
                >
                  Active Work Orders ({activeGroups.length})
                </button>
                <button
                  type="button"
                  className={`fo-btn ${woScope === "archived" ? "primary" : ""}`}
                  onClick={() => setWoScope("archived")}
                >
                  Archived / Closed ({archivedGroups.length})
                </button>
              </div>

              <input
                type="text"
                className="fe-search-input"
                placeholder="Search bill, vendor, WO, tech…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Work Order Accordion List */}
            {loading ? (
              <div className="fe-table-card" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                Loading expense bills…
              </div>
            ) : visibleGroups.length === 0 ? (
              <div className="fe-table-card" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                {woScope === "active"
                  ? "No active work orders with expense bills match your search."
                  : "No archived work orders with expense bills match your search."}
              </div>
            ) : (
              <div className="fe-wo-list">
                {visibleGroups.map((group) => {
                  const isExpanded = !!expandedWos[group.workOrderId];
                  const innerTab = getActiveInnerTab(group);
                  const innerBills = group.bills.filter((b) => b.status === innerTab);

                  return (
                    <div key={group.workOrderId} className="fe-wo-card">
                      <button
                        type="button"
                        className="fe-wo-header"
                        onClick={() => toggleWoGroup(group.workOrderId)}
                        aria-expanded={isExpanded}
                      >
                        <div className="fe-wo-header-main">
                          <span className="fe-wo-chevron">{isExpanded ? "▾" : "▸"}</span>
                          <div>
                            <div className="fe-wo-title-row">
                              <strong>
                                {formatWOId(group.workOrderId)} · {group.workOrderTitle}
                              </strong>
                            </div>
                            <div className="fe-wo-meta">
                              <span>
                                {group.submittedByName} · {group.bills.length} bill
                                {group.bills.length === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="fe-wo-badges">
                          <div className="fe-wo-amount-wrap">
                            <strong className="fe-wo-total">
                              {formatCurrency(group.totalNonRejectedBilled)}
                            </strong>
                            {group.variance?.has_estimate && (
                              <span className="fe-wo-est">
                                / {formatCurrency(group.variance.estimated_total)} est.
                              </span>
                            )}
                          </div>
                          {renderHeaderSignalBadge(group)}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="fe-wo-body">
                          {(group.variance?.exceeds_auto_approve_cap || group.variance?.split_bill_watch) && (
                            <div className="fe-wo-inline-warnings">
                              {group.variance?.exceeds_auto_approve_cap && (
                                <span className="badge-cap-warn">
                                  Cap exceeded ({formatCurrency(group.variance.work_order_billed_total)} /{" "}
                                  {formatCurrency(group.variance.auto_approve_cap)})
                                </span>
                              )}
                              {group.variance?.split_bill_watch && (
                                <span className="badge-cap-warn">
                                  Split-bill watch ({group.variance.work_order_bill_count} bills)
                                </span>
                              )}
                            </div>
                          )}

                          {/* Nested Per-WO Inner Status Pills */}
                          <div className="fe-inner-tabs">
                            <button
                              type="button"
                              className={`fe-inner-pill ${innerTab === "submitted" ? "active" : ""}`}
                              onClick={() =>
                                setWoInnerTab((prev) => ({
                                  ...prev,
                                  [group.workOrderId]: "submitted",
                                }))
                              }
                            >
                              Pending ({group.pendingCount})
                            </button>
                            <button
                              type="button"
                              className={`fe-inner-pill ${innerTab === "approved" ? "active" : ""}`}
                              onClick={() =>
                                setWoInnerTab((prev) => ({
                                  ...prev,
                                  [group.workOrderId]: "approved",
                                }))
                              }
                            >
                              Approved ({group.approvedCount})
                            </button>
                            <button
                              type="button"
                              className={`fe-inner-pill ${innerTab === "rejected" ? "active" : ""}`}
                              onClick={() =>
                                setWoInnerTab((prev) => ({
                                  ...prev,
                                  [group.workOrderId]: "rejected",
                                }))
                              }
                            >
                              Rejected ({group.rejectedCount})
                            </button>
                          </div>

                          {innerBills.length === 0 ? (
                            <div style={{ padding: "20px", textAlign: "center", fontSize: "13px", color: "#64748b" }}>
                              No bills in this status for this work order.
                            </div>
                          ) : (
                            <table className="fe-table">
                              <thead>
                                <tr>
                                  <th>Bill</th>
                                  <th>Date</th>
                                  <th>Amount</th>
                                  <th>Status</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {innerBills.map((b) => (
                                  <tr key={b.expense_bill_id}>
                                    <td>
                                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{b.title}</div>
                                      <div style={{ fontSize: "12px", color: "#64748b" }}>{b.vendor}</div>
                                    </td>
                                    <td style={{ whiteSpace: "nowrap" }}>{b.bill_date}</td>
                                    <td>
                                      <strong style={{ color: "#0f172a" }}>{formatCurrency(b.amount)}</strong>
                                    </td>
                                    <td>{renderStatusBadge(b)}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className={`fo-btn ${b.status === "submitted" ? "primary" : ""}`}
                                        onClick={() => openReview(b)}
                                        style={{ padding: "4px 10px", fontSize: "12px" }}
                                      >
                                        {b.status === "submitted" ? "Review" : "View"}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Cap Edit Modal */}
        {capModalOpen && (
          <Modal
            title="Minor Expense Auto-Approve Cap"
            confirmLabel="Save"
            cancelLabel="Cancel"
            busy={savingCap}
            onConfirm={handleSaveCap}
            onClose={() => setCapModalOpen(false)}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label htmlFor="cap-modal-input" style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                Cumulative Cap per Work Order (₹)
              </label>
              <div className="fe-cap-input-wrap" style={{ width: "100%" }}>
                <span>₹</span>
                <input
                  id="cap-modal-input"
                  type="number"
                  min="0"
                  step="100"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  disabled={savingCap}
                  style={{ width: "100%" }}
                />
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                Applies cumulatively per Work Order, max 2 bills. Set to 0 to disable.
              </p>
            </div>
          </Modal>
        )}

        {/* Attachment preview modal */}
        {previewModal && (
          <BillAttachmentModal
            bill={previewModal.bill}
            initialAttachment={previewModal.initialAttachment}
            onClose={() => setPreviewModal(null)}
          />
        )}

        {/* Review & Sign-Off Modal */}
        {reviewingBill && (
          <Modal
            title={`Review Expense Bill — ${reviewingBill.title}`}
            confirmLabel="Close"
            cancelLabel=""
            wide
            onClose={() => setReviewingBill(null)}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {isAutoApprovedModal && (
                <div className="fe-auto-banner">
                  <div>
                    <strong>Auto-Approved</strong> under the{" "}
                    {formatCurrency(reviewingBill.variance?.auto_approve_cap ?? savedCap)} cumulative Work Order cap.
                    Finance can flag and hold this auto-approval if a receipt check or correction is needed.
                  </div>
                </div>
              )}

              {isManualApprovedModal && (
                <div className="fe-locked-banner">
                  🔒 Signed off by <strong>{reviewingBill.reviewed_by_name || "Finance"}</strong>
                  {reviewingBill.reviewed_at
                    ? ` on ${new Date(reviewingBill.reviewed_at).toLocaleString()}`
                    : ""}
                  . Manually approved bills are locked.
                </div>
              )}

              {(reviewingBill.variance?.exceeds_auto_approve_cap || reviewingBill.variance?.split_bill_watch) && (
                <div className="fe-wo-inline-warnings" style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #fde68a", background: "#fffbeb" }}>
                  {reviewingBill.variance?.exceeds_auto_approve_cap && (
                    <span className="badge-cap-warn">
                      Cap exceeded ({formatCurrency(reviewingBill.variance.work_order_billed_total)} /{" "}
                      {formatCurrency(reviewingBill.variance.auto_approve_cap)})
                    </span>
                  )}
                  {reviewingBill.variance?.split_bill_watch && (
                    <span className="badge-cap-warn">
                      Split-bill watch ({reviewingBill.variance.work_order_bill_count} bills on this WO)
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", background: "#f8fafc", padding: "16px", borderRadius: "6px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Work Order:</div>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                    {formatWOId(reviewingBill.work_order_id)} — {reviewingBill.work_order_title}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Vendor:</div>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>{reviewingBill.vendor}</strong>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Category:</div>
                  <strong style={{ fontSize: "14px", color: "#0f172a", textTransform: "capitalize" }}>{reviewingBill.category}</strong>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Bill Date / Number:</div>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                    {reviewingBill.bill_date} {reviewingBill.bill_number ? `(#${reviewingBill.bill_number})` : ""}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Submitted By:</div>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>{reviewingBill.submitted_by_name}</strong>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Bill Amount:</div>
                  <strong style={{ fontSize: "18px", color: "#0284c7" }}>{formatCurrency(reviewingBill.amount)}</strong>
                </div>
              </div>

              {reviewingBill.notes && (
                <div style={{ fontSize: "13px", color: "#334155", background: "#ffffff", border: "1px solid #e2e8f0", padding: "10px 14px", borderRadius: "6px" }}>
                  <strong>Notes:</strong> {reviewingBill.notes}
                </div>
              )}

              {/* Estimate vs Actual Box */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "14px", background: reviewingBill.variance?.over_estimate ? "#fffbeb" : "#f0fdf4" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#0f172a" }}>
                  Work Order Budget & Variance Analysis
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Approved Estimate:</span>{" "}
                    <strong>
                      {reviewingBill.variance?.has_estimate
                        ? formatCurrency(reviewingBill.variance.estimated_total)
                        : "No approved estimate"}
                    </strong>
                    {reviewingBill.variance?.estimated_materials != null && (
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        Materials: {formatCurrency(reviewingBill.variance.estimated_materials)} | Labor: {formatCurrency(reviewingBill.variance.estimated_labor)}
                      </div>
                    )}
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Cumulative Billed:</span>{" "}
                    <strong>{formatCurrency(reviewingBill.variance?.work_order_billed_total || 0)}</strong>{" "}
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      ({reviewingBill.variance?.work_order_bill_count} bill(s))
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Variance:</span>{" "}
                    {reviewingBill.variance?.has_estimate ? (
                      reviewingBill.variance.over_estimate ? (
                        <strong style={{ color: "#b45309" }}>
                          +{formatCurrency(reviewingBill.variance.variance_amount)} (Over budget)
                        </strong>
                      ) : (
                        <strong style={{ color: "#16a34a" }}>
                          Within estimate ({formatCurrency(Math.abs(reviewingBill.variance.variance_amount || 0))} under)
                        </strong>
                      )
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Attached receipts list */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#0f172a" }}>
                  Attached Receipts ({reviewingBill.attachments?.length || 0})
                </h4>
                {(!reviewingBill.attachments || reviewingBill.attachments.length === 0) ? (
                  <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>No attachments provided with this bill.</p>
                ) : (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {reviewingBill.attachments.map((att) => (
                      <button
                        key={att.filename}
                        type="button"
                        onClick={() => setPreviewModal({ bill: reviewingBill, initialAttachment: att })}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "13px",
                        }}
                      >
                        📄 {att.original_name} ({(att.size / 1024).toFixed(1)} KB)
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit History */}
              {reviewingBill.history && reviewingBill.history.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#64748b" }}>Audit History</h4>
                  <div className="fe-history-list">
                    {reviewingBill.history.map((h, i) => (
                      <div key={i} className="fe-history-item">
                        <strong>{new Date(h.at).toLocaleString()}</strong> — {h.role} ({h.action})
                        {h.note && `: "${h.note}"`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision Controls */}
              {(reviewingBill.status === "submitted" || isAutoApprovedModal) && (
                <div style={{ marginTop: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                  {!rejecting ? (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                      {isAutoApprovedModal ? (
                        <button
                          type="button"
                          className="fo-btn"
                          style={{ color: "#dc2626", borderColor: "#fca5a5" }}
                          onClick={() => setRejecting(true)}
                          disabled={actionBusy}
                        >
                          Hold &amp; Flag Auto-Approval
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="fo-btn"
                            style={{ color: "#dc2626" }}
                            onClick={() => setRejecting(true)}
                            disabled={actionBusy}
                          >
                            Hold &amp; Request Clarification
                          </button>
                          <button
                            type="button"
                            className="fo-btn primary"
                            onClick={() => handleApprove(reviewingBill.expense_bill_id)}
                            disabled={actionBusy}
                          >
                            {actionBusy ? "Processing…" : "Approve & Settle"}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: "#fef2f2", padding: "14px", borderRadius: "6px", border: "1px solid #fecaca" }}>
                      <label htmlFor="rejection-reason" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#991b1b", marginBottom: "6px" }}>
                        {isAutoApprovedModal ? "Clarification / Hold Reason (Required) *" : "Clarification Reason (Required) *"}
                      </label>
                      <textarea
                        id="rejection-reason"
                        rows="2"
                        placeholder={
                          isAutoApprovedModal
                            ? "Explain why this auto-approved bill needs a receipt or correction…"
                            : "Explain what needs fixing (e.g. blurry receipt, missing bill #, exceeds quote)..."
                        }
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #fca5a5",
                          fontSize: "13px",
                          outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                        <button
                          type="button"
                          className="fo-btn"
                          onClick={() => {
                            setRejecting(false);
                            setRejectionReason("");
                          }}
                          disabled={actionBusy}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="fo-btn"
                          style={{ background: "#dc2626", color: "#ffffff", borderColor: "#dc2626" }}
                          disabled={actionBusy || !rejectionReason.trim()}
                          onClick={() => handleReject(reviewingBill.expense_bill_id, isAutoApprovedModal)}
                        >
                          {actionBusy ? "Submitting…" : "Confirm Hold"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal>
        )}
      </div>
    </FinanceLayout>
  );
}

export default function FinanceExpenses() {
  return (
    <ToastProvider>
      <FinanceExpensesContent />
    </ToastProvider>
  );
}
