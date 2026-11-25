/**
 * WastageReviewQueue — wastage cases waiting for a cost review.
 *
 * The Sustainability Officer sends a case here only when its remedy needs
 * spending (new fittings, sensors, equipment); free fixes never come to
 * Finance. The Financial Analyst adds the cost impact (loss, cost to fix,
 * savings, payback) and returns it, and the officer then sets a target.
 * This component owns the list (state) and the save logic; each report is
 * drawn by <WastageReportCard>, which reports clicks back through props.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../components/toastContext";
import { addWastageComment, loadWastageReports, updateWastageReport } from "../financeApi";
import CostImpactModal from "./CostImpactModal";
import WastageReportCard from "./WastageReportCard";

const ACTIONABLE = ["Forwarded to Finance", "Cost Impact Added"];

export default function WastageReviewQueue() {
  const { user } = useAuth();
  const showToast = useToast();
  const [reports, setReports] = useState([]);
  const [editing, setEditing] = useState(null); // report whose cost impact is being edited
  const [reloadKey, setReloadKey] = useState(0); // bump to reload the list

  useEffect(() => {
    Promise.all([
      loadWastageReports(user),
      // Only used to show who reported each one; optional.
      api.get("/users").catch(() => []),
    ])
      .then(([rows, users]) => {
        const names = {};
        (Array.isArray(users) ? users : []).forEach((u) => {
          if (u.user_id) names[u.user_id] = u.name;
        });
        setReports(
          rows.map((r) => ({
            ...r,
            reporterName: names[r.reporterId] || (r.reporterName !== "Unknown" ? r.reporterName : "Occupant"),
          })),
        );
      })
      .catch((error) => console.error("API Error", error));
  }, [user, reloadKey]);

  // Reload whenever another tab (e.g. the Sustainability Officer) changes
  // the shared local data.
  useEffect(() => {
    function handleStorage(event) {
      if (event.key === "enertrack_universal_v1") setReloadKey((k) => k + 1);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  /**
   * Saves the changes and swaps the updated report into state.
   * Returns null (after an error toast) if the server refuses.
   */
  async function saveReport(report, changes) {
    try {
      const updated = await updateWastageReport(report, changes);
      setReports((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      return updated;
    } catch (error) {
      showToast("Could not save the report: " + error.message, "error");
      return null;
    }
  }

  async function handleSaveCostImpact(costImpact) {
    if (!(await saveReport(editing, { status: "Cost Impact Added", costImpact }))) return;
    showToast("Cost impact saved. Review and return to SO when ready.", "success");
    setEditing(null);
  }

  async function handleReturn(report) {
    if (!report.costImpact) {
      showToast("Please add cost impact figures before returning.", "warning");
      return;
    }
    const saved = await saveReport(report, { status: "Returned to SO", returnedAt: new Date().toISOString() });
    if (!saved) return;
    showToast("Report sent back to Sustainability Officer with cost figures.", "success");
  }

  async function handleAddComment(report, text) {
    try {
      const updated = await addWastageComment(report, { author: user.name || "Finance Analyst", role: "Financial Analyst", text });
      setReports((list) => list.map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      showToast("Could not save the comment: " + error.message, "error");
    }
  }

  // Newest first, only the ones waiting on Finance.
  const actionable = reports
    .filter((r) => ACTIONABLE.includes(r.status))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <section className="fo-panel" aria-labelledby="costReviewTitle">
      <div className="fo-panel-head">
        <div>
          <h2 id="costReviewTitle">Wastage fixes to cost</h2>
          <p>Remedies that need spending. Work out the cost and payback, then return them to the Sustainability Officer.</p>
        </div>
        <span className={actionable.length ? "fo-count has-items" : "fo-count"}>{actionable.length} pending</span>
      </div>

      {actionable.length === 0 ? (
        <div className="fo-empty">Nothing to cost. Only wastage fixes that need spending come here.</div>
      ) : (
        actionable.map((report) => (
          <WastageReportCard
            key={report.id}
            report={report}
            onEditCostImpact={() => setEditing(report)}
            onReturn={() => handleReturn(report)}
            onAddComment={(text) => handleAddComment(report, text)}
          />
        ))
      )}

      {editing && (
        <CostImpactModal
          report={editing}
          onSave={handleSaveCostImpact}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
