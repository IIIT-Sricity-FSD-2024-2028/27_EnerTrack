/**
 * MeterModal — add or edit a meter on the selected building.
 *
 * `allMeters` is used to stop two meters sharing the same code.
 */
import { useState } from "react";
import api from "../../../api/client";
import Modal from "../../technician/components/Modal";
import { label } from "../auditorUtils";
import { METER_STATUSES, METER_TYPES } from "./infraConstants";

export default function MeterModal({
  meter,
  buildingId,
  allMeters,
  orgId,
  onSaved,
  onClose,
  showToast,
}) {
  const [code, setCode] = useState(meter ? meter.meter_code : "");
  const [type, setType] = useState(meter ? meter.meter_type : METER_TYPES[0]);
  const [zone, setZone] = useState(meter ? meter.zone || "" : "");
  const [status, setStatus] = useState(
    meter ? meter.status : METER_STATUSES[0],
  );
  const [errors, setErrors] = useState({});

  /** True if another meter already uses this code (ignoring case). */
  function codeTaken(newCode) {
    for (const m of allMeters) {
      const isSameMeter = meter && m.meter_id === meter.meter_id;
      if (
        !isSameMeter &&
        m.meter_code.toLowerCase() === newCode.toLowerCase()
      ) {
        return true;
      }
    }
    return false;
  }

  function handleConfirm() {
    const newErrors = {};
    if (code.trim().length < 3) {
      newErrors.code = "Enter a meter code.";
    } else if (codeTaken(code.trim())) {
      newErrors.code = "Code already exists.";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const body = {
      building_id: meter ? meter.building_id : buildingId,
      meter_code: code.trim().toUpperCase(),
      meter_type: type,
      zone: zone.trim() || null,
      status: status,
    };
    if (orgId) {
      body.organization_id = orgId;
    }

    let request;
    if (meter) {
      request = api.patch("/meters/" + meter.meter_id, body);
    } else {
      request = api.post("/meters", body);
    }

    request
      .then((saved) => {
        showToast(meter ? "Meter updated." : "Meter added.", "success");
        onSaved(saved);
      })
      .catch((err) => {
        showToast(err.message, "error");
      });
  }

  return (
    <Modal
      title={meter ? "Edit Meter" : "Add Meter"}
      confirmLabel={meter ? "Save Meter" : "Add Meter"}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="meterCode">Meter Code</label>
          <input
            id="meterCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ET-A-ELEC-001"
          />
          <span className="field-error">{errors.code}</span>
        </div>
        <div className="form-field">
          <label htmlFor="meterType">Meter Type</label>
          <select
            id="meterType"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {METER_TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="meterZone">Zone</label>
          <input
            id="meterZone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Main LT Panel"
          />
        </div>
        <div className="form-field">
          <label htmlFor="meterStatus">Status</label>
          <select
            id="meterStatus"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {METER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
