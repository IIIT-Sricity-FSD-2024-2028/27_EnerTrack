/**
 * Archives — /finance/archives (was finance_archives.html).
 *
 * Three lists of finished work:
 *   1. Financial reports that were archived on the Reports page
 *   2. Utility invoices that were archived on the Reports page
 *   3. Sustainability (wastage) reports the analyst returned with cost figures
 */
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import FinanceLayout from "./components/FinanceLayout";
import ToastProvider from "./components/ToastProvider";
import { useToast } from "./components/toastContext";
import { loadInvoices, loadReports, loadWastageReports } from "./financeApi";
import { sensorTitle, wastageSummary } from "./financeUtils";
import InvoiceViewModal from "./reports/InvoiceViewModal";
import ReportViewModal from "./reports/ReportViewModal";
import overviewCss from "../../styles/finance-analyst/finance_overview.css?inline";
import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";
import archivesCss from "../../styles/finance-analyst/finance_archives.css?inline";

const DONE_STATUSES = ["Returned to SO", "Target Set", "Finalized", "Delivered"];

const STATUS_MAP = {
  "Returned to SO": { label: "Returned to SO", cssClass: "status-target-set" },
  "Target Set": { label: "Target Set by SO", cssClass: "status-target-set" },
  Finalized: { label: "Finalized", cssClass: "status-finalized" },
  Delivered: { label: "Delivered to Visitor", cssClass: "status-finalized" },
  Dismissed: { label: "Dismissed", cssClass: "status-dismissed" },
};

const VIABILITY = {
  viable: { text: "Viable", bg: "#d1fae5", color: "#065f46" },
  marginal: { text: "Marginal", bg: "#fef3c7", color: "#92400e" },
  "not-viable": { text: "Not Viable", bg: "#fee2e2", color: "#b91c1c" },
};

const rupees = (v) => "₹" + Number(v).toLocaleString("en-IN");
const shortDate = (v) =>
  new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const viewButtonStyle = {
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: "#374151",
};

/** Heading with the green count pill. */
function SectionHeading({ title, count, divider = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
        marginTop: divider ? 32 : 24,
        ...(divider ? { paddingTop: 24, borderTop: "1px solid #e5e7eb" } : {}),
      }}
    >
      <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>{title}</h3>
      <span style={{ background: "#059669", color: "white", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
        {count}
      </span>
    </div>
  );
}

function ArchivedReportCard({ report, onView }) {
  const s = VIABILITY[report.status] || VIABILITY.marginal;
  return (
    <div className="ticket-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <strong style={{ fontSize: 14, color: "#111827" }}>{report.title}</strong>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Period: {report.period} &nbsp;|&nbsp; Category:{" "}
            <span style={{ textTransform: "capitalize" }}>{report.category}</span> &nbsp;|&nbsp; Scope: {report.scopeLabel}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ background: s.bg, color: s.color, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            {s.text}
          </span>
          <button style={viewButtonStyle} onClick={onView}>View</button>
        </div>
      </div>
      <div className="ticket-expanded-section">
        <div className="exp-box">
          <h5>Return on Investment</h5>
          <div className="exp-val">{report.roi != null ? report.roi + "%" : "—"}</div>
        </div>
        <div className="exp-box">
          <h5>Net Present Value</h5>
          <div className="exp-val">{report.npv != null ? "₹" + Number(report.npv).toLocaleString() : "—"}</div>
        </div>
      </div>
    </div>
  );
}

function ArchivedInvoiceCard({ invoice, onView }) {
  return (
    <div className="ticket-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <strong style={{ fontSize: 14, color: "#111827" }}>
            {invoice.invoiceNumber} — {invoice.vendor}
          </strong>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Dept: {invoice.departmentLabel} &nbsp;|&nbsp; Type:{" "}
            <span style={{ textTransform: "capitalize" }}>{invoice.type}</span> &nbsp;|&nbsp; Due:{" "}
            {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}
          </div>
        </div>
        <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
              ₹{Number(invoice.amount).toLocaleString()}
            </div>
            <span style={{ color: "#059669", fontSize: 11, fontWeight: 600 }}>
              Approved by {invoice.approvedBy || "Analyst"}
            </span>
          </div>
          <button style={viewButtonStyle} onClick={onView}>View</button>
        </div>
      </div>
    </div>
  );
}

