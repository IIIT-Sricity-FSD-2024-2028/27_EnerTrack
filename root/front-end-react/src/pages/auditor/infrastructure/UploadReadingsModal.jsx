/**
 * UploadReadingsModal — send a CSV of meter readings for meters that have
 * no automatic sensor feed.
 *
 * Posts to the backend's POST /meter-readings/upload (CSV only, max 10MB).
 */
import { useState } from "react";
import api from "../../../api/client";
import Modal from "../../technician/components/Modal";

export default function UploadReadingsModal({ onClose, showToast }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  function handleConfirm() {
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }

    api
      .upload("/meter-readings/upload", "file", file)
      .then((res) => {
        if (res && res.imported) {
          showToast(
            "Imported " + res.imported + " meter reading(s).",
            "success",
          );
        } else {
          showToast("Meter readings imported.", "success");
        }
        onClose();
      })
      .catch((err) => {
        showToast("Upload failed: " + err.message, "error");
      });
  }

  return (
    <Modal
      title="Bulk Upload Meter Readings"
      confirmLabel="Upload"
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <p style={{ marginBottom: "12px", color: "#374151" }}>
        Upload a CSV for meters without automatic sensor ingestion. Header row:{" "}
        <code>meter_id,value,unit,timestamp</code> (timestamp optional —
        defaults to now).
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files[0] || null)}
      />
      <span className="field-error">{error}</span>
    </Modal>
  );
}
