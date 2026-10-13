/**
 * AttachDocumentModal — uploads a scanned PDF to an invoice through the
 * backend's multipart POST /invoices/:id/document (PDF only, max 15 MB).
 * A file input cannot be controlled by React, so we keep the chosen File
 * in state from its onChange event instead.
 */
import { useState } from "react";
import api from "../../../api/client";
import Modal from "../components/Modal";
import { useToast } from "../components/toastContext";

export default function AttachDocumentModal({ invoice, onClose }) {
  const showToast = useToast();
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleUpload() {
    if (!file) {
      setError("Choose a PDF file first.");
      return;
    }
    setBusy(true);
    try {
      await api.upload(`/invoices/${invoice.id}/document`, "file", file);
      showToast(`Document attached to ${invoice.invoiceNumber}.`, "success");
      onClose();
    } catch (err) {
      showToast("Failed to attach document: " + err.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Attach Document — ${invoice.invoiceNumber}`}
      confirmLabel="Upload"
      busy={busy}
      onConfirm={handleUpload}
      onClose={onClose}
    >
      <p style={{ marginBottom: 12, color: "#374151" }}>
        Attach a scanned PDF so the approver can review it before signing off.
      </p>
      <input
        type="file"
        accept="application/pdf,.pdf"
        style={{ width: "100%" }}
        onChange={(e) => {
          setFile(e.target.files[0] || null);
          setError("");
        }}
      />
      {error && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{error}</p>}
    </Modal>
  );
}
