/**
 * invoices.js
 * CRUD operations for invoice records.
 * Add, Edit, Delete, Approve, View — all reflected in the UI without page reloads.
 */

import FinanceDB, { persistData } from "../data/mockData.js";
import { showToast, openModal, badgeHTML, formatCurrency, generateId, validateForm, showFieldError, clearAllErrors, formatDate } from "../utils/utils.js";
import { can } from "../utils/utils.js";
import { logActivity } from "./activity.js";

/* ── RENDER LIST ──────────────────────────────────── */

export function renderInvoiceList(filter = {}) {
  const tbody = document.getElementById("invoice-tbody");
  if (!tbody) return;

  let records = [...FinanceDB.invoices];

  // Filter by status
  if (filter.status && filter.status !== "all") {
    records = records.filter(r => r.status === filter.status);
  }
  // Filter by department
  if (filter.department && filter.department !== "all") {
    records = records.filter(r => r.department === filter.department);
  }
  // Exclude archived
  records = records.filter(r => !r.archived);

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#9ca3af;padding:32px">No invoices found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(inv => `
    <tr data-id="${inv.id}">
      <td>${inv.invoiceNumber}</td>
      <td>${inv.vendor}</td>
      <td>${inv.departmentLabel}</td>
      <td>${formatCurrency(inv.amount)}</td>
      <td><span class="tag tag-${inv.type}">${inv.type}</span></td>
      <td>${formatDate(inv.dueDate)}</td>
      <td>${badgeHTML(inv.status)}</td>
      <td class="action-cell">
        <div class="action-row">
          <button class="action-btn btn-view"   onclick="InvoiceModule.viewInvoice('${inv.id}')">View</button>
          ${can("edit")   ? `<button class="action-btn btn-edit"    onclick="InvoiceModule.editInvoice('${inv.id}')">Edit</button>` : ""}
          ${can("approve") && inv.status === "pending" ? `<button class="action-btn btn-approve" onclick="InvoiceModule.approveInvoice('${inv.id}')">Approve</button>` : ""}
          ${inv.status === "approved" ? `<button class="action-btn btn-export" onclick="InvoiceModule.archiveInvoice('${inv.id}')">Archive</button>` : ""}
        </div>
        ${can("delete") ? `<button class="action-btn btn-delete"  onclick="InvoiceModule.deleteInvoice('${inv.id}')">Delete</button>` : ""}
      </td>
    </tr>
  `).join("");
}

/* ── VIEW ─────────────────────────────────────────── */

export function viewInvoice(id) {
  const inv = FinanceDB.invoices.find(i => i.id === id);
  if (!inv) return;

  openModal({
    title: `Invoice ${inv.invoiceNumber}`,
    bodyHTML: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;font-size:14px">
        <div><strong>Vendor</strong><p>${inv.vendor}</p></div>
        <div><strong>Amount</strong><p>${formatCurrency(inv.amount)}</p></div>
        <div><strong>Department</strong><p>${inv.departmentLabel}</p></div>
        <div><strong>Type</strong><p style="text-transform:capitalize">${inv.type}</p></div>
        <div><strong>Issued</strong><p>${formatDate(inv.issuedDate)}</p></div>
        <div><strong>Due Date</strong><p>${formatDate(inv.dueDate)}</p></div>
        <div><strong>Status</strong><p>${badgeHTML(inv.status)}</p></div>
        <div><strong>Approved By</strong><p>${inv.approvedBy ?? "—"}</p></div>
      </div>`,
    confirmLabel: "Close",
    cancelLabel: "",
    onConfirm: () => {}
  });
}

/* ── ADD ──────────────────────────────────────────── */

