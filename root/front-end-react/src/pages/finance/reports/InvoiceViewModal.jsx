/**
 * InvoiceViewModal — read-only details of an invoice.
 * Also used by the Archives page (it passes archived = true).
 */
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { formatCurrency, formatDate } from "../financeUtils";

export default function InvoiceViewModal({ invoice, archived = false, onClose }) {
  return (
    <Modal
      title={`Invoice ${invoice.invoiceNumber}${archived ? " (Archived)" : ""}`}
      confirmLabel="Close"
      cancelLabel=""
      onClose={onClose}
    >
      <div className="fa-detail-grid">
        <div><strong>Vendor</strong><p>{invoice.vendor}</p></div>
        <div><strong>Amount</strong><p>{formatCurrency(invoice.amount)}</p></div>
        <div><strong>Department</strong><p>{invoice.departmentLabel}</p></div>
        <div><strong>Type</strong><p style={{ textTransform: "capitalize" }}>{invoice.type}</p></div>
        <div><strong>Issued</strong><p>{formatDate(invoice.issuedDate)}</p></div>
        <div><strong>Due Date</strong><p>{formatDate(invoice.dueDate)}</p></div>
        <div><strong>Status</strong><p><Badge status={invoice.status} /></p></div>
        <div><strong>Attached PDF</strong><p>{invoice.documentName ?? "None"}</p></div>
      </div>
    </Modal>
  );
}
