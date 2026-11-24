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

function FinanceExpensesContent() {
  const showToast = useToast();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState("submitted"); // "submitted", "approved", "rejected", "all"
  const [searchQuery, setSearchQuery] = useState("");
  const [overEstimateOnly, setOverEstimateOnly] = useState(false);

  // Sign-off / Review modal state
  const [reviewingBill, setReviewingBill] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  // Attachment preview modal state
  const [previewModal, setPreviewModal] = useState(null); // { bill, initialAttachment }

  useEffect(() => {
    let cancelled = false;
    api
      .get("/expense-bills")
      .then((data) => {
        if (!cancelled) {
          setBills(Array.isArray(data) ? data : []);
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

  // Filtered bills
  const filteredBills = bills.filter((b) => {
    if (activeTab !== "all" && b.status !== activeTab) {
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
      const matchTech = (b.submitted_by_name || "").toLowerCase().includes(q);
      const matchNum = (b.bill_number || "").toLowerCase().includes(q);
      if (!matchTitle && !matchVendor && !matchWo && !matchTech && !matchNum) {
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
  const approvedCount = approvedBills.length;
  const approvedSum = approvedBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const overEstimateFlagged = pendingBills.filter((b) => b.variance?.over_estimate).length;

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

  async function handleReject(billId) {
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
      showToast("Expense bill rejected; technician notified for revision.", "warning");
      setReviewingBill(null);
      setRejecting(false);
      setRejectionReason("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message || "Failed to reject bill.", "error");
    } finally {
      setActionBusy(false);
    }
  }

  function openReview(bill) {
    setReviewingBill(bill);
    setRejecting(false);
    setRejectionReason("");
  }

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
            <div className="fe-kpi-sub">{approvedCount} bill(s) authorized</div>
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
              Pending Review ({bills.filter((b) => b.status === "submitted").length})
            </button>
            <button
              type="button"
              className={`fo-btn ${activeTab === "approved" ? "primary" : ""}`}
              onClick={() => setActiveTab("approved")}
            >
              Approved ({bills.filter((b) => b.status === "approved").length})
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

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
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

        {/* Bills Table */}
        <div className="fe-table-card">
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading expense bills…</div>
          ) : filteredBills.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>No expense bills match current filters.</div>
          ) : (
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
                        <div style={{ fontSize: "12px", color: "#64748b" }}>WO: {b.work_order_title}</div>
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
                            style={{
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              borderRadius: "4px",
                              padding: "2px 8px",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            📎 {b.attachments.length} receipt{b.attachments.length > 1 ? "s" : ""}
                          </button>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>None</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge-status badge-${b.status}`}>
                          {b.status}
                        </span>
                      </td>
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
          )}
        </div>

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
              {/* Top details grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", background: "#f8fafc", padding: "16px", borderRadius: "6px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Work Order:</div>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>{reviewingBill.work_order_title}</strong>
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

              {/* Decision Controls (only for submitted bills) */}
              {reviewingBill.status === "submitted" && (
                <div style={{ marginTop: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                  {!rejecting ? (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
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
                    </div>
                  ) : (
                    <div style={{ background: "#fef2f2", padding: "14px", borderRadius: "6px", border: "1px solid #fecaca" }}>
                      <label htmlFor="rejection-reason" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#991b1b", marginBottom: "6px" }}>
                        Rejection Reason (Required) *
                      </label>
                      <textarea
                        id="rejection-reason"
                        rows="2"
                        placeholder="Explain what the technician needs to adjust or clarify (e.g. blurry receipt, amount mismatch)…"
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
                          onClick={() => handleReject(reviewingBill.expense_bill_id)}
                        >
                          {actionBusy ? "Submitting…" : "Confirm Rejection"}
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
