/**
 * BillAttachmentModal — Shared modal for previewing attachments on expense bills.
 * Supports PDF iframe display and image preview with multi-attachment tabs.
 */
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { fetchFileUrl } from "../store/files";
import Modal from "../pages/finance/components/Modal";

export default function BillAttachmentModal({ bill, initialAttachment, onClose }) {
  const attachments = bill?.attachments || [];
  const [selectedFilename, setSelectedFilename] = useState(
    initialAttachment?.filename || attachments[0]?.filename || "",
  );
  const dispatch = useDispatch();
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentAttachment =
    attachments.find((a) => a.filename === selectedFilename) || attachments[0];

  useEffect(() => {
    if (!currentAttachment) return;

    let cancelled = false;
    let url = null;

    dispatch(fetchFileUrl(currentAttachment.url))
      .unwrap()
      .then((createdBlobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(createdBlobUrl);
          return;
        }
        url = createdBlobUrl;
        setBlobUrl(createdBlobUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load attachment.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [dispatch, currentAttachment]);

  if (!currentAttachment) return null;

  const isPdf = currentAttachment.mime_type === "application/pdf";
  const isImage = currentAttachment.mime_type?.startsWith("image/");

  return (
    <Modal
      title={`Receipt: ${currentAttachment.original_name}`}
      confirmLabel="Close"
      cancelLabel=""
      wide
      onClose={onClose}
    >
      {attachments.length > 1 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {attachments.map((att, idx) => (
            <button
              key={att.filename}
              type="button"
              onClick={() => setSelectedFilename(att.filename)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: selectedFilename === att.filename ? "#0284c7" : "#cbd5e1",
                backgroundColor: selectedFilename === att.filename ? "#e0f2fe" : "#f8fafc",
                color: selectedFilename === att.filename ? "#0369a1" : "#475569",
                fontWeight: selectedFilename === att.filename ? 600 : 400,
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Receipt {idx + 1}: {att.original_name}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <div style={{ color: "#dc2626", padding: "16px", background: "#fef2f2", borderRadius: "6px" }}>
          Could not load the attachment: {error}
        </div>
      ) : loading || !blobUrl ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
          Loading preview…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {isPdf ? (
            <iframe
              src={blobUrl}
              title={currentAttachment.original_name}
              style={{ width: "100%", height: "65vh", border: "1px solid #e2e8f0", borderRadius: "6px" }}
            />
          ) : isImage ? (
            <img
              src={blobUrl}
              alt={currentAttachment.original_name}
              style={{
                maxWidth: "100%",
                maxHeight: "65vh",
                objectFit: "contain",
                borderRadius: "6px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            />
          ) : (
            <div style={{ padding: "32px", textAlign: "center" }}>
              <p>Preview not available for this file type ({currentAttachment.mime_type}).</p>
            </div>
          )}

          <div style={{ marginTop: "12px", width: "100%", display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#64748b" }}>
            <span>
              File: {currentAttachment.original_name} ({(currentAttachment.size / 1024).toFixed(1)} KB)
            </span>
            <a
              href={blobUrl}
              download={currentAttachment.original_name}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#0284c7", textDecoration: "underline" }}
            >
              Open in new tab / Download
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
