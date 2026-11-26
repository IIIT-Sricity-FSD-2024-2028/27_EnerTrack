/**
 * WastageReviewQueue — wastage cases waiting for a cost review.
 *
 * The Sustainability Officer sends a case here only when its remedy needs
 * spending (new fittings, sensors, equipment); free fixes never come to
 * Finance. The Financial Analyst adds the cost impact (loss, cost to fix,
 * savings, payback) and returns it, and the officer then sets a target.
 * This component reads from Redux and dispatches thunks; each report is
 * drawn by <WastageReportCard>, which reports clicks back through props.
 */
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../../auth/useAuth";
import {
  addWastageComment,
  fetchWastageReports,
  selectWastageReviewQueue,
  updateWastageReport,
} from "../../../store/slices/wastageReportsSlice";
import { fetchUsers, selectAllUsers } from "../../../store/slices/usersSlice";
import { useToast } from "../../../ui/useToast";
import CostImpactModal from "./CostImpactModal";
import WastageReportCard from "./WastageReportCard";

export default function WastageReviewQueue() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const showToast = useToast();
  const queue = useSelector(selectWastageReviewQueue);
  const users = useSelector(selectAllUsers);
  const [editing, setEditing] = useState(null); // report whose cost impact is being edited

  useEffect(() => {
    dispatch(fetchWastageReports());
    dispatch(fetchUsers());
  }, [dispatch]);

  const actionable = useMemo(() => {
    const names = {};
    users.forEach((u) => {
      if (u.user_id) names[u.user_id] = u.name;
    });
    return queue.map((r) => ({
      ...r,
      reporterName:
        names[r.reporterId] ||
        (r.reporterName !== "Unknown" ? r.reporterName : "Occupant"),
    }));
  }, [queue, users]);

  /**
   * Saves the changes through Redux.
   * Returns null (after an error toast) if the server refuses.
   */
  async function saveReport(report, changes) {
    try {
      return await dispatch(updateWastageReport({ report, changes })).unwrap();
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
      await dispatch(
        addWastageComment({
          id: report.id,
          author: user.name || "Finance Analyst",
          role: "Financial Analyst",
          text,
        }),
      ).unwrap();
    } catch (error) {
      showToast("Could not save the comment: " + error.message, "error");
    }
  }

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
