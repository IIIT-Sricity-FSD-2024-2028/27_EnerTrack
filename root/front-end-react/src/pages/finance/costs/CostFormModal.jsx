/**
 * CostFormModal — "Add Energy Cost Record" and "Edit Cost Record" dialogs.
 *
 * The add form asks for a period and a scope; choosing "Department" or
 * "Building" shows the matching dropdown (conditional rendering). The edit
 * form only changes the money amounts and the budget.
 */
import { useState } from "react";
import FormField from "../components/FormField";
import Modal from "../components/Modal";
import { PERIOD_RULE, validateForm } from "../financeUtils";

const AMOUNT_RULES = {
  electricity: { required: true, min: 0 },
  gas: { required: true, min: 0 },
  water: { required: true, min: 0 },
  wastewater: { required: true, min: 0 },
  demand: { required: true, min: 0 },
  budget: { required: true, positiveNumber: true },
};

export default function CostFormModal({ record, departments = [], buildings = [], onSubmit, onClose }) {
  const isEdit = Boolean(record);
  const [form, setForm] = useState({
    period: "",
    scopeType: "",
    scopeRef: "",
    electricity: record?.electricity ?? "",
    gas: record?.gas ?? "",
    water: record?.water ?? "",
    wastewater: record?.wastewater ?? (isEdit ? 0 : ""),
    demand: record?.demand ?? "",
    budget: record?.budget ?? "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    // Switching scope type clears the previously chosen department/building.
    if (name === "scopeType") setForm({ ...form, scopeType: value, scopeRef: "" });
    else setForm({ ...form, [name]: value });
  }

  async function handleSave() {
    const rules = isEdit
      ? AMOUNT_RULES
      : { period: PERIOD_RULE, scopeType: { required: true }, ...AMOUNT_RULES };
    const found = validateForm(form, rules);
    if (!isEdit && form.scopeType && !form.scopeRef) {
      found.scopeRef = form.scopeType === "department" ? "Select a department." : "Select a building.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Only the add form picks a scope; the edit form keeps the record's own.
    let scopeLabel;
    if (!isEdit) {
      const list = form.scopeType === "department" ? departments : buildings;
      scopeLabel = list.find((p) => p.id === form.scopeRef)?.name;
    }
    setBusy(true);
    await onSubmit({ ...form, scopeLabel });
    setBusy(false);
  }

  /** A number input for one amount field. */
  const amount = (name, label, min = "0") => (
    <FormField label={label} error={errors[name]}>
      <input name={name} type="number" placeholder="0" min={min} value={form[name]} onChange={handleChange} />
    </FormField>
  );

  return (
    <Modal
      title={isEdit ? `Edit Cost Record — ${record.scopeLabel}` : "Add Energy Cost Record"}
      confirmLabel={isEdit ? "Save Changes" : "Add Record"}
      busy={busy}
      onConfirm={handleSave}
      onClose={onClose}
    >
      {isEdit ? (
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Period: <strong>{record.period}</strong> — Scope: <strong>{record.scopeLabel}</strong>
        </p>
      ) : (
        <>
          <div className="fm-row">
            <FormField label="Period * (YYYY-MM or YYYY-QN)" error={errors.period}>
              <input name="period" placeholder="e.g. 2025-03" value={form.period} onChange={handleChange} />
            </FormField>
            <FormField label="Scope *" error={errors.scopeType}>
              <select name="scopeType" value={form.scopeType} onChange={handleChange}>
                <option value="">Select scope</option>
                <option value="department">Department</option>
                <option value="building">Building</option>
              </select>
            </FormField>
          </div>

          {form.scopeType === "department" && (
            <FormField label="Department *" error={errors.scopeRef}>
              <select name="scopeRef" value={form.scopeRef} onChange={handleChange}>
                <option value="">Choose department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </FormField>
          )}

          {form.scopeType === "building" && (
            <FormField label="Building *" error={errors.scopeRef}>
              <select name="scopeRef" value={form.scopeRef} onChange={handleChange}>
                <option value="">Choose building</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </FormField>
          )}
        </>
      )}

      <div className="fm-row">
        {amount("electricity", "Electricity (₹) *")}
        {amount("gas", "Gas (₹) *")}
      </div>
      <div className="fm-row">
        {amount("water", "Water (₹) *")}
        {amount("wastewater", "Wastewater (₹) *")}
      </div>
      <div className="fm-row">
        {amount("demand", "Demand Charge (₹) *")}
        {amount("budget", "Budget (₹) *", "1")}
      </div>
    </Modal>
  );
}
