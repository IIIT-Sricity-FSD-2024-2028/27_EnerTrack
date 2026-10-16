/**
 * BuildingModal — add or edit a building.
 *
 * `building` is null when adding; the campus picker then starts on the
 * campus selected in the manager.
 */
import { useState } from "react";
import api from "../../../api/client";
import Modal from "../../technician/components/Modal";

export default function BuildingModal({
  building,
  campuses,
  selectedCampusId,
  orgId,
  onSaved,
  onClose,
  showToast,
}) {
  const [name, setName] = useState(building ? building.name : "");
  const [campusId, setCampusId] = useState(
    building ? building.campus_id : selectedCampusId || "",
  );
  const [budget, setBudget] = useState(building ? building.budget || 0 : 0);
  const [errors, setErrors] = useState({});

  function handleConfirm() {
    const newErrors = {};
    if (name.trim().length < 3) {
      newErrors.name = "Enter a building name.";
    }
    if (!campuses.some((c) => c.campus_id === campusId)) {
      newErrors.campus = "Select a valid campus.";
    }
    if (budget === "" || Number(budget) < 0) {
      newErrors.budget = "Enter a valid positive number.";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const body = {
      name: name.trim(),
      campus_id: campusId,
      budget: Number(budget),
    };
    if (orgId) {
      body.organization_id = orgId;
    }

    let request;
    if (building) {
      request = api.patch("/buildings/" + building.building_id, body);
    } else {
      request = api.post("/buildings", body);
    }

    request
      .then((saved) => {
        showToast(
          building ? "Building updated." : "Building added.",
          "success",
        );
        onSaved(saved);
      })
      .catch((err) => {
        showToast(err.message, "error");
      });
  }

  return (
    <Modal
      title={building ? "Edit Building" : "Add Building"}
      confirmLabel={building ? "Save Building" : "Add Building"}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="form-grid">
        <div className="form-field full">
          <label htmlFor="buildingName">Name</label>
          <input
            id="buildingName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Block A - Main Building"
          />
          <span className="field-error">{errors.name}</span>
        </div>
        <div className="form-field">
          <label htmlFor="buildingCampus">Campus</label>
          <select
            id="buildingCampus"
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
          >
            {campuses.map((c) => (
              <option key={c.campus_id} value={c.campus_id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="field-error">{errors.campus}</span>
        </div>
        <div className="form-field">
          <label htmlFor="buildingBudget">Budget</label>
          <input
            id="buildingBudget"
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <span className="field-error">{errors.budget}</span>
        </div>
      </div>
    </Modal>
  );
}
