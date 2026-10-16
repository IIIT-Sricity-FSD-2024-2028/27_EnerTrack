/**
 * CampusModal — add or edit a campus.
 *
 * `campus` is null when adding. `orgId` is set on the auditor page, so a
 * new campus is created for the client being audited.
 */
import { useState } from "react";
import api from "../../../api/client";
import Modal from "../../technician/components/Modal";

export default function CampusModal({
  campus,
  orgId,
  onSaved,
  onClose,
  showToast,
}) {
  const [name, setName] = useState(campus ? campus.name : "");
  const [location, setLocation] = useState(campus ? campus.location || "" : "");
  const [budget, setBudget] = useState(campus ? campus.total_budget : 0);
  const [errors, setErrors] = useState({});

  function handleConfirm() {
    const newErrors = {};
    if (name.trim().length < 3) {
      newErrors.name = "Enter a campus name (min 3 chars).";
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
      location: location.trim() || null,
      total_budget: Number(budget),
    };
    if (orgId) {
      body.organization_id = orgId;
    }

    let request;
    if (campus) {
      request = api.patch("/campus/" + campus.campus_id, body);
    } else {
      request = api.post("/campus", body);
    }

    request
      .then((saved) => {
        showToast(campus ? "Campus updated." : "Campus added.", "success");
        onSaved(saved);
      })
      .catch((err) => {
        showToast(err.message, "error");
      });
  }

  return (
    <Modal
      title={campus ? "Edit Campus" : "Add Campus"}
      confirmLabel={campus ? "Save Campus" : "Add Campus"}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="form-grid">
        <div className="form-field full">
          <label htmlFor="campusName">Name</label>
          <input
            id="campusName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Main University Campus"
          />
          <span className="field-error">{errors.name}</span>
        </div>
        <div className="form-field">
          <label htmlFor="campusLocation">Location</label>
          <input
            id="campusLocation"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City Center"
          />
        </div>
        <div className="form-field">
          <label htmlFor="campusBudget">Total Budget</label>
          <input
            id="campusBudget"
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
