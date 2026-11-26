/**
 * WasteOutcomes — "What came of your waste reports", under My Reports.
 *
 * When the same waste keeps being reported (or food and smoke are noted),
 * the Sustainability Officer opens a wastage case for it. A visitor sees the
 * cases that grew out of reports they sent (GET /wastage-reports returns only
 * those), in plain words: what is being done and how it ended. Nothing shows
 * until there is at least one.
 */
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchWastageReports,
  selectAllWastageReports,
} from "../../store/slices/wastageReportsSlice";

/** Where a case is, in an occupant's words. */
function stage(status) {
  const s = String(status || "").toLowerCase();
  if (["open", "pending", "reported", "validated"].includes(s)) return "The officer is working out a fix.";
  if (["forwarded to finance", "cost impact added", "returned to so"].includes(s)) return "A fix is being costed.";
  if (s === "target set") return "A fix is in place and being measured.";
  if (s === "verify target") return "The results are being checked.";
  if (s === "target met") return "It worked: the waste came down.";
  if (s === "target missed") return "The waste didn't come down enough yet; the officer is following it up.";
  if (s === "closed" || s === "delivered" || s === "finalized") return "Done.";
  if (s === "dismissed") return "Looked into; no further action.";
  return "";
}

export default function WasteOutcomes() {
  const dispatch = useDispatch();
  const cases = useSelector(selectAllWastageReports);

  useEffect(() => {
    dispatch(fetchWastageReports());
  }, [dispatch]);

  // Only cases that grew out of reports (older self-filed records are in Archives).
  const shown = cases.filter((c) => (c.source_request_ids || []).length > 0 && !c.details?.archived);
  if (shown.length === 0) return null;

  return (
    <div className="ticket-section">
      <h2>
        What came of your waste reports
        <span className="ticket-count">{shown.length}</span>
      </h2>
      {shown.map((c) => {
        const d = c.details || {};
        const remedy = d.remedy?.description;
        return (
          <div className="ticket-card" key={c.wastage_report_id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "14px", color: "#111827", margin: "0 0 6px 0", lineHeight: 1.5, fontWeight: 600 }}>
                {d.title || `${c.type} waste`}
                {d.location ? ` · ${d.location}` : ""}
              </p>
              <span className="ticket-meta">
                {stage(c.status)}
                {remedy ? ` Fix: ${remedy}.` : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
