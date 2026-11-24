import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import ToastStack from "../technician/components/ToastStack";
import { useToast } from "../technician/components/useToast";
import { formatId } from "../technician/techUtils";
import BillAttachmentModal from "../../ui/BillAttachmentModal";

import "../../styles/shared/tech_shared.css";
import "../technician/technician.css";
import "./technician-jr.css";
import "./expenses.css";

const CATEGORIES = [
  { value: "materials", label: "Materials" },
  { value: "tools", label: "Tools" },
  { value: "labour", label: "Labour" },
  { value: "other", label: "Other" },
];

function renderBillStatusBadge(bill) {
  if (bill.status === "approved" && bill.auto_approved) {
    return <span className="badge-status badge-auto-approved">Auto</span>;
  }
  if (bill.status === "submitted") {
    return <span className="badge-status badge-submitted">Pending</span>;
  }
  if (bill.status === "rejected") {
    return <span className="badge-status badge-rejected">Needs Revision</span>;
  }
  return <span className={`badge-status badge-${bill.status}`}>{bill.status}</span>;
}

function groupBillsByWorkOrder(billList) {
  const map = new Map();
  for (const bill of billList) {
    if (!map.has(bill.work_order_id)) {
      map.set(bill.work_order_id, {
        workOrderId: bill.work_order_id,
        workOrderTitle: bill.work_order_title,
        workOrderStatus: bill.work_order_status,
        bills: [],
      });
    }
    map.get(bill.work_order_id).bills.push(bill);
  }
  return Array.from(map.values()).map((g) => {
    const pendingCount = g.bills.filter((b) => b.status === "submitted").length;
    const rejectedCount = g.bills.filter((b) => b.status === "rejected").length;
    const approvedCount = g.bills.filter((b) => b.status === "approved").length;
    const totalNonRejectedBilled = g.bills
      .filter((b) => b.status !== "rejected")
      .reduce((sum, b) => sum + Number(b.amount || 0), 0);
    return {
      ...g,
      pendingCount,
      rejectedCount,
      approvedCount,
      totalNonRejectedBilled,
    };
  });
}

function defaultTechInnerTab(group) {
  if (group.rejectedCount > 0) return "rejected";
  if (group.pendingCount > 0) return "submitted";
  return "approved";
}

