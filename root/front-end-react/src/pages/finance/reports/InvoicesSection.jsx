/**
 * InvoicesSection — the "Utility Invoices" box on the Reports page:
 * summary tiles, filters, table, and every invoice action
 * (view, add, edit, attach PDF, approve, archive, delete).
 *
 * It owns the invoice list in state and loads it with useEffect.
 * `modal` remembers which dialog is open: { kind: "edit", invoice }.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import { useAuth } from "../../../auth/useAuth";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useToast } from "../components/toastContext";
import { loadInvoices, normalizeInvoice, saveLocalFinance } from "../financeApi";
import { can, formatCurrency, formatDate, generateId } from "../financeUtils";
import AttachDocumentModal from "./AttachDocumentModal";
import InvoiceFormModal from "./InvoiceFormModal";
import InvoiceViewModal from "./InvoiceViewModal";

export default function InvoicesSection({ departments }) {
  const { user } = useAuth();
  const showToast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [offline, setOffline] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    loadInvoices()
      .then((result) => {
        setInvoices(result.invoices);
        setOffline(result.offline);
      })
      .catch((error) => showToast(error.message, "error"));
  }, [showToast]);

  /** Puts the new list in state (and in localStorage when offline). */
  function updateList(next) {
    setInvoices(next);
    if (offline) saveLocalFinance("invoices", next);
  }

  /** Calls the API unless offline. Returns false (after a toast) on failure. */
  async function callApi(request, errorPrefix) {
    if (offline) return true;
    try {
      await request();
      return true;
    } catch (error) {
      showToast(`${errorPrefix}: ${error.message}`, "error");
      return false;
    }
  }

  async function handleAdd(form) {
    const payload = {
      invoice_number: form.number.trim(),
      vendor: form.vendor.trim(),
      amount: Number(form.amount),
      department_id: form.dept,
      department_label: form.deptName,
      due_date: form.due,
      issued_date: form.issued,
      type: form.type,
      status: "pending",
      archived: false,
    };
    let created = normalizeInvoice({ ...payload, id: generateId("inv") });
    if (!offline) {
      try {
        const res = await api.post("/invoices", payload);
        created = normalizeInvoice({ ...payload, ...res });
      } catch (error) {
        showToast("Error saving invoice to server: " + error.message, "error");
        return;
      }
    }
    updateList([...invoices, created]);
    setModal(null);
    showToast(`Invoice ${created.invoiceNumber} added.`, "success");
  }

  async function handleEdit(form) {
    const id = modal.invoice.id;
    const payload = {
      invoice_number: form.number.trim(),
      vendor: form.vendor.trim(),
      amount: Number(form.amount),
      department_id: form.dept,
      department_label: form.deptName,
      due_date: form.due,
      type: form.type,
      status: form.status,
    };
    if (!(await callApi(() => api.patch(`/invoices/${id}`, payload), "Error updating invoice"))) return;
    updateList(invoices.map((inv) => (inv.id === id ? normalizeInvoice({ ...inv, ...payload, id }) : inv)));
    setModal(null);
    showToast("Invoice updated.", "success");
  }

  async function handleApprove(inv) {
    const ok = await callApi(
      () => api.patch(`/invoices/${inv.id}`, { status: "approved", approved_by_id: user.user_id }),
      "Failed to approve invoice",
    );
    if (!ok) return;
    updateList(invoices.map((i) => (i.id === inv.id ? { ...i, status: "approved", approvedBy: user.name } : i)));
    setModal(null);
    showToast(`Invoice ${inv.invoiceNumber} approved.`, "success");
  }

  async function handleArchive(inv) {
    const ok = await callApi(() => api.patch(`/invoices/${inv.id}`, { archived: true }), "Failed to archive invoice");
    if (!ok) return;
    updateList(invoices.map((i) => (i.id === inv.id ? { ...i, archived: true } : i)));
    setModal(null);
    showToast(`Invoice ${inv.invoiceNumber} archived.`, "success");
  }

  async function handleDelete(inv) {
    const ok = await callApi(
      () => api.delete(`/invoices/${inv.id}`),
      "Failed to delete invoice",
    );
    setModal(null);
    if (!ok) return;
    updateList(invoices.filter((i) => i.id !== inv.id));
    showToast(`Invoice ${inv.invoiceNumber} deleted.`, "success");
  }

  // ── derived values (recalculated on every render) ──
  const active = invoices.filter((i) => !i.archived);
  const total = active.reduce((sum, i) => sum + i.amount, 0);
  const pendingCount = active.filter((i) => i.status === "pending").length;
  const overdueCount = active.filter((i) => i.status === "overdue").length;
  const visible = active.filter(
    (i) =>
      (statusFilter === "all" || i.status === statusFilter) &&
      (deptFilter === "all" || i.department === deptFilter),
  );
  // Department filter options come from the invoices themselves, so every
  // option matches at least one row.
  const deptOptions = [...new Map(active.map((i) => [i.department, i.departmentLabel])).entries()];
  const otherNumbers = (exceptId) =>
    invoices.filter((i) => i.id !== exceptId).map((i) => i.invoiceNumber);

  const role = user.role;

  return (
    <div className="box">
      <div className="section-title">
        Utility Invoices
        {can(role, "create") && (
          <button className="main-btn" onClick={() => setModal({ kind: "add" })}>+ Add Invoice</button>
        )}
      </div>
      <div className="section-sub">
        Approve, edit, or delete utility invoices. Pending invoices require approval.
      </div>

      <div className="summary-tiles">
        <div className="tile">
          <div className="tile-label">Total Invoice Value</div>
          <div className="tile-value">{formatCurrency(total)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Pending Approval</div>
          <div className="tile-value">{pendingCount}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Overdue</div>
          <div className="tile-value" style={{ color: "#dc2626" }}>{overdueCount}</div>
        </div>
      </div>

      <div className="filter-row">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="all">All Departments</option>
          {deptOptions.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Vendor</th>
              <th>Department</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>
                  No invoices found.
                </td>
              </tr>
            ) : (
              visible.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNumber || "—"}</td>
                  <td>{inv.vendor}</td>
                  <td>{inv.departmentLabel}</td>
                  <td>{formatCurrency(inv.amount)}</td>
                  <td><span className={`tag tag-${inv.type}`}>{inv.type}</span></td>
                  <td>{formatDate(inv.dueDate)}</td>
                  <td><Badge status={inv.status} /></td>
                  <td className="action-cell">
                    <div className="action-row">
                      <button className="action-btn btn-view" onClick={() => setModal({ kind: "view", invoice: inv })}>View</button>
                      {can(role, "edit") && (
                        <button className="action-btn btn-edit" onClick={() => setModal({ kind: "edit", invoice: inv })}>Edit</button>
                      )}
                      {can(role, "edit") && (
                        <button className="action-btn" onClick={() => setModal({ kind: "attach", invoice: inv })}>Attach PDF</button>
                      )}
                      {can(role, "approve") && inv.status === "pending" && (
                        <button className="action-btn btn-approve" onClick={() => setModal({ kind: "approve", invoice: inv })}>Approve</button>
                      )}
                      {inv.status === "approved" && (
                        <button className="action-btn btn-export" onClick={() => setModal({ kind: "archive", invoice: inv })}>Archive</button>
                      )}
                    </div>
                    {can(role, "delete") && (
                      <button className="action-btn btn-delete" onClick={() => setModal({ kind: "delete", invoice: inv })}>Delete</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── dialogs ── */}
      {modal?.kind === "view" && <InvoiceViewModal invoice={modal.invoice} onClose={() => setModal(null)} />}

      {modal?.kind === "add" && (
        <InvoiceFormModal
          departments={departments}
          existingNumbers={otherNumbers(null)}
          onSubmit={handleAdd}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "edit" && (
        <InvoiceFormModal
          invoice={modal.invoice}
          departments={departments}
          existingNumbers={otherNumbers(modal.invoice.id)}
          onSubmit={handleEdit}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "attach" && <AttachDocumentModal invoice={modal.invoice} onClose={() => setModal(null)} />}

      {modal?.kind === "approve" && (
        <Modal title="Approve Invoice" confirmLabel="Approve" onConfirm={() => handleApprove(modal.invoice)} onClose={() => setModal(null)}>
          <p>
            Approve <strong>{modal.invoice.invoiceNumber}</strong> from <strong>{modal.invoice.vendor}</strong> for{" "}
            <strong>{formatCurrency(modal.invoice.amount)}</strong>?
          </p>
        </Modal>
      )}

      {modal?.kind === "archive" && (
        <Modal title="Archive Invoice" confirmLabel="Archive" onConfirm={() => handleArchive(modal.invoice)} onClose={() => setModal(null)}>
          <p>
            Archive invoice <strong>{modal.invoice.invoiceNumber}</strong>? It will be moved to the Archives section.
          </p>
        </Modal>
      )}

      {modal?.kind === "delete" && (
        <Modal title="Delete Invoice" confirmLabel="Delete" danger onConfirm={() => handleDelete(modal.invoice)} onClose={() => setModal(null)}>
          <p>
            Delete invoice <strong>{modal.invoice.invoiceNumber}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
