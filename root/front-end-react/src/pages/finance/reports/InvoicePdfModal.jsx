/**
 * InvoicePdfModal — shows the PDF attached to an invoice.
 *
 * The file comes from GET /invoices/:id/document. A plain <iframe src> to the
 * API would send no sign-in token and be refused, so the fetchInvoiceDocumentUrl
 * thunk fetches it with the token and returns a temporary "blob:" URL the
 * browser can display. The URL is UI state, so it is kept here, not in the
 * store; the effect's cleanup function frees it when the dialog closes, so
 * the file is not kept in memory.
 */
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Modal from "../components/Modal";
import { fetchInvoiceDocumentUrl } from "../../../store/slices/invoicesSlice";

export default function InvoicePdfModal({ invoice, onClose }) {
  const dispatch = useDispatch();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false; // the dialog was closed before the download finished
    let url = null;

    dispatch(fetchInvoiceDocumentUrl(invoice.id))
      .unwrap()
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
  }, [dispatch, invoice.id]);

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
