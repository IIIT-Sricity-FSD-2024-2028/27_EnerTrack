/**
 * OutstandingTable — "Still to be done".
 *
 * Recommendations across every client that are still proposed or accepted:
 * the savings nobody has claimed yet, and what to raise at the next visit.
 */
import Badge from "../components/Badge";
import { formatCurrency } from "../auditorUtils";

export default function OutstandingTable({ audits, orgName }) {
  // Collect the open findings from every audit into one list, remembering
  // which client each one belongs to.
  const rows = [];
  for (const audit of audits) {
    for (const finding of audit.findings || []) {
      if (finding.status === "proposed" || finding.status === "accepted") {
        rows.push({ finding: finding, orgId: audit.organization_id });
      }
    }
  }

  return (
    <div className="card">
      <h2>Still to be done</h2>
      <p className="sub">
        Recommendations no client has carried out yet — the savings sitting
        unclaimed, and the thing worth raising at the next visit.
      </p>

      <table className="auditor-table" style={{ marginTop: "14px" }}>
        <thead>
          <tr>
            <th>Client</th>
            <th>Measure</th>
            <th>Severity</th>
            <th>Status</th>
            <th className="num">Est. annual saving</th>
            <th className="num">Payback</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="muted"
                style={{ textAlign: "center", padding: "28px 0" }}
              >
                Every recommendation has been acted on.
              </td>
            </tr>
          )}

          {rows.map(({ finding, orgId }) => (
            <tr key={finding.finding_id}>
              <td>{orgName(orgId)}</td>
              <td style={{ maxWidth: "300px" }}>{finding.title}</td>
              <td>
                <Badge status={finding.severity} />
              </td>
              <td>
                <Badge status={finding.status} />
              </td>
              <td className="num">
                {formatCurrency(finding.est_annual_saving)}
              </td>
              <td className="num">{finding.payback_months || "—"} mo</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
