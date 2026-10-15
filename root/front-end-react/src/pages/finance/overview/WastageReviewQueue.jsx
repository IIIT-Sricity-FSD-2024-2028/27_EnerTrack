/**
 * WastageReviewQueue — "Sustainability Reports — Pending Cost Review".
 *
 * Workflow 2, steps 9–12: the Sustainability Officer forwards a wastage
 * report → the Financial Analyst adds its cost impact → and returns it.
 * This component owns the list (state) and the save logic; each report is
 * drawn by <WastageReportCard>, which reports clicks back through props.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { notifyOnStateChange } from "../../../legacy/notifications";
import { useToast } from "../components/toastContext";
import { loadWastageReports, updateWastageReport } from "../financeApi";
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
    loadWastageReports(user)
      .then(setReports)
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
    notifyOnStateChange({ id: editing.id }, "cost_added", "Finance Analyst");
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
    notifyOnStateChange(report, "returned_to_so", "Finance Analyst");
  }

  async function handleAddComment(report, text) {
    const comment = {
      author: user.name || "Finance Analyst",
      role: "Finance Analyst",
      text,
      timestamp: new Date().toISOString(),
    };
    await saveReport(report, { comments: [...(report.comments || []), comment] });
  }

  // Newest first, only the ones waiting on Finance.
  const actionable = reports
    .filter((r) => ACTIONABLE.includes(r.status))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="box">
      <div className="section-title">
        Sustainability Reports — Pending Cost Review
        <span className="fa-count">{actionable.length > 0 ? `${actionable.length} pending` : ""}</span>
      </div>

      {actionable.length === 0 ? (
        <div className="fa-dashed-empty">No sustainability reports pending cost review.</div>
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
    </div>
  );
}
