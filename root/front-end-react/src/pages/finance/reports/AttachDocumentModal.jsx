/**
 * AttachDocumentModal — uploads a scanned PDF to an invoice through the
 * backend's multipart POST /invoices/:id/document (PDF only, max 15 MB).
 * A file input cannot be controlled by React, so we keep the chosen File
 * in state from its onChange event instead.
 */
import { useState } from "react";
import { useDispatch } from "react-redux";
import Modal from "../components/Modal";
import { useToast } from "../../../ui/useToast";
import { uploadInvoiceDocument } from "../../../store/slices/invoicesSlice";

export default function AttachDocumentModal({ invoice, onClose }) {
  const showToast = useToast();
  const dispatch = useDispatch();
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
      // The server answers with the updated invoice (now with the file name);
      // the slice stores it, so "View PDF" shows straight away.
      await dispatch(uploadInvoiceDocument({ id: invoice.id, file })).unwrap();
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
