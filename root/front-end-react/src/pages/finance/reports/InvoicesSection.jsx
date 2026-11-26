/**
 * InvoicesSection — the "Utility Invoices" box on the Reports page:
 * summary tiles, filters, table, and every invoice action
 * (view, add, edit, attach PDF, view PDF, archive, delete).
 * There is no approve step: the Financial Analyst creates the invoice, and
 * marks it Paid (or Overdue) through Edit.
 *
 * The invoices come from the Redux store (invoicesSlice); the Reports page
 * loads them. Saves update the store in place.
 * `modal` remembers which dialog is open: { kind: "edit", invoice }.
 */
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../../auth/useAuth";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useToast } from "../../../ui/useToast";
import { can, formatCurrency, formatDate } from "../financeUtils";
import {
  createInvoice,
  removeInvoice,
  selectInvoiceRows,
  updateInvoice,
} from "../../../store/slices/invoicesSlice";
import AttachDocumentModal from "./AttachDocumentModal";
import InvoiceFormModal from "./InvoiceFormModal";
import InvoicePdfModal from "./InvoicePdfModal";
import InvoiceViewModal from "./InvoiceViewModal";

export default function InvoicesSection({ departments }) {
  const { user } = useAuth();
  const showToast = useToast();
  const dispatch = useDispatch();
  const invoices = useSelector(selectInvoiceRows);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [modal, setModal] = useState(null);

  /** Runs one thunk. Returns true on success, or shows a toast and returns false. */
  async function run(thunk, errorPrefix) {
    try {
      await dispatch(thunk).unwrap();
      return true;
    } catch (err) {
      showToast(`${errorPrefix}: ${err.message}`, "error");
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
    if (!(await run(createInvoice(payload), "Error saving invoice to server"))) return;
    setModal(null);
    showToast(`Invoice ${payload.invoice_number} added.`, "success");
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
    if (!(await run(updateInvoice({ id, changes: payload }), "Error updating invoice"))) return;
    setModal(null);
    showToast("Invoice updated.", "success");
  }

  async function handleArchive(inv) {
    const ok = await run(
      updateInvoice({ id: inv.id, changes: { archived: true } }),
      "Failed to archive invoice",
    );
    if (!ok) return;
    setModal(null);
    showToast(`Invoice ${inv.invoiceNumber} archived.`, "success");
  }

  async function handleDelete(inv) {
    const ok = await run(removeInvoice(inv.id), "Failed to delete invoice");
    setModal(null);
    if (!ok) return;
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
        Add, edit, or delete utility invoices. Mark an invoice Paid through Edit once it has been settled.
      </div>

      <div className="summary-tiles">
        <div className="tile">
          <div className="tile-label">Total Invoice Value</div>
          <div className="tile-value">{formatCurrency(total)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Pending Payment</div>
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
          <option value="paid">Paid</option>
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
                      {inv.documentName && (
                        <button className="action-btn" onClick={() => setModal({ kind: "pdf", invoice: inv })}>View PDF</button>
                      )}
                      {inv.status === "paid" && (
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

      {modal?.kind === "attach" && (
        <AttachDocumentModal invoice={modal.invoice} onClose={() => setModal(null)} />
      )}

      {modal?.kind === "pdf" && <InvoicePdfModal invoice={modal.invoice} onClose={() => setModal(null)} />}

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