export function openAddInvoiceModal() {
  if (!can("create")) { showToast("You don't have permission to add invoices.", "error"); return; }

  const deptOptions = FinanceDB.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join("");

  openModal({
    title: "Add Invoice",
    bodyHTML: `
      <form id="invoice-form" novalidate>
        <div class="fm-row">
          <div class="fm-group">
            <label>Invoice Number *</label>
            <input id="fi-number" placeholder="INV-XXXXX" maxlength="20">
          </div>
          <div class="fm-group">
            <label>Vendor *</label>
            <input id="fi-vendor" placeholder="Vendor name">
          </div>
        </div>
        <div class="fm-row">
          <div class="fm-group">
            <label>Amount (₹) *</label>
            <input id="fi-amount" type="number" placeholder="0" min="1">
          </div>
          <div class="fm-group">
            <label>Type *</label>
            <select id="fi-type">
              <option value="">Select type</option>
              <option value="electricity">Electricity</option>
              <option value="gas">Gas</option>
              <option value="water">Water</option>
              <option value="demand">Demand</option>
            </select>
          </div>
        </div>
        <div class="fm-row">
          <div class="fm-group">
            <label>Department *</label>
            <select id="fi-dept">
              <option value="">Select department</option>
              ${deptOptions}
            </select>
          </div>
          <div class="fm-group">
            <label>Issued Date *</label>
            <input id="fi-issued" type="date">
          </div>
        </div>
        <div class="fm-group">
          <label>Due Date *</label>
          <input id="fi-due" type="date">
        </div>
      </form>`,
    confirmLabel: "Add Invoice",
    onConfirm: () => _submitAddInvoice()
  });
}

function _submitAddInvoice() {
  const form = document.getElementById("invoice-form");
  if (!form) return;

  const fields = {
    number:  document.getElementById("fi-number"),
    vendor:  document.getElementById("fi-vendor"),
    amount:  document.getElementById("fi-amount"),
    type:    document.getElementById("fi-type"),
    dept:    document.getElementById("fi-dept"),
    issued:  document.getElementById("fi-issued"),
    due:     document.getElementById("fi-due")
  };

  clearAllErrors(form);
  let valid = true;

  const rules = {
    number: { required: true, pattern: /^INV-\d{4,5}$/, patternMsg: "Invalid invoice number format. Use INV-XXXX or INV-XXXXX." },
    vendor: { required: true, minLength: 2 },
    amount: { required: true, positiveNumber: true },
    type:   { required: true },
    dept:   { required: true },
    issued: { required: true },
    due:    { required: true }
  };

  const data = {};
  for (const [key, el] of Object.entries(fields)) {
    data[key] = el.value;
  }

  const { errors } = validateForm(data, rules);
  for (const [key, msg] of Object.entries(errors)) {
    showFieldError(fields[key], msg);
    valid = false;
  }

  // Cross-field: due date must be after issued date
  if (data.issued && data.due && data.due < data.issued) {
    showFieldError(fields.due, "Due date must be after issued date.");
    errors.due = "Due date must be after issued date.";
    valid = false;
  }

  // Duplicate invoice number check
  if (FinanceDB.invoices.some(i => i.invoiceNumber === data.number)) {
    showFieldError(fields.number, "Invoice number already exists.");
    errors.number = "Invoice number already exists.";
    valid = false;
  }

  if (!valid) {
    return false;
  }

  const dept = FinanceDB.departments.find(d => d.id === data.dept);
  const newInv = {
    id: generateId("inv"),
    invoiceNumber: data.number.trim(),
    vendor: data.vendor.trim(),
    amount: Number(data.amount),
    department: data.dept,
    departmentLabel: dept?.name ?? data.dept,
    dueDate: data.due,
    issuedDate: data.issued,
    status: "pending",
    approvedBy: null,
    type: data.type
  };

  FinanceDB.invoices.push(newInv);
  persistData();
  logActivity("invoice", `Invoice ${newInv.invoiceNumber} added`, `Vendor: ${newInv.vendor}`);
  renderInvoiceList();
  updateInvoiceSummary();
  showToast(`Invoice ${newInv.invoiceNumber} added.`, "success");
}

