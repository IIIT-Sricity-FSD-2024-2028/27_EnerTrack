/**
 * InvoicePdfModal — shows the PDF attached to an invoice.
 *
 * The file comes from GET /invoices/:id/document. A plain <iframe src> to the
 * API would send no x-role header and be refused, so api.getBlobUrl() fetches
 * it with the headers and returns a temporary "blob:" URL the browser can
 * display. The effect's cleanup function frees that URL when the dialog
 * closes, so the file is not kept in memory.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import Modal from "../components/Modal";

export default function InvoicePdfModal({ invoice, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false; // the dialog was closed before the download finished
    let url = null;

    api
      .getBlobUrl(`/invoices/${invoice.id}/document`)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        url = blobUrl;
        setPdfUrl(blobUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [invoice.id]);

  return (
    <Modal
      title={`Attached PDF — ${invoice.invoiceNumber}`}
      confirmLabel="Close"
      cancelLabel=""
      wide
      onClose={onClose}
    >
      {error ? (
        <p style={{ color: "#dc2626" }}>Could not open the PDF: {error}</p>
      ) : !pdfUrl ? (
        <p>Loading the PDF…</p>
      ) : (
        <>
          <iframe className="fa-pdf-frame" src={pdfUrl} title={`PDF for invoice ${invoice.invoiceNumber}`} />
          <p style={{ marginTop: 8, fontSize: 13 }}>
            {invoice.documentName}{" "}
            <a href={pdfUrl} target="_blank" rel="noreferrer">
              Open in a new tab
            </a>
          </p>
        </>
      )}
    </Modal>
  );
}