export default function TechnicianJrExpenses() {
  const { user } = useAuth();
  const { toasts, showToast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectedWo = searchParams.get("wo");

  const [workOrders, setWorkOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [autoApproveCap, setAutoApproveCap] = useState(1500);
  const [maxAutoApprovedPerWo, setMaxAutoApprovedPerWo] = useState(2);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [woScope, setWoScope] = useState("active"); // "active" | "archived"
  const [expandedWos, setExpandedWos] = useState({});
  const [woInnerTab, setWoInnerTab] = useState({});

  const autoOpenedUploadRef = useRef(false);
  const initializedExpandRef = useRef(false);

  // Upload Bill Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [woId, setWoId] = useState(preselectedWo || "");
  const [title, setTitle] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("materials");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [billNumber, setBillNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [showOptional, setShowOptional] = useState(false);
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

    Promise.all([
      api.get("/work-orders"),
      api.get("/expense-bills"),
      api.get("/expense-bills/settings").catch(() => ({
        auto_approve_cap: 1500,
        max_auto_approved_per_wo: 2,
      })),
    ])
      .then(([woList, billList, settings]) => {
        if (cancelled) return;
        const activeWos = (woList || []).filter(
          (wo) =>
            wo.assigned_to_id === user?.user_id &&
            ["inprogress", "review"].includes(wo.status),
        );
        const loadedBills = Array.isArray(billList) ? billList : [];
        setWorkOrders(activeWos);
        setWoId((prev) => {
          if (preselectedWo && activeWos.some((w) => w.work_order_id === preselectedWo)) {
            return preselectedWo;
          }
          if (!prev && activeWos.length > 0) {
            return activeWos[0].work_order_id;
          }
          return prev;
        });
        setBills(loadedBills);
        if (settings && typeof settings.auto_approve_cap === "number") {
          setAutoApproveCap(settings.auto_approve_cap);
        }
        if (settings && typeof settings.max_auto_approved_per_wo === "number") {
          setMaxAutoApprovedPerWo(settings.max_auto_approved_per_wo);
        }
        if (!autoOpenedUploadRef.current && preselectedWo) {
          autoOpenedUploadRef.current = true;
          if (activeWos.some((w) => w.work_order_id === preselectedWo)) {
            setUploadModalOpen(true);
          }
        }
        if (!initializedExpandRef.current && loadedBills.length > 0) {
          initializedExpandRef.current = true;
          const initialExpanded = {};
          for (const b of loadedBills) {
            if (b.work_order_status !== "closed" && (b.status === "submitted" || b.status === "rejected")) {
              initialExpanded[b.work_order_id] = true;
            }
          }
          setExpandedWos(initialExpanded);
        }
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

  const woNonRejected = bills.filter(
    (b) => b.work_order_id === woId && b.status !== "rejected",
  );
  const alreadyBilled = woNonRejected.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const autoApprovedCount = woNonRejected.filter((b) => b.auto_approved === true).length;

  const numericEnteredAmount = Number(amount) || 0;
  const projectedTotal = alreadyBilled + numericEnteredAmount;
  const isOverEstimate = estimatedTotal !== null && projectedTotal > estimatedTotal;

  const willAutoApproveOnSubmit =
    autoApproveCap > 0 &&
    projectedTotal > 0 &&
    projectedTotal <= autoApproveCap &&
    autoApprovedCount < maxAutoApprovedPerWo;

  const autoApproveBannerApplies =
    autoApproveCap > 0 &&
    autoApprovedCount < maxAutoApprovedPerWo &&
    (numericEnteredAmount > 0 ? projectedTotal <= autoApproveCap : alreadyBilled < autoApproveCap);

  const receiptRequired = !willAutoApproveOnSubmit;

  function openUploadModal() {
    setUploadModalOpen(true);
  }

  function closeUploadModal() {
    setUploadModalOpen(false);
    setDraftBillId(null);
  }

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
    if (receiptRequired && selectedFiles.length === 0 && !draftBillId) {
      showToast(
        "Please attach at least one receipt (PDF/JPG/PNG) for bills requiring Finance approval.",
        "error",
      );
      return;
    }

    setSubmitting(true);
    let currentId = draftBillId;
    let createdRecord = null;

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
        createdRecord = await api.post("/expense-bills", payload);
        currentId = createdRecord.expense_bill_id;
        setDraftBillId(currentId);
      }

      if (selectedFiles.length > 0) {
        await api.upload(`/expense-bills/${currentId}/attachments`, "files", selectedFiles);
      }

      const wasAutoApproved = createdRecord?.auto_approved;
      showToast(
        wasAutoApproved
          ? `Minor expense bill auto-approved under ₹${autoApproveCap.toLocaleString("en-IN")} limit!`
          : "Expense bill submitted for Finance verification!",
        "success",
      );
      setDraftBillId(null);
      setTitle("");
      setVendor("");
      setBillNumber("");
      setAmount("");
      setNotes("");
      setShowOptional(false);
      setSelectedFiles([]);
      setUploadModalOpen(false);
      setWoScope("active");
      setExpandedWos((prev) => ({ ...prev, [woId]: true }));
      setWoInnerTab((prev) => ({
        ...prev,
        [woId]: wasAutoApproved ? "approved" : "submitted",
      }));
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
    const totalAttachments = (editingBill.attachments?.length || 0) + editFiles.length;
    if (totalAttachments === 0) {
      showToast("Please attach at least one receipt (PDF/JPG/PNG) before resubmitting.", "error");
      return;
    }

    setEditSubmitting(true);
    const targetWoId = editingBill.work_order_id;
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

      showToast("Bill updated and resubmitted for Finance review!", "success");
      setEditingBill(null);
      setEditFiles([]);
      setWoInnerTab((prev) => ({ ...prev, [targetWoId]: "submitted" }));
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message || "Failed to resubmit bill.", "error");
    } finally {
      setEditSubmitting(false);
    }
  }

  const activeGroups = groupBillsByWorkOrder(
    bills.filter((b) => b.work_order_status !== "closed"),
  );
  const archivedGroups = groupBillsByWorkOrder(
    bills.filter((b) => b.work_order_status === "closed"),
  );
  const visibleGroups = woScope === "active" ? activeGroups : archivedGroups;

  function toggleWoExpand(id) {
    setExpandedWos((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function getActiveInnerTab(group) {
    const counts = {
      submitted: group.pendingCount,
      rejected: group.rejectedCount,
      approved: group.approvedCount,
    };
    const chosen = woInnerTab[group.workOrderId];
    if (chosen && counts[chosen] > 0) {
      return chosen;
    }
    return defaultTechInnerTab(group);
  }

  function renderGroupStatusBadge(group) {
    if (group.rejectedCount > 0) {
      return <span className="badge-status badge-rejected">Needs Revision</span>;
    }
    if (group.pendingCount > 0) {
      return <span className="badge-status badge-submitted">Pending</span>;
    }
    return <span className="badge-status badge-approved">Approved</span>;
  }

  function renderBillItem(bill) {
    const wasRevoked = bill.status === "rejected" && bill.history?.some((h) => h.action === "revoked");
    const isClosed = bill.work_order_status === "closed";

    return (
      <div key={bill.expense_bill_id} className="tech-bill-item">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b" }}>
              {bill.title}
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
              {bill.vendor} · {bill.bill_date}
              {bill.bill_number ? ` · #${bill.bill_number}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              ₹{Number(bill.amount).toLocaleString("en-IN")}
            </div>
            <div style={{ marginTop: "4px" }}>{renderBillStatusBadge(bill)}</div>
          </div>
        </div>

        {bill.status === "rejected" && (
          <div style={{ background: "#fef2f2", borderLeft: "4px solid #ef4444", padding: "10px 14px", borderRadius: "4px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#b91c1c" }}>
              {wasRevoked ? "Auto-Approval Revoked by Finance:" : "Revision Requested by Finance:"}
            </div>
            <div style={{ fontSize: "13px", color: "#7f1d1d", marginTop: "2px" }}>
              {bill.rejection_reason}
            </div>
          </div>
        )}

        {bill.attachments && bill.attachments.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
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

        {isClosed ? (
          <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", textAlign: "right" }}>
            Work order closed — archived
          </div>
        ) : (
          bill.status !== "approved" && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
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
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleDeleteBill(bill.expense_bill_id)}
                style={{ padding: "5px 12px", fontSize: "13px", color: "#dc2626" }}
              >
                Delete
              </button>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="tech-expenses-container">
      <ToastStack toasts={toasts} />

      {/* Clean Header Row */}
      <div className="tech-header-row">
        <div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "24px", color: "#0f172a" }}>
            Expense Bills
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            Upload receipts for active work orders.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openUploadModal}
        >
          + Upload Bill
        </button>
      </div>

      {/* Main Bills Card */}
      <div className="tech-expense-card">
        {/* Top-level Active / Archived switcher (2 tabs only) */}
        <div className="tech-filter-tabs">
          <button
            type="button"
            className={`tech-filter-tab ${woScope === "active" ? "active" : ""}`}
            onClick={() => setWoScope("active")}
          >
            Active Work Orders ({activeGroups.length})
          </button>
          <button
            type="button"
            className={`tech-filter-tab ${woScope === "archived" ? "active" : ""}`}
            onClick={() => setWoScope("archived")}
          >
            Archived / Closed ({archivedGroups.length})
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
            Loading expense bills…
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px", textAlign: "center" }}>
            {woScope === "active"
              ? "No bills on active work orders yet."
              : "No archived expense bills from closed work orders."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {visibleGroups.map((group) => {
              const isExpanded = !!expandedWos[group.workOrderId];
              const innerTab = getActiveInnerTab(group);
              const innerBills = group.bills.filter((b) => b.status === innerTab);

              return (
                <div key={group.workOrderId} className="tech-wo-group">
                  <button
                    type="button"
                    className="tech-wo-group-header"
                    onClick={() => toggleWoExpand(group.workOrderId)}
                    aria-expanded={isExpanded}
                  >
                    <div className="tech-wo-group-left">
                      <span className="tech-wo-chevron">{isExpanded ? "▾" : "▸"}</span>
                      <div>
                        <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                          {formatId(group.workOrderId, "WO")} · {group.workOrderTitle}
                        </strong>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {group.bills.length} bill{group.bills.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>

                    <div className="tech-wo-group-right">
                      <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                        ₹{group.totalNonRejectedBilled.toLocaleString("en-IN")}
                      </strong>
                      {renderGroupStatusBadge(group)}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="tech-wo-group-body">
                      {/* Nested Per-WO Inner Status Pills */}
                      <div className="tech-inner-tabs">
                        <button
                          type="button"
                          className={`tech-inner-pill ${innerTab === "submitted" ? "active" : ""}`}
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
                          className={`tech-inner-pill ${innerTab === "rejected" ? "active" : ""} ${
                            group.rejectedCount > 0 ? "pill-alert" : ""
                          }`}
                          onClick={() =>
                            setWoInnerTab((prev) => ({
                              ...prev,
                              [group.workOrderId]: "rejected",
                            }))
                          }
                        >
                          Needs Revision ({group.rejectedCount})
                        </button>
                        <button
                          type="button"
                          className={`tech-inner-pill ${innerTab === "approved" ? "active" : ""}`}
                          onClick={() =>
                            setWoInnerTab((prev) => ({
                              ...prev,
                              [group.workOrderId]: "approved",
                            }))
                          }
                        >
                          Approved ({group.approvedCount})
                        </button>
                      </div>

                      {innerBills.length === 0 ? (
                        <div style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: "#64748b" }}>
                          No bills in this status for this work order.
                        </div>
                      ) : (
                        innerBills.map((bill) => renderBillItem(bill))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Bill Modal */}
      {uploadModalOpen && (
        <div
          className="fa-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeUploadModal()}
        >
          <div
            className="fa-modal wide"
            role="dialog"
            aria-modal="true"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <h3 className="fa-modal-title">Upload Expense Bill</h3>
            <div className="fa-modal-body">
              {workOrders.length === 0 ? (
                <div className="callout callout--warning">
                  You do not have any In Progress or Review work orders to submit bills against.
                  Closed work orders cannot accept new bills.
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="tech-form-group">
                    <label htmlFor="wo-select">Work Order *</label>
                    <select
                      id="wo-select"
                      value={woId}
                      onChange={(e) => {
                        setWoId(e.target.value);
                        setDraftBillId(null);
                      }}
                      required
                    >
                      <option value="">Select an active work order…</option>
                      {workOrders.map((wo) => (
                        <option key={wo.work_order_id} value={wo.work_order_id}>
                          {formatId(wo.work_order_id, "WO")} · {wo.title} ({wo.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedWo && (
                    <div
                      className={`tech-status-line ${
                        autoApproveBannerApplies ? "tech-status-line--green" : "tech-status-line--amber"
                      }`}
                    >
                      {autoApproveBannerApplies
                        ? `Auto-approved under ₹${autoApproveCap.toLocaleString("en-IN")} limit — receipt optional`
                        : `Needs Finance sign-off — receipt required${isOverEstimate ? " · Over estimate" : ""}`}
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
                      <label htmlFor={fileInputId}>
                        Receipt (PDF / JPG / PNG){receiptRequired ? " *" : ""}
                      </label>
                      <input
                        id={fileInputId}
                        type="file"
                        multiple
                        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
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

                  <div style={{ marginTop: "12px" }}>
                    <button
                      type="button"
                      className="tech-optional-toggle"
                      onClick={() => setShowOptional((s) => !s)}
                    >
                      {showOptional ? "▾ Hide optional Bill # & Notes" : "▸ Add optional Bill # & Notes"}
                    </button>

                    {showOptional && (
                      <div className="tech-expense-form-grid" style={{ marginTop: "10px" }}>
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
                          <label htmlFor="bill-notes">Notes / Item Details</label>
                          <input
                            id="bill-notes"
                            type="text"
                            placeholder="Optional notes or GST breakdown…"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="fa-modal-actions" style={{ marginTop: "20px" }}>
                    <button
                      type="button"
                      className="fa-modal-cancel"
                      onClick={closeUploadModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="fa-modal-confirm"
                      disabled={submitting}
                    >
                      {submitting ? "Uploading…" : draftBillId ? "Retry Upload" : "Submit Bill"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

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
                <div className="callout callout--warning" style={{ marginBottom: "14px", fontSize: "13px" }}>
                  Resubmitted bills always go to Finance for manual review. At least one receipt attachment is required.
                </div>

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

                <div style={{ marginTop: "16px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                    Current Receipts ({editingBill.attachments?.length || 0}):
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                    {(!editingBill.attachments || editingBill.attachments.length === 0) ? (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>No receipts currently attached.</span>
                    ) : (
                      editingBill.attachments.map((att) => (
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
                      ))
                    )}
                  </div>
                </div>

                <div className="tech-form-group" style={{ marginTop: "16px" }}>
                  <label htmlFor={editFileInputId}>Add Additional / Replacement Receipts *</label>
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