function ArchivedWastageCard({ report: t }) {
  const cfg = STATUS_MAP[t.status] || { label: t.status, cssClass: "status-finalized" };
  const ci = t.costImpact;
  const mt = t.metricTarget;
  const sd = t.systemData || {};
  const { summary, location } = wastageSummary(t);
  const processedAt = t.returnedAt || t.targetSetAt || t.finalizedAt || t.deliveredAt || t.timestamp;

  // Bar widths for the before / after comparison (only when a target is set).
  let bars = null;
  if (sd.baselineValue && sd.readingValue && mt) {
    const target = parseFloat(mt.value) || 0;
    const max = Math.max(sd.readingValue, sd.baselineValue, target) * 1.1;
    const unit = sd.readingUnit || "";
    bars = [
      { label: "Baseline", value: sd.baselineValue, track: "#e5e7eb", fill: "#9ca3af", text: "#6b7280" },
      { label: "Current", value: sd.readingValue, track: "#fecaca", fill: "#dc2626", text: "#dc2626" },
      { label: "Target", value: mt.value, track: "#bbf7d0", fill: "#059669", text: "#059669" },
    ].map((b) => ({ ...b, width: ((parseFloat(b.value) || 0) / max) * 100, unit }));
  }

  return (
    <div className="ticket-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
            <strong style={{ fontSize: 14, color: "var(--dark)" }}>#{t.id}</strong>
            <span style={{ background: "#059669", color: "white", padding: "2px 8px", borderRadius: 4, fontSize: 11, marginLeft: 8 }}>
              {t.type} Wastage
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#374151", margin: "0 0 6px 0", lineHeight: 1.5 }}>{summary}</p>
          <div className="ticket-location">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {location}
          </div>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span className={`ticket-priority p-${t.priority || "Low"}`}>{t.priority || "Low"} Priority</span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>Processed {processedAt ? shortDate(processedAt) : ""}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <span className={`ticket-status ${cfg.cssClass}`}>{cfg.label}</span>
        </div>
      </div>

      <div className="ticket-expanded-section">
        {ci && (
          <div className="exp-box">
            <h5>Financial Impact Assessment</h5>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div><div className="exp-sub">Est. Loss</div><div className="exp-val" style={{ color: "#dc2626" }}>{rupees(ci.estimatedLoss)}</div></div>
              <div><div className="exp-sub">Remediation</div><div className="exp-val">{rupees(ci.remediationCost)}</div></div>
              <div><div className="exp-sub">Savings</div><div className="exp-val" style={{ color: "#059669" }}>{rupees(ci.projectedSavings)}</div></div>
            </div>
          </div>
        )}
        {mt && (
          <div className="exp-box">
            <h5>Sustainability Target</h5>
            <div className="exp-val" style={{ color: "#1e40af" }}>
              {mt.value} <small style={{ fontSize: 11, fontWeight: 400 }}>{mt.unit}</small>
            </div>
            <div className="exp-sub">Deadline: {shortDate(mt.deadline)}</div>
          </div>
        )}
        {sd.sensorId && (
          <div className="exp-box">
            <h5>{sensorTitle(t.type)} ({sd.sensorId})</h5>
            <div style={{ display: "flex", gap: 12 }}>
              <div><div className="exp-sub">Current</div><div className="exp-val">{sd.readingValue || "—"} <small style={{ fontSize: 11 }}>{sd.readingUnit || ""}</small></div></div>
              <div><div className="exp-sub">Baseline</div><div className="exp-val" style={{ color: "#6b7280" }}>{sd.baselineValue || "—"} <small style={{ fontSize: 11 }}>{sd.readingUnit || ""}</small></div></div>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 14, marginTop: 12 }}>
        <h5 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "#065f46", margin: "0 0 8px 0" }}>
          Decision Summary
        </h5>
        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 6px 0" }}>
            Finance completed cost impact assessment for this {String(t.type).toLowerCase()} wastage report.
          </p>
          {ci && (
            <>
              <p style={{ margin: "0 0 6px 0" }}>
                Estimated loss <strong style={{ color: "#dc2626" }}>{rupees(ci.estimatedLoss)}</strong>, remediation cost{" "}
                <strong>{rupees(ci.remediationCost)}</strong>, projected savings{" "}
                <strong style={{ color: "#059669" }}>{rupees(ci.projectedSavings)}</strong>.
              </p>
              <p style={{ margin: "0 0 6px 0" }}>
                ROI: <strong>{ci.roi != null ? Number(ci.roi).toFixed(1) + "%" : "—"}</strong>, Payback:{" "}
                <strong>{ci.paybackPeriod != null ? Number(ci.paybackPeriod).toFixed(1) + " years" : "—"}</strong>.
              </p>
            </>
          )}
          {mt && (
            <p style={{ margin: "0 0 6px 0" }}>
              Sustainability later set target <strong style={{ color: "#1e40af" }}>{mt.value} {mt.unit}</strong> by{" "}
              <strong>{shortDate(mt.deadline)}</strong>.
            </p>
          )}
        </div>
      </div>

      {bars && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, marginTop: 12 }}>
          <h5 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "#374151", margin: "0 0 10px 0" }}>
            Before / After Comparison
          </h5>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bars.map((b) => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#6b7280", width: 60 }}>{b.label}</span>
                <div style={{ flex: 1, background: b.track, borderRadius: 4, height: 18, overflow: "hidden" }}>
                  <div style={{ width: `${b.width.toFixed(1)}%`, background: b.fill, height: "100%", borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: b.text, minWidth: 60, textAlign: "right" }}>
                  {b.value} {b.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ArchivesContent() {
  const { user } = useAuth();
  const showToast = useToast();
  const [reports, setReports] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [wastage, setWastage] = useState([]);
  const [viewing, setViewing] = useState(null); // { kind: "report" | "invoice", item }

  useEffect(() => {
    async function load() {
      try {
        const [r, i, w] = await Promise.all([loadReports(), loadInvoices(), loadWastageReports(user)]);
        setReports(r.reports.filter((rep) => rep.archived));
        setInvoices(i.invoices.filter((inv) => inv.archived));
        setWastage(
          w
            .filter((t) => t.costImpact && DONE_STATUSES.includes(t.status))
            .sort(
              (a, b) =>
                new Date(b.returnedAt || b.timestamp) - new Date(a.returnedAt || a.timestamp),
            ),
        );
      } catch (error) {
        showToast(error.message, "error");
      }
    }
    load();
  }, [user, showToast]);

  return (
    <FinanceLayout styles={[overviewCss, sharedCss, archivesCss]}>
      <h1 className="welcome">Archives</h1>
      <div className="sub">Past reports that have been processed and returned to the Sustainability Officer.</div>

      <SectionHeading title="Archived Financial Reports" count={reports.length} />
      {reports.length === 0 ? (
        <div className="empty-state"><p>No archived financial reports.</p></div>
      ) : (
        reports.map((r) => (
          <ArchivedReportCard key={r.id} report={r} onView={() => setViewing({ kind: "report", item: r })} />
        ))
      )}

      <SectionHeading title="Archived Utility Invoices" count={invoices.length} />
      {invoices.length === 0 ? (
        <div className="empty-state"><p>No archived utility invoices.</p></div>
      ) : (
        invoices.map((inv) => (
          <ArchivedInvoiceCard key={inv.id} invoice={inv} onView={() => setViewing({ kind: "invoice", item: inv })} />
        ))
      )}

      <SectionHeading title="Archived Sustainability Reports" count={wastage.length} divider />
      {wastage.length === 0 ? (
        <div className="empty-state">
          <p>No archived reports yet. Reports appear here after cost impact is returned to Sustainability.</p>
        </div>
      ) : (
        wastage.map((t) => <ArchivedWastageCard key={t.id} report={t} />)
      )}

      {viewing?.kind === "report" && (
        <ReportViewModal report={viewing.item} archived onClose={() => setViewing(null)} />
      )}
      {viewing?.kind === "invoice" && (
        <InvoiceViewModal invoice={viewing.item} archived onClose={() => setViewing(null)} />
      )}
    </FinanceLayout>
  );
}

/**
 * The page as App.jsx routes to it. ToastProvider sits here, above the page,
 * so the page's own useToast() calls can reach it.
 */
export default function FinanceArchives() {
  return (
    <ToastProvider>
      <ArchivesContent />
    </ToastProvider>
  );
}
