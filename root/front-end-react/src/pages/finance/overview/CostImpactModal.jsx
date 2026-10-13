/**
 * CostImpactModal — "Add Cost Impact Assessment" form for a wastage report.
 * A controlled form: every input's value lives in the `form` state.
 * When the user saves, the figures are validated, ROI and payback are
 * calculated, and the result is handed to the parent through onSave().
 */
import { useState } from "react";
import FormField from "../components/FormField";
import Modal from "../components/Modal";
import { useToast } from "../components/toastContext";
import { validateForm } from "../financeUtils";

const RULES = {
  estimatedLoss: { required: true, positiveNumber: true },
  remediationCost: { required: true, positiveNumber: true },
  projectedSavings: { required: true, positiveNumber: true },
};

export default function CostImpactModal({ report, onSave, onClose }) {
  const showToast = useToast();
  const existing = report.costImpact || {};
  const [form, setForm] = useState({
    estimatedLoss: existing.estimatedLoss ?? "",
    remediationCost: existing.remediationCost ?? "",
    projectedSavings: existing.projectedSavings ?? "",
    notes: existing.notes ?? "",
  });
  const [busy, setBusy] = useState(false);

  // One change handler for every input — the input's name says which field.
  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSave() {
    const errors = validateForm(form, RULES);
    if (Object.keys(errors).length > 0) {
      showToast(Object.values(errors)[0], "warning");
      return;
    }

    const loss = parseFloat(form.estimatedLoss);
    const remediation = parseFloat(form.remediationCost);
    const savings = parseFloat(form.projectedSavings);
    const costImpact = {
      estimatedLoss: loss,
      remediationCost: remediation,
      projectedSavings: savings,
      roi: remediation > 0 ? +(((savings - remediation) / remediation) * 100).toFixed(1) : 0,
      paybackPeriod: savings > 0 ? +(remediation / savings).toFixed(2) : 0,
      notes: form.notes.trim(),
      addedBy: "Finance Analyst",
      addedAt: new Date().toISOString(),
    };

    setBusy(true);
    await onSave(costImpact);
    setBusy(false);
  }

  return (
    <Modal
      title="Add Cost Impact Assessment"
      confirmLabel="Save Cost Impact"
      busy={busy}
      onConfirm={handleSave}
      onClose={onClose}
    >
      <div style={{ marginBottom: 6, fontSize: 13, color: "#6b7280" }}>
        Add financial figures for{" "}
        <strong>
          {report.type} Wastage Report #{report.id}
        </strong>
      </div>

      <FormField label="Estimated Financial Loss (₹) *">
        <input type="number" name="estimatedLoss" min="0" step="0.01" placeholder="e.g. 12500"
          value={form.estimatedLoss} onChange={handleChange} />
        <div className="fm-hint">
          The total projected monetary loss if this wastage continues unchecked over a year.
          Include direct resource costs, operational inefficiency, and any regulatory penalties.
        </div>
      </FormField>

      <FormField label="Remediation Cost (₹) *">
        <input type="number" name="remediationCost" min="0" step="0.01" placeholder="e.g. 3200"
          value={form.remediationCost} onChange={handleChange} />
        <div className="fm-hint">
          One-time expenditure required to fix the root cause — e.g. equipment repair, process
          redesign, staff training, or infrastructure upgrades.
        </div>
      </FormField>

      <FormField label="Projected Annual Savings (₹) *">
        <input type="number" name="projectedSavings" min="0" step="0.01" placeholder="e.g. 8400"
          value={form.projectedSavings} onChange={handleChange} />
        <div className="fm-hint">
          Expected yearly savings after remediation. This is the difference between current
          wastage cost and the projected cost after implementing corrective measures.
        </div>
      </FormField>

      <FormField label="Notes (optional)">
        <textarea name="notes" rows="3" placeholder="Any additional context, assumptions, or justification..."
          value={form.notes} onChange={handleChange} />
      </FormField>
    </Modal>
  );
}
