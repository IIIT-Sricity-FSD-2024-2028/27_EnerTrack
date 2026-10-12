/** CostViewModal — read-only details of one energy cost record. */
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { formatCurrency } from "../financeUtils";

export default function CostViewModal({ record, onClose }) {
  return (
    <Modal
      title={`Cost Record — ${record.scopeLabel} (${record.period})`}
      confirmLabel="Close"
      cancelLabel=""
      onClose={onClose}
    >
      <div className="fa-detail-grid">
        <div><strong>Period</strong><p>{record.period}</p></div>
        <div><strong>Scope</strong><p style={{ textTransform: "capitalize" }}>{record.scope}</p></div>
        <div><strong>Reference</strong><p>{record.scopeLabel}</p></div>
        <div><strong>Status</strong><p><Badge status={record.status} /></p></div>
        <div><strong>Electricity</strong><p>{formatCurrency(record.electricity)}</p></div>
        <div><strong>Gas</strong><p>{formatCurrency(record.gas)}</p></div>
        <div><strong>Water</strong><p>{formatCurrency(record.water)}</p></div>
        <div><strong>Wastewater</strong><p>{formatCurrency(record.wastewater || 0)}</p></div>
        <div><strong>Demand</strong><p>{formatCurrency(record.demand)}</p></div>
        <div><strong>Total Cost</strong><p><strong>{formatCurrency(record.total)}</strong></p></div>
        <div><strong>Budget</strong><p>{formatCurrency(record.budget)}</p></div>
        <div>
          <strong>Variance</strong>
          <p style={{ color: record.variance >= 0 ? "#166534" : "#dc2626" }}>
            {record.variance >= 0 ? "+" : ""}
            {formatCurrency(record.variance)}
          </p>
        </div>
      </div>
    </Modal>
  );
}
