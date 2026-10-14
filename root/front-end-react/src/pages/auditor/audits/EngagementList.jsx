/**
 * EngagementList — the clickable list of audits on the left of the
 * Audits page. Styles (.pick-list, .pick, ...) are in platform_shared.css.
 */
import Badge from "../components/Badge";

export default function EngagementList({
  audits,
  selectedId,
  onSelect,
  orgName,
}) {
  return (
    <div className="card">
      <h2>Engagements</h2>
      <p className="sub">Across every client.</p>

      <div className="pick-list" style={{ marginTop: "12px" }}>
        {audits.map((audit) => {
          const findings = audit.findings || [];
          const done = findings.filter(
            (f) => f.status === "implemented",
          ).length;

          let className = "pick";
          if (audit.audit_id === selectedId) {
            className = "pick active";
          }

          return (
            <div
              key={audit.audit_id}
              className={className}
              onClick={() => onSelect(audit.audit_id)}
            >
              <div className="pick-title">
                <span>{orgName(audit.organization_id)}</span>
                <Badge status={audit.status} />
              </div>
              <div className="pick-meta">
                {findings.length} recommendation(s), {done} implemented
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
