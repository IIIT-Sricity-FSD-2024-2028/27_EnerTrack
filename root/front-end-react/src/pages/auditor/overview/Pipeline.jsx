/**
 * Pipeline — every engagement in one of four columns by status.
 *
 * Clicking a card opens it on the Audits page. The old page saved the id
 * in localStorage and reloaded with window.location; here the id travels
 * in the router's state instead, and the Audits page reads it with
 * useLocation().
 */
import { useNavigate } from "react-router-dom";
import { PATHS } from "../../../routes";
import Badge from "../components/Badge";
import { formatDate } from "../auditorUtils";

// Each column holds one or more of the backend's audit statuses. The old
// page had a "completed" column, a status the backend no longer has.
const STAGES = [
  { key: "scheduled", label: "Scheduled", statuses: ["scheduled"] },
  { key: "in-progress", label: "In progress", statuses: ["in-progress"] },
  {
    key: "proposal",
    label: "Proposal sent",
    statuses: ["proposed", "changes-requested"],
  },
  { key: "closed", label: "Closed", statuses: ["accepted", "declined"] },
];

export default function Pipeline({ audits, orgName }) {
  const navigate = useNavigate();

  function openAudit(auditId) {
    navigate(PATHS.auditor.audits, { state: { auditId: auditId } });
  }

  return (
    <div className="card">
      <h2>Engagement pipeline</h2>
      <p className="sub">
        Click an engagement to open its survey and recommendations.
      </p>

      <div
        className="pipeline"
        style={{ marginTop: "14px", gridTemplateColumns: "repeat(4, 1fr)" }}
      >
        {STAGES.map((stage) => {
          const inStage = audits.filter((a) =>
            stage.statuses.includes(a.status),
          );

          return (
            <div key={stage.key} className="pipe-col">
              <h4>
                <span>{stage.label}</span>
                <span>{inStage.length}</span>
              </h4>

              {inStage.length === 0 && (
                <p className="muted" style={{ fontSize: "12px" }}>
                  —
                </p>
              )}

              {inStage.map((audit) => (
                <div
                  key={audit.audit_id}
                  className="pipe-card"
                  onClick={() => openAudit(audit.audit_id)}
                >
                  <div className="pc-org">{orgName(audit.organization_id)}</div>
                  {/* Columns with two statuses say which one this is. */}
                  {stage.statuses.length > 1 && <Badge status={audit.status} />}
                  <div className="pc-meta">
                    {(audit.findings || []).length} recommendation(s) ·{" "}
                    {visitText(audit)}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "visited 3 Mar 2026" once the visit happened, else "due 3 Mar 2026". */
function visitText(audit) {
  if (audit.conducted_on) {
    return "visited " + formatDate(audit.conducted_on);
  }
  return "due " + formatDate(audit.scheduled_on);
}
