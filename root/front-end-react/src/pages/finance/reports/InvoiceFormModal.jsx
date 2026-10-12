/**
 * InvoiceFormModal — "Add Invoice" and "Edit Invoice" dialogs.
 * Controlled form with the same checks as the original: required fields,
 * INV-XXXX number format, due date after issued date, and no duplicate
 * invoice numbers (the list of existing numbers comes in as a prop).
 */
import { useState } from "react";
import FormField from "../components/FormField";
import Modal from "../components/Modal";
import { validateForm } from "../financeUtils";

const TYPES = ["electricity", "gas", "water", "demand"];
const BASE_RULES = {
  number: {
    required: true,
    pattern: /^INV-\d{4,5}$/,
    patternMsg: "Invalid invoice number format. Use INV-XXXX or INV-XXXXX.",
  },
  vendor: { required: true, minLength: 2 },
  amount: { required: true, positiveNumber: true },
  type: { required: true },
  dept: { required: true },
  due: { required: true },
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function InvoiceFormModal({ invoice, departments, existingNumbers, onSubmit, onClose }) {
  const isEdit = Boolean(invoice);
  const matchedDept = isEdit
    ? departments.find((d) => d.id === invoice.department || d.name === invoice.departmentLabel)
    : null;

  const [form, setForm] = useState({
    number: invoice?.invoiceNumber ?? "",
    vendor: invoice?.vendor ?? "",
    amount: invoice?.amount ?? "",
    type: invoice?.type ?? "",
    dept: matchedDept?.id ?? (isEdit ? departments[0]?.id ?? "" : ""),
    issued: "",
    due: (invoice?.dueDate ?? "").slice(0, 10), // <input type="date"> wants YYYY-MM-DD
    status: invoice?.status ?? "pending",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSave() {
    const rules = isEdit ? BASE_RULES : { ...BASE_RULES, issued: { required: true } };
    const found = validateForm(form, rules);

    if (!isEdit && form.issued && form.due && form.due < form.issued) {
      found.due = "Due date must be after issued date.";
    }
    if (existingNumbers.includes(form.number)) {
      found.number = "Invoice number already exists.";
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const dept = departments.find((d) => d.id === form.dept);
    await onSubmit({ ...form, deptName: dept?.name ?? form.dept });
    setBusy(false);
  }

  return (
    <Modal
      title={isEdit ? `Edit Invoice ${invoice.invoiceNumber}` : "Add Invoice"}
      confirmLabel={isEdit ? "Save Changes" : "Add Invoice"}
      busy={busy}
      onConfirm={handleSave}
      onClose={onClose}
    >
      <div className="fm-row">
        <FormField label="Invoice Number *" error={errors.number}>
          <input name="number" placeholder="INV-XXXXX" maxLength="20" value={form.number} onChange={handleChange} />
        </FormField>
        <FormField label="Vendor *" error={errors.vendor}>
          <input name="vendor" placeholder="Vendor name" value={form.vendor} onChange={handleChange} />
        </FormField>
      </div>

      <div className="fm-row">
        <FormField label="Amount (₹) *" error={errors.amount}>
          <input name="amount" type="number" placeholder="0" min="1" value={form.amount} onChange={handleChange} />
        </FormField>
        <FormField label="Type *" error={errors.type}>
          <select name="type" value={form.type} onChange={handleChange}>
            {!isEdit && <option value="">Select type</option>}
            {TYPES.map((t) => (
              <option key={t} value={t}>{capitalize(t)}</option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="fm-row">
        <FormField label="Department *" error={errors.dept}>
          <select name="dept" value={form.dept} onChange={handleChange}>
            {!isEdit && <option value="">Select department</option>}
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </FormField>
        {isEdit ? (
          <FormField label="Due Date *" error={errors.due}>
            <input name="due" type="date" value={form.due} onChange={handleChange} />
          </FormField>
        ) : (
          <FormField label="Issued Date *" error={errors.issued}>
            <input name="issued" type="date" value={form.issued} onChange={handleChange} />
          </FormField>
        )}
      </div>

      {isEdit ? (
        <FormField label="Status">
          <select name="status" value={form.status} onChange={handleChange}>
            {["pending", "approved", "overdue"].map((s) => (
              <option key={s} value={s}>{capitalize(s)}</option>
            ))}
          </select>
        </FormField>
      ) : (
        <FormField label="Due Date *" error={errors.due}>
          <input name="due" type="date" value={form.due} onChange={handleChange} />
        </FormField>
      )}
    </Modal>
  );
}
