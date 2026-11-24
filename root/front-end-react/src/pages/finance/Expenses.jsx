import { useEffect, useState } from "react";
import api from "../../api/client";
import FinanceLayout from "./components/FinanceLayout";
import Modal from "./components/Modal";
import ToastProvider from "./components/ToastProvider";
import { useToast } from "./components/toastContext";
import { formatCurrency } from "./financeUtils";
import BillAttachmentModal from "../../ui/BillAttachmentModal";

import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";
import "./expenses.css";

const WO_STATUS_LABELS = {
  new: "New",
  approval: "Approval",
  inprogress: "In Progress",
  review: "Review",
  closed: "Closed",
};

function formatWOId(id) {
  if (!id) return "WO-XXXX";
  if (id.startsWith("WO-")) return id;
  const parts = id.split("-");
  if (parts.length > 1) return "WO-" + parts[1].toUpperCase();
  return "WO-" + id.substring(0, 4).toUpperCase();
}

function renderStatusBadge(bill) {
  if (bill.status === "approved" && bill.auto_approved) {
    return <span className="badge-status badge-auto-approved">Auto-Approved</span>;
  }
  return <span className={`badge-status badge-${bill.status}`}>{bill.status}</span>;
}

function FinanceExpensesContent() {
  const showToast = useToast();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState("all"); // "submitted", "auto_approved", "approved", "rejected", "all"
  const [viewMode, setViewMode] = useState("grouped"); // "grouped" | "flat"
  const [expandedWos, setExpandedWos] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [overEstimateOnly, setOverEstimateOnly] = useState(false);

  // Settings bar state
  const [capInput, setCapInput] = useState("1500");
  const [savedCap, setSavedCap] = useState(1500);
  const [maxAutoApproved, setMaxAutoApproved] = useState(2);
  const [savingCap, setSavingCap] = useState(false);

  // Sign-off / Review modal state
  const [reviewingBill, setReviewingBill] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  // Attachment preview modal state
  const [previewModal, setPreviewModal] = useState(null); // { bill, initialAttachment }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/expense-bills"),
      api.get("/expense-bills/settings").catch(() => ({
        auto_approve_cap: 1500,
        max_auto_approved_per_wo: 2,
      })),
    ])
      .then(([data, settings]) => {
        if (!cancelled) {
          setBills(Array.isArray(data) ? data : []);
          if (settings && typeof settings.auto_approve_cap === "number") {
            setSavedCap(settings.auto_approve_cap);
            setCapInput(String(settings.auto_approve_cap));
          }
          if (settings && typeof settings.max_auto_approved_per_wo === "number") {
            setMaxAutoApproved(settings.max_auto_approved_per_wo);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          showToast(err.message || "Failed to load expense bills.", "error");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showToast, reloadKey]);

  async function handleSaveCap(e) {
    e.preventDefault();
    const numeric = Number(capInput);
    if (!Number.isFinite(numeric) || numeric < 0) {
      showToast("Cap must be a non-negative number.", "error");
      return;
    }
    setSavingCap(true);
    try {
      const updated = await api.patch("/expense-bills/settings", {
        auto_approve_cap: numeric,
      });
      setSavedCap(updated.auto_approve_cap);
      setCapInput(String(updated.auto_approve_cap));
      showToast(
        updated.auto_approve_cap === 0
          ? "Auto-approval disabled. All bills now require manual Finance sign-off."
          : `Minor expense cap updated to ${formatCurrency(updated.auto_approve_cap)} per Work Order.`,
        "success",
      );
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message || "Failed to update cap.", "error");
    } finally {
      setSavingCap(false);
    }
  }

  // Filtered bills
  const filteredBills = bills.filter((b) => {
    if (activeTab === "auto_approved") {
      if (!(b.status === "approved" && b.auto_approved)) return false;
    } else if (activeTab !== "all" && b.status !== activeTab) {
      return false;
    }
    if (overEstimateOnly && !b.variance?.over_estimate) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (b.title || "").toLowerCase().includes(q);
      const matchVendor = (b.vendor || "").toLowerCase().includes(q);
      const matchWo = (b.work_order_title || "").toLowerCase().includes(q);
      const matchWoId = formatWOId(b.work_order_id).toLowerCase().includes(q);
      const matchTech = (b.submitted_by_name || "").toLowerCase().includes(q);
      const matchNum = (b.bill_number || "").toLowerCase().includes(q);
      if (!matchTitle && !matchVendor && !matchWo && !matchWoId && !matchTech && !matchNum) {
        return false;
      }
    }
    return true;
  });

  // KPI summaries
  const pendingBills = bills.filter((b) => b.status === "submitted");
  const pendingCount = pendingBills.length;
  const pendingSum = pendingBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const approvedBills = bills.filter((b) => b.status === "approved");
  const autoApprovedBills = approvedBills.filter((b) => b.auto_approved === true);
  const manualApprovedCount = approvedBills.length - autoApprovedBills.length;
  const approvedCount = approvedBills.length;
  const approvedSum = approvedBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const overEstimateFlagged = pendingBills.filter((b) => b.variance?.over_estimate).length;

  // Group filtered bills by work_order_id for By Work Order mode
  const woGroupsMap = new Map();
  for (const b of filteredBills) {
    if (!woGroupsMap.has(b.work_order_id)) {
      const allForWo = bills.filter((x) => x.work_order_id === b.work_order_id);
      const nonRejectedForWo = allForWo.filter((x) => x.status !== "rejected");
      woGroupsMap.set(b.work_order_id, {
        workOrderId: b.work_order_id,
        workOrderTitle: b.work_order_title,
        workOrderStatus: b.work_order_status,
        submittedByName: b.submitted_by_name,
        variance: b.variance,
        totalBilledSoFar: nonRejectedForWo.reduce((s, x) => s + Number(x.amount || 0), 0),
        totalNonRejectedCount: nonRejectedForWo.length,
        pendingCount: allForWo.filter((x) => x.status === "submitted").length,
        approvedCount: allForWo.filter((x) => x.status === "approved").length,
        rejectedCount: allForWo.filter((x) => x.status === "rejected").length,
        bills: [],
      });
    }
    woGroupsMap.get(b.work_order_id).bills.push(b);
  }
  const woGroups = Array.from(woGroupsMap.values());

  function toggleWoGroup(woId) {
    setExpandedWos((prev) => ({ ...prev, [woId]: !prev[woId] }));
  }

  // Actions
  async function handleApprove(billId) {
    setActionBusy(true);
    try {
      await api.patch(`/expense-bills/${billId}`, { status: "approved" });
      showToast("Expense bill signed off and approved successfully!", "success");
      setReviewingBill(null);
      setRejecting(false);
      setRejectionReason("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message || "Failed to approve bill.", "error");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReject(billId, isRevoke = false) {
    if (!rejectionReason.trim()) {
      showToast("Please provide a rejection reason.", "error");
      return;
    }
    setActionBusy(true);
    try {
      await api.patch(`/expense-bills/${billId}`, {
        status: "rejected",
        rejection_reason: rejectionReason.trim(),
      });
      showToast(
        isRevoke
          ? "Auto-approval revoked; technician notified to attach receipt & resubmit."
          : "Expense bill rejected; technician notified for revision.",
        "warning",
      );
      setReviewingBill(null);
      setRejecting(false);
      setRejectionReason("");
      setReloadKey((k) => k + 1);
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
    reviewingBill?.status === "approved" && reviewingBill?.auto_approved === true;
  const isManualApprovedModal =
    reviewingBill?.status === "approved" && !reviewingBill?.auto_approved;

  return (
    <FinanceLayout styles={[sharedCss]}>
      <div className="finance-expenses-page">
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", color: "#0f172a" }}>
            Expense Bills Verification & Sign-Off
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            Review technician material receipts, evaluate variance against work order estimates, and sign off.
          </p>
        </div>

        {/* Auto-Approve Cap Control Bar */}
        <form className="fe-cap-bar" onSubmit={handleSaveCap}>
          <div className="fe-cap-info">
            <label htmlFor="auto-approve-cap-input" className="fe-cap-title">
              Minor Expense Auto-Approve Cap (cumulative per Work Order, max {maxAutoApproved} bills)
            </label>
            <div className="fe-cap-note">
              Set to ₹0 to require manual Finance approval for all bills. Currently:{" "}
              <strong>{savedCap === 0 ? "Disabled (₹0)" : formatCurrency(savedCap)}</strong>
            </div>
          </div>
          <div className="fe-cap-actions">
            <div className="fe-cap-input-wrap">
              <span>₹</span>
              <input
                id="auto-approve-cap-input"
                type="number"
                min="0"
                step="100"
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                disabled={savingCap}
              />
            </div>
            <button type="submit" className="fo-btn primary" disabled={savingCap}>
              {savingCap ? "Saving…" : "Save Cap"}
            </button>
          </div>
        </form>

        {/* KPI Cards */}
        <div className="fe-kpi-grid">
          <div className="fe-kpi-card">
            <div className="fe-kpi-label">Pending Sign-Off</div>
            <div className="fe-kpi-value" style={{ color: "#0284c7" }}>
              {pendingCount}
            </div>
            <div className="fe-kpi-sub">Total {formatCurrency(pendingSum)}</div>
          </div>

          <div className="fe-kpi-card">
            <div className="fe-kpi-label">Approved Spend</div>
            <div className="fe-kpi-value" style={{ color: "#16a34a" }}>
              {formatCurrency(approvedSum)}
            </div>
            <div className="fe-kpi-sub">
              {approvedCount} bill(s) ({manualApprovedCount} manual, {autoApprovedBills.length} auto-approved)
            </div>
          </div>

          <div className="fe-kpi-card">
            <div className="fe-kpi-label">Over-Estimate Flagged</div>
            <div className="fe-kpi-value" style={{ color: overEstimateFlagged > 0 ? "#b45309" : "#64748b" }}>
              {overEstimateFlagged}
            </div>
            <div className="fe-kpi-sub">Pending bills exceeding estimates</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="fe-controls">
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`fo-btn ${activeTab === "submitted" ? "primary" : ""}`}
              onClick={() => setActiveTab("submitted")}
            >
              Pending Review ({pendingCount})
            </button>
            <button
              type="button"
              className={`fo-btn ${activeTab === "auto_approved" ? "primary" : ""}`}
              onClick={() => setActiveTab("auto_approved")}
            >
              Auto-Approved ({autoApprovedBills.length})
            </button>
            <button
              type="button"
              className={`fo-btn ${activeTab === "approved" ? "primary" : ""}`}
              onClick={() => setActiveTab("approved")}
            >
              Approved ({approvedCount})
            </button>
            <button
              type="button"
              className={`fo-btn ${activeTab === "rejected" ? "primary" : ""}`}
              onClick={() => setActiveTab("rejected")}
            >
              Rejected ({bills.filter((b) => b.status === "rejected").length})
            </button>
            <button
              type="button"
              className={`fo-btn ${activeTab === "all" ? "primary" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All ({bills.length})
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div className="fe-view-toggle">
              <button
                type="button"
                className={`fe-view-btn ${viewMode === "grouped" ? "active" : ""}`}
                onClick={() => setViewMode("grouped")}
              >
                By Work Order
              </button>
              <button
                type="button"
                className={`fe-view-btn ${viewMode === "flat" ? "active" : ""}`}
                onClick={() => setViewMode("flat")}
              >
                Flat Table
              </button>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", color: "#334155" }}>
              <input
                type="checkbox"
                checked={overEstimateOnly}
                onChange={(e) => setOverEstimateOnly(e.target.checked)}
              />
              Over estimate only
            </label>

            <input
              type="text"
              className="fe-search-input"
              placeholder="Search title, vendor, WO, tech…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Grouped by Work Order or Flat Table */}
        {loading ? (
          <div className="fe-table-card" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            Loading expense bills…
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="fe-table-card" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            No expense bills match current filters.
          </div>
        ) : viewMode === "grouped" ? (
          <div className="fe-wo-list">
            {woGroups.map((group) => {
              const isExpanded = !!expandedWos[group.workOrderId];
              const estText = group.variance?.has_estimate
                ? formatCurrency(group.variance.estimated_total)
                : "No estimate";
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
                            {formatWOId(group.workOrderId)} — {group.workOrderTitle}
                          </strong>
                          {group.workOrderStatus && (
                            <span className="fe-wo-status">
                              {WO_STATUS_LABELS[group.workOrderStatus] || group.workOrderStatus}
                            </span>
                          )}
                        </div>
                        <div className="fe-wo-meta">
                          <span>Technician: <strong>{group.submittedByName}</strong></span>
                          <span>•</span>
                          <span>Estimate: <strong>{estText}</strong></span>
                          <span>•</span>
                          <span>
                            Total Billed So Far: <strong>{formatCurrency(group.totalBilledSoFar)}</strong> across{" "}
                            {group.totalNonRejectedCount} bill(s) ({group.pendingCount} pending, {group.approvedCount} approved, {group.rejectedCount} rejected)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="fe-wo-badges">
                      {group.variance?.over_estimate && (
                        <span className="badge-variance-over">
                          +{formatCurrency(group.variance.variance_amount)} over estimate
                        </span>
                      )}
                      {group.variance?.exceeds_auto_approve_cap && (
                        <span className="badge-cap-warn">Cap exceeded</span>
                      )}
                      {group.variance?.split_bill_watch && (
                        <span className="badge-cap-warn">
                          Split-bill watch ({group.variance.work_order_bill_count} bills)
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="fe-wo-body">
                      <table className="fe-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Vendor / Category</th>
                            <th>Bill Date</th>
                            <th>Amount</th>
                            <th>Receipts</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.bills.map((b) => (
                            <tr key={b.expense_bill_id}>
                              <td>
                                <div style={{ fontWeight: 600, color: "#0f172a" }}>{b.title}</div>
                                {b.bill_number && (
                                  <div style={{ fontSize: "12px", color: "#64748b" }}>#{b.bill_number}</div>
                                )}
                              </td>
                              <td>
                                <div>{b.vendor}</div>
                                <div style={{ fontSize: "12px", color: "#64748b", textTransform: "capitalize" }}>
                                  {b.category}
                                </div>
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>{b.bill_date}</td>
                              <td>
                                <strong style={{ color: "#0f172a" }}>{formatCurrency(b.amount)}</strong>
                              </td>
                              <td>
                                {b.attachments?.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewModal({ bill: b, initialAttachment: b.attachments[0] })
                                    }
                                    className="fe-receipt-btn"
                                  >
                                    📎 {b.attachments.length} receipt{b.attachments.length > 1 ? "s" : ""}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                                    {b.auto_approved ? "Optional" : "None"}
                                  </span>
                                )}
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fe-table-card">
            <table className="fe-table">
              <thead>
                <tr>
                  <th>Bill & Work Order</th>
                  <th>Technician</th>
                  <th>Vendor / Category</th>
                  <th>Bill Date</th>
                  <th>Amount</th>
                  <th>Estimate vs. Actual</th>
                  <th>Receipts</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((b) => {
                  const hasEstimate = b.variance?.has_estimate;
                  const isOver = b.variance?.over_estimate;
                  return (
                    <tr key={b.expense_bill_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{b.title}</div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {formatWOId(b.work_order_id)} — {b.work_order_title}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.submitted_by_name}</div>
                      </td>
                      <td>
                        <div>{b.vendor}</div>
                        <div style={{ fontSize: "12px", color: "#64748b", textTransform: "capitalize" }}>{b.category}</div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{b.bill_date}</td>
                      <td>
                        <strong style={{ color: "#0f172a" }}>{formatCurrency(b.amount)}</strong>
                      </td>
                      <td>
                        {!hasEstimate ? (
                          <span className="badge-variance-none">No estimate</span>
                        ) : isOver ? (
                          <span className="badge-variance-over">
                            +{formatCurrency(b.variance.variance_amount)} over
                          </span>
                        ) : (
                          <span className="badge-variance-ok">Within estimate</span>
                        )}
                      </td>
                      <td>
                        {b.attachments?.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setPreviewModal({ bill: b, initialAttachment: b.attachments[0] })}
                            className="fe-receipt-btn"
                          >
                            📎 {b.attachments.length} receipt{b.attachments.length > 1 ? "s" : ""}
                          </button>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                            {b.auto_approved ? "Optional" : "None"}
                          </span>
                        )}
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
                  );
                })}
              </tbody>
            </table>
          </div>
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
              {/* Auto-approved / Manually signed-off status banner */}
              {isAutoApprovedModal && (
                <div className="fe-auto-banner">
                  <div>
                    <strong>Auto-Approved</strong> under the{" "}
                    {formatCurrency(reviewingBill.variance?.auto_approve_cap ?? savedCap)} cumulative Work Order cap.
                    Finance can flag and revoke this approval if a receipt check or correction is needed.
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

              {/* Top details grid */}
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

              {/* Decision Controls (submitted bills OR revoking auto-approved bills) */}
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
                          Flag & Revoke Auto-Approval
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
                            Reject & Request Revision
                          </button>
                          <button
                            type="button"
                            className="fo-btn primary"
                            onClick={() => handleApprove(reviewingBill.expense_bill_id)}
                            disabled={actionBusy}
                          >
                            {actionBusy ? "Processing…" : "Verify & Sign Off"}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: "#fef2f2", padding: "14px", borderRadius: "6px", border: "1px solid #fecaca" }}>
                      <label htmlFor="rejection-reason" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#991b1b", marginBottom: "6px" }}>
                        {isAutoApprovedModal ? "Revocation Reason (Required) *" : "Rejection Reason (Required) *"}
                      </label>
                      <textarea
                        id="rejection-reason"
                        rows="2"
                        placeholder={
                          isAutoApprovedModal
                            ? "Explain why this auto-approved bill needs a receipt or correction…"
                            : "Explain what the technician needs to adjust or clarify (e.g. blurry receipt, amount mismatch)…"
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
                          {actionBusy
                            ? "Submitting…"
                            : isAutoApprovedModal
                              ? "Confirm Revoke"
                              : "Confirm Rejection"}
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