/* ── EDIT ─────────────────────────────────────────── */

export function editInvoice(id) {
  if (!can("edit")) { showToast("Permission denied.", "error"); return; }
  const inv = FinanceDB.invoices.find(i => i.id === id);
  if (!inv) return;

  const deptOptions = FinanceDB.departments.map(d =>
    `<option value="${d.id}" ${d.id === inv.department ? "selected" : ""}>${d.name}</option>`
  ).join("");

  openModal({
    title: `Edit Invoice ${inv.invoiceNumber}`,
    bodyHTML: `
      <form id="edit-invoice-form" novalidate>
        <div class="fm-row">
          <div class="fm-group">
            <label>Invoice Number *</label>
            <input id="ei-number" value="${inv.invoiceNumber}" maxlength="20">
          </div>
          <div class="fm-group">
            <label>Vendor *</label>
            <input id="ei-vendor" value="${inv.vendor}">
          </div>
        </div>
        <div class="fm-row">
          <div class="fm-group">
            <label>Amount (₹) *</label>
            <input id="ei-amount" type="number" value="${inv.amount}" min="1">
          </div>
          <div class="fm-group">
            <label>Type *</label>
            <select id="ei-type">
              ${["electricity","gas","water","demand"].map(t =>
                `<option value="${t}" ${t === inv.type ? "selected" : ""}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`
              ).join("")}
            </select>
          </div>
        </div>
        <div class="fm-row">
          <div class="fm-group">
            <label>Department *</label>
            <select id="ei-dept">${deptOptions}</select>
          </div>
          <div class="fm-group">
            <label>Due Date *</label>
            <input id="ei-due" type="date" value="${inv.dueDate}">
          </div>
        </div>
        <div class="fm-group">
          <label>Status</label>
          <select id="ei-status">
            ${["pending","approved","overdue"].map(s =>
              `<option value="${s}" ${s === inv.status ? "selected" : ""}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
            ).join("")}
          </select>
        </div>
      </form>`,
    confirmLabel: "Save Changes",
    onConfirm: () => _submitEditInvoice(id)
  });
}

function _submitEditInvoice(id) {
  const form = document.getElementById("edit-invoice-form");
  if (!form) return;

  const fields = {
    number: document.getElementById("ei-number"),
    vendor: document.getElementById("ei-vendor"),
    amount: document.getElementById("ei-amount"),
    type:   document.getElementById("ei-type"),
    dept:   document.getElementById("ei-dept"),
    due:    document.getElementById("ei-due"),
    status: document.getElementById("ei-status")
  };

  clearAllErrors(form);
  let valid = true;

  const rules = {
    number: { required: true, pattern: /^INV-\d{4,5}$/, patternMsg: "Invalid invoice number format. Use INV-XXXX or INV-XXXXX." },
    vendor: { required: true, minLength: 2 },
    amount: { required: true, positiveNumber: true },
    type:   { required: true },
    dept:   { required: true },
    due:    { required: true }
  };

  const data = {};
  for (const [key, el] of Object.entries(fields)) data[key] = el.value;

  const { errors } = validateForm(data, rules);
  for (const [key, msg] of Object.entries(errors)) {
    if (fields[key]) { showFieldError(fields[key], msg); valid = false; }
  }

  // Duplicate check (excluding self)
  if (FinanceDB.invoices.some(i => i.invoiceNumber === data.number && i.id !== id)) {
    showFieldError(fields.number, "Invoice number already exists.");
    errors.number = "Invoice number already exists.";
    valid = false;
  }

  if (!valid) {
    return false;
  }

  const idx = FinanceDB.invoices.findIndex(i => i.id === id);
  const dept = FinanceDB.departments.find(d => d.id === data.dept);
  FinanceDB.invoices[idx] = {
    ...FinanceDB.invoices[idx],
    invoiceNumber:   data.number.trim(),
    vendor:          data.vendor.trim(),
    amount:          Number(data.amount),
    department:      data.dept,
    departmentLabel: dept?.name ?? data.dept,
    dueDate:         data.due,
    type:            data.type,
    status:          data.status
  };

  persistData();
  logActivity("invoice", `Invoice ${data.number} updated`, `Status: ${data.status}`);
  renderInvoiceList();
  updateInvoiceSummary();
  showToast("Invoice updated.", "success");
}

/* ── APPROVE ──────────────────────────────────────── */

export function approveInvoice(id) {
  if (!can("approve")) { showToast("Permission denied.", "error"); return; }
  const inv = FinanceDB.invoices.find(i => i.id === id);
  if (!inv) return;

  openModal({
    title: "Approve Invoice",
    bodyHTML: `<p>Approve <strong>${inv.invoiceNumber}</strong> from <strong>${inv.vendor}</strong> for <strong>${formatCurrency(inv.amount)}</strong>?</p>`,
    confirmLabel: "Approve",
    onConfirm: () => {
      inv.status = "approved";
      inv.approvedBy = window.FinanceDB?.session?.user?.name ?? "Analyst";
      persistData();
      logActivity("invoice", `Invoice ${inv.invoiceNumber} approved`, `Amount: ${formatCurrency(inv.amount)}`);
      renderInvoiceList();
      updateInvoiceSummary();
      showToast(`Invoice ${inv.invoiceNumber} approved.`, "success");
    }
  });
}

/* ── ARCHIVE ──────────────────────────────────────── */

export function archiveInvoice(id) {
  const inv = FinanceDB.invoices.find(i => i.id === id);
  if (!inv) return;

  openModal({
    title: "Archive Invoice",
    bodyHTML: `<p>Archive invoice <strong>${inv.invoiceNumber}</strong>? It will be moved to the Archives section.</p>`,
    confirmLabel: "Archive",
    onConfirm: () => {
      inv.archived = true;
      persistData();
      logActivity("invoice", `Invoice ${inv.invoiceNumber} archived`, `Vendor: ${inv.vendor}`);
      renderInvoiceList();
      updateInvoiceSummary();
      showToast(`Invoice ${inv.invoiceNumber} archived.`, "success");
    }
  });
}

/* ── DELETE ───────────────────────────────────────── */

export function deleteInvoice(id) {
  if (!can("delete")) { showToast("Permission denied.", "error"); return; }
  const inv = FinanceDB.invoices.find(i => i.id === id);
  if (!inv) return;

  openModal({
    title: "Delete Invoice",
    bodyHTML: `<p>Delete invoice <strong>${inv.invoiceNumber}</strong>? This cannot be undone.</p>`,
    confirmLabel: "Delete",
    danger: true,
    onConfirm: () => {
      FinanceDB.invoices = FinanceDB.invoices.filter(i => i.id !== id);
      persistData();
      logActivity("invoice", `Invoice ${inv.invoiceNumber} deleted`, `Vendor: ${inv.vendor}`);
      renderInvoiceList();
      updateInvoiceSummary();
      showToast(`Invoice ${inv.invoiceNumber} deleted.`, "success");
    }
  });
}

/* ── SUMMARY STATS ────────────────────────────────── */

export function updateInvoiceSummary() {
  const all = FinanceDB.invoices.filter(i => !i.archived);
  const total   = all.reduce((s, i) => s + i.amount, 0);
  const pending = all.filter(i => i.status === "pending").length;
  const overdue = all.filter(i => i.status === "overdue").length;

  _setText("inv-total",   formatCurrency(total));
  _setText("inv-pending", pending);
  _setText("inv-overdue", overdue);
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── EXPORT NAMESPACE ─────────────────────────────── */
const InvoiceModule = { renderInvoiceList, viewInvoice, openAddInvoiceModal, editInvoice, approveInvoice, deleteInvoice, archiveInvoice, updateInvoiceSummary };
window.InvoiceModule = InvoiceModule;
export default InvoiceModule;
