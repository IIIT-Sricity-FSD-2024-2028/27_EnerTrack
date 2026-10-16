/**
 * DepartmentModal — add or edit a department inside a building.
 *
 * `buildings` is the selected campus's buildings; the picker starts on the
 * building selected in the manager.
 */
import { useState } from "react";
import api from "../../../api/client";
import Modal from "../../technician/components/Modal";
import { formatCurrency } from "../auditorUtils";
import { maxDepartmentBudget } from "./budgetRules";

export default function DepartmentModal({
  department,
  buildings,
  departments,
  selectedBuildingId,
  orgId,
  onSaved,
  onClose,
  showToast,
}) {
  const [name, setName] = useState(department ? department.name : "");
  const [buildingId, setBuildingId] = useState(
    department ? department.building_id : selectedBuildingId || "",
  );
  const [budget, setBudget] = useState(department ? department.budget || 0 : 0);
  const [errors, setErrors] = useState({});

  // The budget has to fit in what the chosen building has left. null when
  // the building has no budget of its own, which sets no limit.
  const maxBudget = maxDepartmentBudget(
    buildings.find((b) => b.building_id === buildingId),
    departments,
    department ? department.department_id : undefined,
  );

  function handleConfirm() {
    const newErrors = {};
    if (name.trim().length < 2) {
      newErrors.name = "Enter a department name.";
    }
    if (!buildingId) {
      newErrors.building = "Select a building.";
    }
    if (budget === "" || Number(budget) < 0) {
      newErrors.budget = "Enter a valid positive number.";
    } else if (maxBudget !== null && Number(budget) > maxBudget) {
      newErrors.budget =
        "The building has only " + formatCurrency(maxBudget) + " unallocated.";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const body = {
      name: name.trim(),
      building_id: buildingId,
      budget: Number(budget),
    };
    if (orgId) {
      body.organization_id = orgId;
    }

    let request;
    if (department) {
      request = api.patch("/departments/" + department.department_id, body);
    } else {
      request = api.post("/departments", body);
    }

    request
      .then((saved) => {
        showToast(
          department ? "Department updated." : "Department added.",
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
      title={department ? "Edit Department" : "Add Department"}
      confirmLabel={department ? "Save Department" : "Add Department"}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="form-grid">
        <div className="form-field full">
          <label htmlFor="deptName">Name</label>
          <input
            id="deptName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Computer Science"
          />
          <span className="field-error">{errors.name}</span>
        </div>
        <div className="form-field">
          <label htmlFor="deptBuilding">Building</label>
          <select
            id="deptBuilding"
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
          >
            {buildings.map((b) => (
              <option key={b.building_id} value={b.building_id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="field-error">{errors.building}</span>
        </div>
        <div className="form-field">
          <label htmlFor="deptBudget">Budget</label>
          <input
            id="deptBudget"
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          {maxBudget !== null && (
            <span className="field-hint">
              Up to {formatCurrency(maxBudget)}
            </span>
          )}
          <span className="field-error">{errors.budget}</span>
        </div>
      </div>
    </Modal>
  );
}
