/**
 * Wastage — the Sustainability Officer's wastage page (/sustainability/wastage).
 *
 * Two panels that work together, kept off the Overview so it stays about
 * the campus figures:
 *   - Waste signals: patterns of waste (repeated reports at one place, food
 *     or smoke reports, rising food weigh-ins, meters well above last year).
 *   - Wastage cases: the patterns the officer chose to fix — remedy, Finance
 *     (only when the remedy costs money), target, check, close.
 * Opening a case from a signal, or closing one, refreshes both.
 */
import { useCallback, useState } from "react";
import Toast from "./components/Toast";
import WasteSignals from "./audit/WasteSignals";
import WastageAuditQueue from "./audit/WastageAuditQueue";
import overviewCss from "./overview.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

export default function SustainabilityWastage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="sustainability-overview-page" style={{ width: "100%" }}>
      <style>{overviewCss}</style>
      <style>{sustLayoutCss}</style>

      <Toast toast={toast} onClose={closeToast} />

      <header className="so-header">
        <div>
          <h1>Wastage</h1>
          <p>
            Waste that keeps happening, and the cases you are fixing. One-off waste is handled by General Maintenance and never
            needs you.
          </p>
        </div>
        <div className="so-header-controls">
          <button type="button" className="so-btn so-btn-refresh" onClick={reload}>
            Refresh
          </button>
        </div>
      </header>

      <WasteSignals reloadKey={reloadKey} onChanged={reload} showToast={showToast} />
      <WastageAuditQueue reloadKey={reloadKey} onChanged={reload} showToast={showToast} />
    </div>
  );
}
