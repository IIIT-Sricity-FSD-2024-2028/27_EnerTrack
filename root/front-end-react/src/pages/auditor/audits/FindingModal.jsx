/**
 * FindingModal — the add / edit form for one recommendation.
 *
 * `finding` is null when adding. When editing it is the finding being
 * changed, and an extra Status field appears.
 *
 * Replaces openFindingModal() from js/auditor/auditsPage.js. Uses the
 * technician Modal, so it looks like every other popup in the app.
 */
import { useState } from "react";
import api from "../../../api/client";
import Modal from "../../technician/components/Modal";

const SEVERITIES = ["low", "moderate", "high"];
const STATUSES = ["proposed", "accepted", "implemented", "rejected"];

export default function FindingModal({
  audit,
  finding,
  buildings,
  onSaved,
  onClose,
  showToast,
}) {
  // When adding, every field starts empty.
  const [title, setTitle] = useState(finding ? finding.title : "");
  const [category, setCategory] = useState(finding ? finding.category : "");
  const [severity, setSeverity] = useState(finding ? finding.severity : "low");
  const [saving, setSaving] = useState(finding ? finding.est_annual_saving : 0);
  const [capex, setCapex] = useState(finding ? finding.capex : 0);
  const [status, setStatus] = useState(finding ? finding.status : "proposed");
  const [buildingIds, setBuildingIds] = useState(
    finding ? finding.building_ids || [] : [],
  );

  /** Ticks or unticks one building. */
  function toggleBuilding(id) {
    if (buildingIds.includes(id)) {
      setBuildingIds(buildingIds.filter((b) => b !== id));
    } else {
      setBuildingIds([...buildingIds, id]);
    }
  }

  function handleConfirm() {
    // On a problem, show why and keep the popup open with the values intact.
    if (!title.trim()) {
      showToast("A measure needs a title.", "warning");
      return;
    }
    if (buildingIds.length === 0) {
      showToast("Pick at least one building the measure affects.", "warning");
      return;
    }

    const body = {
      title: title.trim(),
      category: category.trim() || "General",
      severity: severity,
      est_annual_saving: Number(saving) || 0,
      capex: Number(capex) || 0,
      building_ids: buildingIds,
    };

    let request;
    if (finding) {
      body.status = status;
      request = api.patch(
        "/energy-audits/" + audit.audit_id + "/findings/" + finding.finding_id,
        body,
      );
    } else {
      request = api.post(
        "/energy-audits/" + audit.audit_id + "/findings",
        body,
      );
    }

    request
      .then((saved) => {
        onSaved(saved);
        if (finding) {
          showToast("Recommendation updated.", "success");
        } else {
          showToast("Recommendation added.", "success");
        }
        onClose();
      })
      .catch((err) => {
        showToast(err.message, "error");
      });
  }

  return (
    <Modal
      title={finding ? "Edit recommendation" : "New recommendation"}
      confirmLabel={finding ? "Save changes" : "Add recommendation"}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="field">
        <label>Measure</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Chiller plant sequencing on return-water temperature"
        />
      </div>

      <div className="grid2">
        <div className="field">
          <label>Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="HVAC, Lighting, Generation…"
          />
        </div>
        <div className="field">
          <label>Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label>Estimated annual saving (₹)</label>
          <input
            type="number"
            min="0"
            value={saving}
            onChange={(e) => setSaving(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Capex (₹)</label>
          <input
            type="number"
            min="0"
            value={capex}
            onChange={(e) => setCapex(e.target.value)}
          />
        </div>
      </div>
      <p className="muted" style={{ fontSize: "11px", margin: "-4px 0 12px" }}>
        Payback is worked out from these two when you leave it to us.
      </p>

      {finding && (
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label>Buildings affected</label>
        <div className="pick-list" style={{ maxHeight: "180px" }}>
          {buildings.length === 0 && (
            <p className="muted" style={{ fontSize: "12px" }}>
              No buildings recorded for this client yet.
            </p>
          )}
          {buildings.map((b) => (
            <label key={b.building_id} className="pick" style={checkboxRow}>
              <input
                type="checkbox"
                checked={buildingIds.includes(b.building_id)}
                onChange={() => toggleBuilding(b.building_id)}
                style={{ width: "auto", margin: 0 }}
              />
              <span>{b.name}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

const checkboxRow = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  cursor: "pointer",
};
