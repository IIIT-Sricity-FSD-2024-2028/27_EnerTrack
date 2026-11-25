/**
 * Reports — /finance/reports (was finance_reports.html).
 *
 * Four parts, top to bottom:
 *   <ReportsTable>       financial reports (state + handlers live here)
 *   <InvoicesSection>    utility invoices (manages its own state)
 *   <InitiativesSection> approved initiatives: cost, spent, saving, payback
 *   <MetricsCalculator>  ROI / NPV / payback calculator and viability banner
 *
 * Reports and invoices come from the Redux store (financialReportsSlice,
 * invoicesSlice); saves update the store in place.
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../auth/useAuth";
import FinanceLayout from "./components/FinanceLayout";
import ToastProvider from "./components/ToastProvider";
import Modal from "./components/Modal";
import { useToast } from "./components/toastContext";
import { fetchBuildings } from "../../store/slices/buildingsSlice";
import { fetchDepartments } from "../../store/slices/departmentsSlice";
import { selectFinancePlaces } from "../../store/slices/energyCostsSlice";
import {
  createFinancialReport,
  fetchFinancialReports,
  removeFinancialReport,
  selectReportRows,
  updateFinancialReport,
} from "../../store/slices/financialReportsSlice";
import { fetchInvoices } from "../../store/slices/invoicesSlice";
import { fetchUsers } from "../../store/slices/usersSlice";
import { useLiveData } from "../../store/useLiveData";
import InvoicesSection from "./reports/InvoicesSection";
import InitiativesSection from "./reports/InitiativesSection";
import MetricsCalculator from "./reports/MetricsCalculator";
import ReportFormModal from "./reports/ReportFormModal";
import ReportsTable from "./reports/ReportsTable";
import ReportViewModal from "./reports/ReportViewModal";
import reportsCss from "../../styles/finance-analyst/finance_reports.css?inline";
import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";

/** "" → undefined, "18.5" → 18.5 — empty number inputs are left out. */
const toNumber = (value) => (value === "" || value == null ? undefined : Number(value));

// Loaded fresh each time the page opens; no polling. Users give each report
// its author's name; departments and buildings fill the scope dropdowns.
const LOADS = [fetchFinancialReports, fetchInvoices, fetchUsers, fetchDepartments, fetchBuildings];

function ReportsContent() {
  const { user } = useAuth();
  const showToast = useToast();
  const dispatch = useDispatch();
  const reports = useSelector(selectReportRows);
  const places = useSelector(selectFinancePlaces);
  const { error } = useLiveData(LOADS, { intervalMs: 0 });
  const [modal, setModal] = useState(null); // e.g. { kind: "edit", report }

  useEffect(() => {
    if (error) showToast(error, "error");
  }, [error, showToast]);

  /** Runs one thunk. Returns true on success, or shows a toast and returns false. */
  async function run(thunk, errorPrefix) {
    try {
      await dispatch(thunk).unwrap();
      return true;
    } catch (err) {
      showToast(`${errorPrefix}: ${err.message}`, "error");
      return false;
    }
  }

  async function handleAdd(form) {
    const [scopeType, scopeName] = form.scope.split("|");
    const roi = toNumber(form.roi);
    const payload = {
      title: form.title.trim(),
      period: form.period.trim(),
      category: form.category,
      scope: scopeType,
      scope_label: scopeName,
      format: form.format,
      roi: roi != null ? `${roi}%` : undefined, // the backend stores ROI as text
      npv: toNumber(form.npv),
      payback_years: toNumber(form.paybackYears),
      status: form.status,
      notes: form.notes.trim() || undefined,
      generated_by_id: user.user_id,
      archived: false,
    };

    if (!(await run(createFinancialReport(payload), "Error saving report to server"))) return;
    setModal(null);
    showToast(`Report "${payload.title}" created.`, "success");
  }

  async function handleEdit(form) {
    const report = modal.report;
    const roi = toNumber(form.roi);
    const payload = {
      title: form.title.trim(),
      roi: roi != null ? `${roi}%` : undefined,
      npv: toNumber(form.npv),
      payback_years: toNumber(form.paybackYears),
      status: form.status,
      notes: form.notes.trim(),
    };
    const ok = await run(
      updateFinancialReport({ id: report.id, changes: payload }),
      "Error updating report",
    );
    if (!ok) return;
    setModal(null);
    showToast("Report updated.", "success");
  }

  async function handleArchive(report) {
    const ok = await run(
      updateFinancialReport({ id: report.id, changes: { archived: true } }),
      "Failed to archive report",
    );
    if (!ok) return;
    setModal(null);
    showToast(`"${report.title}" archived successfully.`, "success");
  }

  async function handleDelete(report) {
    const ok = await run(removeFinancialReport(report.id), "Failed to delete report");
    setModal(null);
    if (!ok) return;
    showToast("Report deleted.", "success");
  }

  const latestReport = reports[0];

  return (
    <FinanceLayout styles={[reportsCss, sharedCss]}>
      <h1>Financial Reports &amp; Impact</h1>
      <div className="sub">Manage reports, invoices, and financial metrics in a single workflow.</div>

      <ReportsTable
        reports={reports}
        role={user.role}
        onAdd={() => setModal({ kind: "add" })}
        onView={(report) => setModal({ kind: "view", report })}
        onEdit={(report) => setModal({ kind: "edit", report })}
        onArchive={(report) => setModal({ kind: "archive", report })}
        onDelete={(report) => setModal({ kind: "delete", report })}
      />

      <InvoicesSection departments={places.departments} />

      <InitiativesSection />

      <MetricsCalculator latestReport={latestReport} />

      {/* ── dialogs ── */}
      {modal?.kind === "view" && <ReportViewModal report={modal.report} onClose={() => setModal(null)} />}

      {modal?.kind === "add" && (
        <ReportFormModal
          departments={places.departments}
          buildings={places.buildings}
          onSubmit={handleAdd}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "edit" && (
        <ReportFormModal report={modal.report} onSubmit={handleEdit} onClose={() => setModal(null)} />
      )}

      {modal?.kind === "archive" && (
        <Modal title="Archive Report" confirmLabel="Archive" onConfirm={() => handleArchive(modal.report)} onClose={() => setModal(null)}>
          <p>
            Archive <strong>&quot;{modal.report.title}&quot;</strong>? It will be moved to the Archives section.
          </p>
        </Modal>
      )}

      {modal?.kind === "delete" && (
        <Modal title="Delete Report" confirmLabel="Delete" danger onConfirm={() => handleDelete(modal.report)} onClose={() => setModal(null)}>
          <p>
            Delete <strong>&quot;{modal.report.title}&quot;</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </FinanceLayout>
  );
}

/**
 * The page as App.jsx routes to it. ToastProvider sits here, above the page,
 * so the page's own useToast() calls can reach it.
 */
export default function FinanceReports() {
  return (
    <ToastProvider>
      <ReportsContent />
    </ToastProvider>
  );
}
