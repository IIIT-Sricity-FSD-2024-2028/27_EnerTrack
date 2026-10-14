/**
 * ImpactTable — "Did it work?"
 *
 * For every client who accepted their proposal (and so is now on
 * EnerTrack): their consumption for March–August 2026 against the same
 * months of 2025. Comparing like months cancels out the seasons, so what
 * is left is the change the recommendations made.
 *
 * The old page filtered on status "completed", which the backend no
 * longer has, so this table was always empty there.
 */
import { formatCurrency, formatKwh } from "../auditorUtils";

export default function ImpactTable({ audits, savingsByOrg, orgName }) {
  const signed = audits.filter((a) => a.status === "accepted");

  return (
    <div className="card">
      <h2>Did it work?</h2>
      <p className="sub">
        March–August 2026 against the same months of 2025. Comparing like months
        cancels the seasons, so what is left is the change your recommendations
        made.
      </p>

      <table className="auditor-table" style={{ marginTop: "14px" }}>
        <thead>
          <tr>
            <th>Client</th>
            <th className="num">Measures done</th>
            <th className="num">Last year</th>
            <th className="num">This year</th>
            <th className="num">Change</th>
            <th className="num">Worth</th>
          </tr>
        </thead>
        <tbody>
          {signed.length === 0 && (
            <tr>
              <td colSpan={6} className="muted" style={emptyCell}>
                No client has accepted a proposal yet.
              </td>
            </tr>
          )}

          {signed.map((audit) => (
            <ImpactRow
              key={audit.audit_id}
              audit={audit}
              savings={savingsByOrg[audit.organization_id]}
              orgName={orgName}
            />
          ))}
        </tbody>
      </table>

      <p className="muted" style={{ fontSize: "12px", marginTop: "12px" }}>
        A client that has implemented nothing should read close to flat. That is
        the check that this number tracks the work rather than the calendar.
      </p>
    </div>
  );
}

/** One client's row. */
function ImpactRow({ audit, savings, orgName }) {
  const findings = audit.findings || [];
  const done = findings.filter((f) => f.status === "implemented").length;
  const client = orgName(audit.organization_id);

  // The savings call failed, or the client has under a year of readings.
  if (!savings || !savings.has_comparison) {
    return (
      <tr>
        <td>{client}</td>
        <td className="num">{done}</td>
        <td colSpan={4} className="muted" style={{ fontSize: "12px" }}>
          Not enough history to compare year on year yet.
        </td>
      </tr>
    );
  }

  const improved = savings.saved_kwh > 0;
  let colour = "var(--muted)";
  if (improved) {
    colour = "var(--pos)";
  }

  return (
    <tr>
      <td>{client}</td>
      <td className="num">{done}</td>
      <td className="num">{formatKwh(savings.kwh_year_ago)}</td>
      <td className="num">{formatKwh(savings.kwh)}</td>
      <td className="num" style={{ fontWeight: 700, color: colour }}>
        {savings.change_pct}%
      </td>
      <td className="num" style={{ color: colour }}>
        {improved ? formatCurrency(savings.saved_amount) : "—"}
      </td>
    </tr>
  );
}

const emptyCell = { textAlign: "center", padding: "28px 0" };
