/**
 * ImpactTable — "Did it work?"
 *
 * One row per client who accepted their proposal. Each is measured over
 * their own window, from the month after their first measure went in
 * (overview/impact.js), against the same months a year earlier. Comparing
 * like months cancels out the seasons, so what is left is the change the
 * recommendations made.
 *
 * The numbers come from meter readings only, never from how many measures
 * are ticked as done. So a row can honestly say "done, but no drop yet":
 * the readings are the evidence, the ticks are not.
 */
import { formatCurrency, formatKwh } from "../auditorUtils";
import {
  formatPeriod,
  formatPeriodRange,
  hasComparison,
  measurableFrom,
} from "./impact";

export default function ImpactTable({ impact, orgName }) {
  return (
    <div className="card">
      <h2>Did it work?</h2>
      <p className="sub">
        Each client from the month after their first measure went in, against
        the same months a year earlier. Comparing like months cancels the
        seasons, so what is left is the change your recommendations made.
      </p>

      <table className="auditor-table" style={{ marginTop: "14px" }}>
        <thead>
          <tr>
            <th>Client</th>
            <th className="num">Measures done</th>
            <th>Measured</th>
            <th className="num">Last year</th>
            <th className="num">This year</th>
            <th className="num">Change</th>
            <th className="num">Worth</th>
          </tr>
        </thead>
        <tbody>
          {impact.length === 0 && (
            <tr>
              <td colSpan={7} className="muted" style={emptyCell}>
                No client has accepted a proposal yet.
              </td>
            </tr>
          )}

          {impact.map((client) => (
            <ImpactRow
              key={client.organization_id}
              client={client}
              orgName={orgName}
            />
          ))}
        </tbody>
      </table>

      <p className="muted" style={{ fontSize: "12px", marginTop: "12px" }}>
        Figures come from meter readings, not from measures being marked done.
        A client that has implemented nothing has no row figures at all.
      </p>
    </div>
  );
}

/** Why a row has no figures, or null when it has them. */
function pendingReason(client) {
  if (client.done === 0) {
    return "Nothing implemented yet, so there is no saving to measure.";
  }
  if (!client.window) {
    const from = measurableFrom(client);
    return from
      ? `Measurable from ${formatPeriod(from)}, once a full month of readings is in.`
      : "Implementation date not recorded, so the measuring window is unknown.";
  }
  if (!hasComparison(client)) {
    return "Not enough readings yet to compare against the same months last year.";
  }
  return null;
}

/** One client's row. */
function ImpactRow({ client, orgName }) {
  const name = orgName(client.organization_id);
  const reason = pendingReason(client);

  if (reason) {
    return (
      <tr>
        <td>{name}</td>
        <td className="num">{client.done}</td>
        <td colSpan={5} className="muted" style={{ fontSize: "12px" }}>
          {reason}
        </td>
      </tr>
    );
  }

  const savings = client.savings;
  const improved = savings.saved_kwh > 0;
  const colour = improved ? "var(--pos)" : "var(--muted)";

  return (
    <tr>
      <td>{name}</td>
      <td className="num">{client.done}</td>
      <td>{formatPeriodRange(savings.compared_from, savings.compared_to)}</td>
      <td className="num">{formatKwh(savings.kwh_year_ago)}</td>
      <td className="num">{formatKwh(savings.kwh)}</td>
      <td className="num" style={{ fontWeight: 700, color: colour }}>
        {savings.change_pct}%
      </td>
      <td className="num" style={{ color: colour }}>
        {improved ? (
          formatCurrency(savings.saved_amount)
        ) : (
          <span style={{ fontSize: "12px" }}>No drop in readings yet</span>
        )}
      </td>
    </tr>
  );
}

const emptyCell = { textAlign: "center", padding: "28px 0" };
