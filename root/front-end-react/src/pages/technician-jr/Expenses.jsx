import { useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import ToastStack from "../technician/components/ToastStack";
import { useToast } from "../technician/components/useToast";
import BillAttachmentModal from "../../ui/BillAttachmentModal";

import "../../styles/shared/tech_shared.css";
import "../technician/technician.css";
import "./technician-jr.css";
import "./expenses.css";

const CATEGORIES = [
  { value: "parts", label: "Parts" },
  { value: "materials", label: "Materials" },
  { value: "consumables", label: "Consumables" },
  { value: "tools", label: "Tools" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

export default function TechnicianJrExpenses() {
  const { user } = useAuth();
  const { toasts, showToast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectedWo = searchParams.get("wo");

  const [workOrders, setWorkOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [filterTab, setFilterTab] = useState("all");

  // Form state
  const [woId, setWoId] = useState(preselectedWo || "");
  const [title, setTitle] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("materials");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [billNumber, setBillNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [draftBillId, setDraftBillId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Attachment preview modal state
  const [previewModal, setPreviewModal] = useState(null); // { bill, initialAttachment }

  // Edit / Resubmit modal state
  const [editingBill, setEditingBill] = useState(null);
  const [editFiles, setEditFiles] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fileInputId = useId();
  const editFileInputId = useId();

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.get("/work-orders"), api.get("/expense-bills")])
      .then(([woList, billList]) => {
        if (cancelled) return;
        const myWos = (woList || []).filter(
          (wo) =>
            wo.assigned_to_id === user?.user_id &&
            ["inprogress", "review", "closed"].includes(wo.status),
        );
        setWorkOrders(myWos);
        setWoId((prev) => {
          if (preselectedWo && myWos.some((w) => w.work_order_id === preselectedWo)) {
            return preselectedWo;
          }
          if (!prev && myWos.length > 0) {
            return myWos[0].work_order_id;
          }
          return prev;
        });
        setBills(billList || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          showToast(err.message || "Failed to load data.", "error");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.user_id, preselectedWo, showToast, reloadKey]);

  const selectedWo = workOrders.find((w) => w.work_order_id === woId);
  const estimatedTotal =
    typeof selectedWo?.details?.estimate?.total === "number"
      ? selectedWo.details.estimate.total
      : null;

  // Calculate already billed on selected work order from non-rejected bills
  const alreadyBilled = bills
    .filter(
      (b) =>
        b.work_order_id === woId &&
        b.status !== "rejected",
    )
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const numericEnteredAmount = Number(amount) || 0;
  const projectedTotal = alreadyBilled + numericEnteredAmount;
  const isOverEstimate =
    estimatedTotal !== null && projectedTotal > estimatedTotal;

  // Handle file selection
  function handleFileChange(e) {
    const files = Array.from(e.target.files);
    if (selectedFiles.length + files.length > 5) {
      showToast("Maximum 5 files allowed.", "error");
      return;
    }
    const oversized = files.some((f) => f.size > 10 * 1024 * 1024);
    if (oversized) {
      showToast("Files must be under 10 MB each.", "error");
      return;
    }
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  function removeSelectedFile(index) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!woId) {
      showToast("Please select a work order.", "error");
      return;
    }
    if (!title.trim() || !vendor.trim()) {
      showToast("Title and vendor are required.", "error");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      showToast("Amount must be greater than zero.", "error");
      return;
    }

    setSubmitting(true);
    let currentId = draftBillId;

    try {
      if (!currentId) {
        const payload = {
          work_order_id: woId,
          title: title.trim(),
          vendor: vendor.trim(),
          category,
          bill_date: billDate,
          bill_number: billNumber.trim() || undefined,
          amount: Number(amount),
          notes: notes.trim() || undefined,
        };
        const created = await api.post("/expense-bills", payload);
        currentId = created.expense_bill_id;
        setDraftBillId(currentId);
      }

      if (selectedFiles.length > 0) {
        await api.upload(`/expense-bills/${currentId}/attachments`, "files", selectedFiles);
      }

      showToast("Expense bill submitted successfully!", "success");
      setDraftBillId(null);
      setTitle("");
      setVendor("");
      setBillNumber("");
      setAmount("");
      setNotes("");
      setSelectedFiles([]);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message || "Failed to submit expense bill.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBill(billId) {
    if (!window.confirm("Are you sure you want to delete this expense bill?")) {
      return;
    }
    try {
      await api.delete(`/expense-bills/${billId}`);
      showToast("Expense bill deleted.", "success");
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message || "Failed to delete expense bill.", "error");
    }
  }

  // Edit / Resubmit methods
  function openEditModal(bill) {
    setEditingBill({
      ...bill,
      amount: String(bill.amount),
    });
    setEditFiles([]);
  }

  async function handleDeleteExistingAttachment(billId, filename) {
    try {
      const updated = await api.delete(`/expense-bills/${billId}/attachments/${filename}`);
      setEditingBill(updated);
      showToast("Attachment removed.", "success");
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message || "Failed to remove attachment.", "error");
    }
  }

  function handleEditFileChange(e) {
    const files = Array.from(e.target.files);
    const totalCount = (editingBill.attachments?.length || 0) + editFiles.length + files.length;
    if (totalCount > 5) {
      showToast("Maximum 5 attachments allowed per bill.", "error");
      return;
    }
    const oversized = files.some((f) => f.size > 10 * 1024 * 1024);
    if (oversized) {
      showToast("Files must be under 10 MB each.", "error");
      return;
    }
    setEditFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  async function handleSaveAndResubmit(e) {
    e.preventDefault();
    if (!editingBill.title?.trim() || !editingBill.vendor?.trim()) {
      showToast("Title and vendor are required.", "error");
      return;
    }
    if (!editingBill.amount || Number(editingBill.amount) <= 0) {
      showToast("Amount must be greater than zero.", "error");
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = {
        title: editingBill.title.trim(),
        vendor: editingBill.vendor.trim(),
        category: editingBill.category,
        bill_date: editingBill.bill_date,
        bill_number: editingBill.bill_number?.trim() || undefined,
        amount: Number(editingBill.amount),
        notes: editingBill.notes?.trim() || undefined,
        status: "submitted",
      };

      await api.patch(`/expense-bills/${editingBill.expense_bill_id}`, payload);

      if (editFiles.length > 0) {
        await api.upload(
          `/expense-bills/${editingBill.expense_bill_id}/attachments`,
          "files",
          editFiles,
        );
      }

      showToast("Bill updated and resubmitted successfully!", "success");
      setEditingBill(null);
      setEditFiles([]);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message || "Failed to resubmit bill.", "error");
    } finally {
      setEditSubmitting(false);
    }
  }

  // Summary counts
  const totalSubmitted = bills.length;
  const pendingReview = bills.filter((b) => b.status === "submitted").length;
  const approvedSum = bills
    .filter((b) => b.status === "approved")
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const rejectedCount = bills.filter((b) => b.status === "rejected").length;

  const filteredBills = bills.filter((b) => {
    if (filterTab === "all") return true;
    return b.status === filterTab;
  });

  return (
    <div className="tech-expenses-container">
      <ToastStack toasts={toasts} />

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", color: "#0f172a" }}>
          Expense Bills & Receipts
        </h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
          Upload material and repair receipts for finance verification and sign-off.
        </p>
      </div>

      {/* Summary Pills */}
      <div className="tech-expenses-pills">
        <div className="tech-expense-pill">
          <div className="pill-label">Total Bills</div>
          <div className="pill-value">{totalSubmitted}</div>
        </div>
        <div className="tech-expense-pill">
          <div className="pill-label">Pending Review</div>
          <div className="pill-value" style={{ color: "#0284c7" }}>
            {pendingReview}
          </div>
        </div>
        <div className="tech-expense-pill">
          <div className="pill-label">Approved Spend</div>
          <div className="pill-value" style={{ color: "#16a34a" }}>
            ₹{approvedSum.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="tech-expense-pill">
          <div className="pill-label">Needs Revision</div>
          <div className="pill-value" style={{ color: "#dc2626" }}>
            {rejectedCount}
          </div>
        </div>
      </div>

      {/* Upload Form Card */}
      <div className="tech-expense-card">
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", color: "#1e293b" }}>
          Upload New Expense Bill
        </h2>

        {workOrders.length === 0 && !loading ? (
          <div className="callout callout--warning">
            You do not have any In Progress, Review, or Closed work orders to submit bills against.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="tech-form-group">
              <label htmlFor="wo-select">Work Order *</label>
              <select
                id="wo-select"
                value={woId}
                onChange={(e) => setWoId(e.target.value)}
                required
              >
                <option value="">Select a work order…</option>
                {workOrders.map((wo) => (
                  <option key={wo.work_order_id} value={wo.work_order_id}>
                    {wo.title} ({wo.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedWo && (
              <div className={`tech-estimate-banner ${isOverEstimate ? "warning" : ""}`}>
                <div>
                  <strong>Approved Estimate:</strong>{" "}
                  {estimatedTotal !== null
                    ? `₹${estimatedTotal.toLocaleString("en-IN")}`
                    : "No approved estimate on file"}
                  {" | "}
                  <strong>Already Billed:</strong> ₹{alreadyBilled.toLocaleString("en-IN")}
                </div>
                {isOverEstimate && (
                  <div style={{ color: "#b45309", fontWeight: 600 }}>
                    ⚠️ Warning: Total billing (₹{projectedTotal.toLocaleString("en-IN")}) will
                    exceed the approved estimate of ₹{estimatedTotal.toLocaleString("en-IN")} by ₹
                    {(projectedTotal - estimatedTotal).toLocaleString("en-IN")}.
                  </div>
                )}
              </div>
            )}

            <div className="tech-expense-form-grid">
              <div className="tech-form-group">
                <label htmlFor="bill-title">Title / Description *</label>
                <input
                  id="bill-title"
                  type="text"
                  placeholder="e.g. Inverter Cable Connectors"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="tech-form-group">
                <label htmlFor="bill-vendor">Vendor *</label>
                <input
                  id="bill-vendor"
                  type="text"
                  placeholder="e.g. Sri City Electricals"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  required
                />
              </div>

              <div className="tech-form-group">
                <label htmlFor="bill-category">Category *</label>
                <select
                  id="bill-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tech-form-group">
                <label htmlFor="bill-date">Bill Date *</label>
                <input
                  id="bill-date"
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  required
                />
              </div>

              <div className="tech-form-group">
                <label htmlFor="bill-num">Bill / Receipt Number</label>
                <input
                  id="bill-num"
                  type="text"
                  placeholder="e.g. INV-90412"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                />
              </div>

              <div className="tech-form-group">
                <label htmlFor="bill-amount">Amount (₹) *</label>
                <input
                  id="bill-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="tech-form-group" style={{ marginTop: "16px" }}>
              <label htmlFor="bill-notes">Notes / Item Details</label>
              <textarea
                id="bill-notes"
                rows="2"
                placeholder="Optional notes or GST breakdown…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="tech-form-group" style={{ marginTop: "16px" }}>
              <label htmlFor={fileInputId}>Receipt Files (.pdf, .jpg, .png up to 10 MB, max 5 files)</label>
              <input
                id={fileInputId}
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
              {selectedFiles.length > 0 && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                  {selectedFiles.map((f, idx) => (
                    <span key={idx} className="tech-file-chip">
                      {f.name} ({(f.size / 1024).toFixed(0)} KB)
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(idx)}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Uploading…" : draftBillId ? "Retry Upload" : "Submit Expense Bill"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Submitted Bills List */}
      <div className="tech-expense-card">
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", color: "#1e293b" }}>
          My Submitted Expense Bills
        </h2>

        <div className="tech-filter-tabs">
          <button
            type="button"
            className={`tech-filter-tab ${filterTab === "all" ? "active" : ""}`}
            onClick={() => setFilterTab("all")}
          >
            All ({bills.length})
          </button>
          <button
            type="button"
            className={`tech-filter-tab ${filterTab === "submitted" ? "active" : ""}`}
            onClick={() => setFilterTab("submitted")}
          >
            Submitted ({bills.filter((b) => b.status === "submitted").length})
          </button>
          <button
            type="button"
            className={`tech-filter-tab ${filterTab === "rejected" ? "active" : ""}`}
            onClick={() => setFilterTab("rejected")}
          >
            Rejected ({bills.filter((b) => b.status === "rejected").length})
          </button>
          <button
            type="button"
            className={`tech-filter-tab ${filterTab === "approved" ? "active" : ""}`}
            onClick={() => setFilterTab("approved")}
          >
            Approved ({bills.filter((b) => b.status === "approved").length})
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
            Loading expense bills…
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px", textAlign: "center" }}>
            No expense bills in this tab.
          </div>
        ) : (
          <div>
            {filteredBills.map((bill) => (
              <div key={bill.expense_bill_id} className="tech-bill-item">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b" }}>
                      {bill.title}
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                      WO: <strong>{bill.work_order_title}</strong> | Vendor: <strong>{bill.vendor}</strong> | Category: <span style={{ textTransform: "capitalize" }}>{bill.category}</span>
                    </div>
                    {bill.bill_number && (
                      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                        Bill #: {bill.bill_number}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
                      ₹{Number(bill.amount).toLocaleString("en-IN")}
                    </div>
                    <div style={{ marginTop: "4px" }}>
                      <span className={`badge-status badge-${bill.status}`}>
                        {bill.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Over estimate indicator if applicable */}
                {bill.variance?.over_estimate && (
                  <div style={{ fontSize: "12px", color: "#b45309", background: "#fef3c7", padding: "4px 8px", borderRadius: "4px" }}>
                    ⚠️ Total work order billing exceeds approved estimate by ₹
                    {bill.variance.variance_amount?.toLocaleString("en-IN")}.
                  </div>
                )}

                {/* Rejection callout box */}
                {bill.status === "rejected" && (
                  <div style={{ background: "#fef2f2", borderLeft: "4px solid #ef4444", padding: "10px 14px", borderRadius: "4px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#b91c1c" }}>
                      Revision Requested by Finance:
                    </div>
                    <div style={{ fontSize: "13px", color: "#7f1d1d", marginTop: "2px" }}>
                      {bill.rejection_reason}
                    </div>
                  </div>
                )}

                {/* Attachments chips */}
                {bill.attachments && bill.attachments.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>Receipts:</span>
                    {bill.attachments.map((att) => (
                      <button
                        key={att.filename}
                        type="button"
                        className="tech-file-chip"
                        onClick={() => setPreviewModal({ bill, initialAttachment: att })}
                        style={{ cursor: "pointer", border: "1px solid #94a3b8" }}
                      >
                        📄 {att.original_name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  {bill.status === "rejected" && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openEditModal(bill)}
                      style={{ padding: "5px 12px", fontSize: "13px" }}
                    >
                      Edit & Resubmit
                    </button>
                  )}
                  {bill.status !== "approved" && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDeleteBill(bill.expense_bill_id)}
                      style={{ padding: "5px 12px", fontSize: "13px", color: "#dc2626" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attachment Preview Modal */}
      {previewModal && (
        <BillAttachmentModal
          bill={previewModal.bill}
          initialAttachment={previewModal.initialAttachment}
          onClose={() => setPreviewModal(null)}
        />
      )}

      {/* Edit & Resubmit Modal */}
      {editingBill && (
        <div className="fa-modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingBill(null)}>
          <div className="fa-modal wide" role="dialog" aria-modal="true" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <h3 className="fa-modal-title">Edit & Resubmit Expense Bill</h3>
            <div className="fa-modal-body">
              <form onSubmit={handleSaveAndResubmit}>
                <div className="tech-expense-form-grid">
                  <div className="tech-form-group">
                    <label htmlFor="edit-title">Title *</label>
                    <input
                      id="edit-title"
                      type="text"
                      value={editingBill.title || ""}
                      onChange={(e) => setEditingBill({ ...editingBill, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="tech-form-group">
                    <label htmlFor="edit-vendor">Vendor *</label>
                    <input
                      id="edit-vendor"
                      type="text"
                      value={editingBill.vendor || ""}
                      onChange={(e) => setEditingBill({ ...editingBill, vendor: e.target.value })}
                      required
                    />
                  </div>
                  <div className="tech-form-group">
                    <label htmlFor="edit-category">Category *</label>
                    <select
                      id="edit-category"
                      value={editingBill.category}
                      onChange={(e) => setEditingBill({ ...editingBill, category: e.target.value })}
                      required
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tech-form-group">
                    <label htmlFor="edit-date">Bill Date *</label>
                    <input
                      id="edit-date"
                      type="date"
                      value={editingBill.bill_date || ""}
                      onChange={(e) => setEditingBill({ ...editingBill, bill_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="tech-form-group">
                    <label htmlFor="edit-num">Bill Number</label>
                    <input
                      id="edit-num"
                      type="text"
                      value={editingBill.bill_number || ""}
                      onChange={(e) => setEditingBill({ ...editingBill, bill_number: e.target.value })}
                    />
                  </div>
                  <div className="tech-form-group">
                    <label htmlFor="edit-amount">Amount (₹) *</label>
                    <input
                      id="edit-amount"
                      type="number"
                      step="0.01"
                      value={editingBill.amount}
                      onChange={(e) => setEditingBill({ ...editingBill, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="tech-form-group" style={{ marginTop: "16px" }}>
                  <label htmlFor="edit-notes">Notes</label>
                  <textarea
                    id="edit-notes"
                    rows="2"
                    value={editingBill.notes || ""}
                    onChange={(e) => setEditingBill({ ...editingBill, notes: e.target.value })}
                  />
                </div>

                {/* Existing attachments */}
                <div style={{ marginTop: "16px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                    Current Receipts:
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                    {editingBill.attachments?.map((att) => (
                      <span key={att.filename} className="tech-file-chip">
                        {att.original_name}
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteExistingAttachment(
                              editingBill.expense_bill_id,
                              att.filename,
                            )
                          }
                          style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}
                          title="Remove receipt"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Add more files */}
                <div className="tech-form-group" style={{ marginTop: "16px" }}>
                  <label htmlFor={editFileInputId}>Add Additional / Replacement Receipts</label>
                  <input
                    id={editFileInputId}
                    type="file"
                    multiple
                    accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                    onChange={handleEditFileChange}
                  />
                  {editFiles.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                      {editFiles.map((f, idx) => (
                        <span key={idx} className="tech-file-chip">
                          {f.name}
                          <button
                            type="button"
                            onClick={() => setEditFiles(editFiles.filter((_, i) => i !== idx))}
                            style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="fa-modal-actions" style={{ marginTop: "24px" }}>
                  <button
                    type="button"
                    className="fa-modal-cancel"
                    onClick={() => setEditingBill(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="fa-modal-confirm"
                    disabled={editSubmitting}
                  >
                    {editSubmitting ? "Submitting…" : "Confirm & Resubmit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
