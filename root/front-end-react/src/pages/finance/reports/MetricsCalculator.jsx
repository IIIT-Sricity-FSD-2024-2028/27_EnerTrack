/**
 * MetricsCalculator — "Calculate Financial Metrics" box, the three metric
 * cards (ROI, NPV, Payback) and the viability banner under them.
 *
 * Before anything is calculated the cards show the latest report's figures
 * (passed in as `latestReport`). After "Calculate Metrics" they show the
 * calculated figures instead, which are kept in the `calculated` state.
 */
import { useState } from "react";
import { useToast } from "../components/toastContext";
import { formatCurrency, statusFromRoi } from "../financeUtils";

const VIABILITY = {
  viable: { text: "Financially Viable — Recommend Expansion", badge: "ROI ≥ Threshold", bg: "#d1fae5", color: "#065f46" },
  marginal: { text: "Marginal Viability — Review Before Proceeding", badge: "ROI Near Threshold", bg: "#fef3c7", color: "#92400e" },
  "not-viable": { text: "Not Viable — Do Not Proceed", badge: "ROI < Threshold", bg: "#fee2e2", color: "#b91c1c" },
};

export default function MetricsCalculator({ latestReport }) {
  const showToast = useToast();
  const [saving, setSaving] = useState("");
  const [budget, setBudget] = useState("");
  const [calculated, setCalculated] = useState(null);

  function handleCalculate() {
    const s = Number(saving);
    const b = Number(budget);
    if (!s || s <= 0) {
      showToast("Enter a valid savings value.", "warning");
      return;
    }
    if (!b || b <= 0) {
      showToast("Enter a valid budget value.", "warning");
      return;
    }
    const roi = Number(((s / b) * 100).toFixed(1));
    setCalculated({
      roi,
      npv: Math.round(s * 3.2 - b), // simplified 3-year NPV, as in the original
      paybackYears: Number((b / s).toFixed(1)),
      status: statusFromRoi(roi),
    });
    showToast("Metrics calculated.", "success");
  }

  // What the cards show: the calculation if there is one, else the latest report.
  const shown = calculated || latestReport;
  const viability = shown ? VIABILITY[shown.status] || VIABILITY.marginal : null;

  return (
    <>
      <div className="box">
        <div className="section-title">Calculate Financial Metrics</div>
        <div className="section-sub">
          Enter projected savings and budget to compute ROI, NPV, and Payback Period.
        </div>
        <div className="calc-row">
          <input type="number" min="1" placeholder="Projected annual savings (₹)" value={saving} onChange={(e) => setSaving(e.target.value)} />
          <input type="number" min="1" placeholder="Project budget (₹)" value={budget} onChange={(e) => setBudget(e.target.value)} />
          <button className="main-btn" onClick={handleCalculate}>Calculate Metrics</button>
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">ROI</div>
            <div className="metric-tag">Return on investment</div>
          </div>
          <div className="metric-value">{shown ? (shown.roi ?? "—") + "%" : "18.5%"}</div>
          <div className="metric-sub">Value returned relative to cost.</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">NPV</div>
            <div className="metric-tag">Net present value</div>
          </div>
          <div className="metric-value">{shown ? formatCurrency(shown.npv) : "₹1,48,320"}</div>
          <div className="metric-sub">Present-day value of future cash flows.</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">Payback Period</div>
            <div className="metric-tag">Recovery time</div>
          </div>
          <div className="metric-value">
            {shown ? (shown.paybackYears != null ? shown.paybackYears + " yrs" : "—") : "2.8 yrs"}
          </div>
          <div className="metric-sub">Time to recover project costs.</div>
        </div>
      </div>

      <div className="result" style={viability ? { background: viability.bg, color: viability.color } : undefined}>
        {viability ? viability.text : "No report data."}
        {viability && <div className="badge badge-success">{viability.badge}</div>}
      </div>
    </>
  );
}
