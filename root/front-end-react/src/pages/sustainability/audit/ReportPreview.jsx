/**
 * ReportPreview — "Preview report" for a Finalized wastage report: the
 * detailed report exactly as the occupant will receive it, before the
 * officer sends it. The outcome section is the same <ReportResult> the
 * occupant's report card renders, so what is previewed is what is sent.
 * The dialog's confirm button sends it.
 */
import Modal from "../components/Modal";
import ReportResult from "../../campus/ReportResult";
import { formatDateTime, wastageSummary } from "../../finance/financeUtils";

export default function ReportPreview({ report, busy, onSend, onClose }) {
  const { summary, location } = wastageSummary(report);

  return (
    <Modal
      title="Preview report"
      width={720}
      confirmLabel="Send report to occupant"
      cancelLabel="Close"
      busy={busy}
      onConfirm={onSend}
      onClose={onClose}
    >
      <p style={{ margin: "-6px 0 16px 0", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
        This is what {report.reporterName || "the occupant"} will see once you send it. Nothing has been sent yet.
      </p>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 18px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 8px", marginBottom: 6 }}>
          <strong style={{ fontSize: 14, color: "#111827" }}>{report.type} wastage</strong>
          {location && <span style={{ fontSize: 13, color: "#6b7280" }}>{location}</span>}
        </div>
        <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{summary || "No description provided."}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12, color: "#6b7280" }}>
          <span>{report.priority} priority</span>
          <span>Reported {formatDateTime(report.timestamp, false)}</span>
          <span>WR-{report.shortId}</span>
        </div>

        <ReportResult report={{ ...report, status: "Delivered" }} />
      </div>
    </Modal>
  );
}
