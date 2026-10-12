/**
 * ReportFormModal — "Generate New Report" and "Edit Report" dialogs.
 *
 * One controlled form for both: when `report` is given it is the edit form
 * (fewer fields, values filled in), otherwise it is the generate form.
 * On save it validates, and if valid passes the values to onSubmit().
 */
import { useState } from "react";
import FormField from "../components/FormField";
import Modal from "../components/Modal";
import { PERIOD_RULE, validateForm } from "../financeUtils";

const NUMBER_RULES = {
  roi: { positiveNumber: true },
  npv: { positiveNumber: true },
  paybackYears: { positiveNumber: true },
};
const ADD_RULES = {
  title: { required: true, minLength: 4, maxLength: 80 },
  period: PERIOD_RULE,
  category: { required: true },
  scope: { required: true },
  status: { required: true },
  ...NUMBER_RULES,
};
const EDIT_RULES = {
  title: { required: true, minLength: 4, maxLength: 80 },
  status: { required: true },
  ...NUMBER_RULES,
};

export default function ReportFormModal({ report, departments, buildings, onSubmit, onClose }) {
  const isEdit = Boolean(report);
  const [form, setForm] = useState({
    title: report?.title ?? "",
    period: "",
    category: "",
    scope: "",
    format: "PDF",
    roi: report?.roi ?? "",
    npv: report?.npv ?? "",
    paybackYears: report?.paybackYears ?? "",
    status: report?.status ?? "viable",
    notes: report?.notes ?? "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSave() {
    const found = validateForm(form, isEdit ? EDIT_RULES : ADD_RULES);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    await onSubmit(form);
    setBusy(false);
  }

  // Inputs that both versions of the form share.
  const numberFields = (
    <>
      <div className="fm-row">
        <FormField label="ROI (%)" error={errors.roi}>
          <input name="roi" type="number" placeholder="e.g. 18.5" min="0" max="200" value={form.roi} onChange={handleChange} />
        </FormField>
        <FormField label="NPV (₹)" error={errors.npv}>
          <input name="npv" type="number" placeholder="e.g. 148000" min="0" value={form.npv} onChange={handleChange} />
        </FormField>
      </div>
      <div className="fm-row">
        <FormField label={isEdit ? "Payback (years)" : "Payback Period (years)"} error={errors.paybackYears}>
          <input name="paybackYears" type="number" placeholder="e.g. 2.8" min="0" step="0.1" value={form.paybackYears} onChange={handleChange} />
        </FormField>
        <FormField label={isEdit ? "Status *" : "Viability Status *"} error={errors.status}>
          <select name="status" value={form.status} onChange={handleChange}>
            <option value="viable">Viable</option>
            <option value="marginal">Marginal</option>
            <option value="not-viable">{isEdit ? "Not viable" : "Not Viable"}</option>
          </select>
        </FormField>
      </div>
    </>
  );

  return (
    <Modal
      title={isEdit ? "Edit Report" : "Generate New Report"}
      confirmLabel={isEdit ? "Save Changes" : "Generate Report"}
      busy={busy}
      onConfirm={handleSave}
      onClose={onClose}
    >
      <FormField label="Report Title *" error={errors.title}>
        <input name="title" placeholder="e.g. Q1 2025 Energy Report" maxLength="80" value={form.title} onChange={handleChange} />
      </FormField>

      {!isEdit && (
        <>
          <div className="fm-row">
            <FormField label="Period *" error={errors.period}>
              <input name="period" placeholder="e.g. 2025-Q1 or 2025-03" value={form.period} onChange={handleChange} />
            </FormField>
            <FormField label="Category *" error={errors.category}>
              <select name="category" value={form.category} onChange={handleChange}>
                <option value="">Select</option>
                <option value="energy">Energy</option>
                <option value="operations">Operations</option>
              </select>
            </FormField>
          </div>
          <div className="fm-row">
            <FormField label="Scope *" error={errors.scope}>
              {/* value is "type|name", e.g. "department|Computer Science" */}
              <select name="scope" value={form.scope} onChange={handleChange}>
                <option value="">Select scope</option>
                {departments.map((d) => (
                  <option key={d.id} value={`department|${d.name}`}>Dept: {d.name}</option>
                ))}
                {buildings.map((b) => (
                  <option key={b.id} value={`building|${b.name}`}>Building: {b.name}</option>
                ))}
                <option value="campus|Full Campus">Campus: Full Campus</option>
              </select>
            </FormField>
            <FormField label="Format *">
              <select name="format" value={form.format} onChange={handleChange}>
                <option value="PDF">PDF</option>
                <option value="CSV">CSV</option>
              </select>
            </FormField>
          </div>
        </>
      )}

      {numberFields}

      <FormField label="Notes">
        <textarea name="notes" rows={isEdit ? 3 : 2} placeholder="Optional observations..." maxLength="300" value={form.notes} onChange={handleChange} />
      </FormField>
    </Modal>
  );
}
