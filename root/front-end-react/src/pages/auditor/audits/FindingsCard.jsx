/**
 * FindingsCard — the recommendations written for one audit.
 *
 * A table of every measure, a callout for the saving the client has not
 * claimed yet, and the Add / Edit buttons that open FindingModal.
 */
import { useState } from "react";
import Badge from "../components/Badge";
import FindingModal from "./FindingModal";
import { formatCurrency, formatDate } from "../auditorUtils";

export default function FindingsCard({
  audit,
  buildings,
  onFindingSaved,
  showToast,
}) {
  // Which popup is open: null = none, "new" = adding, or the finding
  // being edited.
  const [editing, setEditing] = useState(null);

  const findings = audit.findings || [];

  let totalSaving = 0;
  let doneCount = 0;
  let outstandingCount = 0;
  let outstandingSaving = 0;
  for (const f of findings) {
    totalSaving += f.est_annual_saving || 0;
    if (f.status === "implemented") {
      doneCount++;
    }
    if (f.status === "proposed" || f.status === "accepted") {
      outstandingCount++;
      outstandingSaving += f.est_annual_saving || 0;
    }
  }

  /** "Main Block, Library" from a list of building ids. */
  function buildingNames(ids) {
    const names = [];
    for (const id of ids || []) {
      const building = buildings.find((b) => b.building_id === id);
      names.push(building ? building.name : id);
    }
    if (names.length === 0) {
      return "—";
    }
    return names.join(", ");
  }

  return (
    <div className="card">
      <div className="header-row">
        <div>
          <h2>Recommendations</h2>
          <p className="sub">
            {findings.length} measure(s), {doneCount} implemented.{" "}
            {formatCurrency(totalSaving)} of estimated annual saving identified.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-dark"
          onClick={() => setEditing("new")}
        >
          + Add recommendation
        </button>
      </div>

      <table className="auditor-table" style={{ marginTop: "14px" }}>
        <thead>
          <tr>
            <th>Measure</th>
            <th>Category</th>
            <th>Severity</th>
            <th className="num">Annual saving</th>
            <th className="num">Capex</th>
            <th className="num">Payback</th>
            <th>Buildings</th>
            <th>Status</th>
            <th>Done</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {findings.length === 0 && (
            <tr>
              <td
                colSpan={10}
                className="muted"
                style={{ textAlign: "center", padding: "28px 0" }}
              >
                No recommendations recorded yet.
              </td>
            </tr>
          )}

          {findings.map((f) => (
            <tr key={f.finding_id}>
              <td style={{ maxWidth: "250px" }}>{f.title}</td>
              <td>{f.category}</td>
              <td>
                <Badge status={f.severity} />
              </td>
              <td className="num">{formatCurrency(f.est_annual_saving)}</td>
              <td className="num">{formatCurrency(f.capex)}</td>
              <td className="num">{f.payback_months || "—"} mo</td>
              <td style={{ fontSize: "12px" }}>
                {buildingNames(f.building_ids)}
              </td>
              <td>
                <Badge status={f.status} />
              </td>
              <td className="nowrap">
                {f.implemented_on ? formatDate(f.implemented_on) : "—"}
              </td>
              <td className="table-actions">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setEditing(f)}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {outstandingCount > 0 && (
        <div className="callout" style={{ marginTop: "16px" }}>
          <strong>{formatCurrency(outstandingSaving)}</strong> of estimated
          annual saving is still on the table across {outstandingCount}{" "}
          measure(s) the client has not carried out.
        </div>
      )}

      {editing && (
        <FindingModal
          audit={audit}
          finding={editing === "new" ? null : editing}
          buildings={buildings}
          onSaved={onFindingSaved}
          onClose={() => setEditing(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
