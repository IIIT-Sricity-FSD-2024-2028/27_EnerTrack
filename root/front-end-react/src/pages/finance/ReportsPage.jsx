/**
 * ReportsPage — /finance/reports (was finance_reports.html).
 *
 * Three parts, top to bottom:
 *   <ReportsTable>       financial reports (state + handlers live here)
 *   <InvoicesSection>    utility invoices (manages its own state)
 *   <MetricsCalculator>  ROI / NPV / payback calculator and viability banner
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import FinanceLayout from "./components/FinanceLayout";
import Modal from "./components/Modal";
import { useToast } from "./components/toastContext";
import { loadDepartmentsAndBuildings, loadReports, normalizeReport, saveLocalFinance } from "./financeApi";
import { generateId } from "./financeUtils";
import InvoicesSection from "./reports/InvoicesSection";
import MetricsCalculator from "./reports/MetricsCalculator";
import ReportFormModal from "./reports/ReportFormModal";
import ReportsTable from "./reports/ReportsTable";
import ReportViewModal from "./reports/ReportViewModal";
import reportsCss from "../../styles/finance-analyst/finance_reports.css?inline";
import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";

/** "" → undefined, "18.5" → 18.5 — empty number inputs are left out. */
const toNumber = (value) => (value === "" || value == null ? undefined : Number(value));

export default function ReportsPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const [reports, setReports] = useState([]);
  const [offline, setOffline] = useState(false);
  const [places, setPlaces] = useState({ departments: [], buildings: [] });
  const [modal, setModal] = useState(null); // e.g. { kind: "edit", report }

  // Load the reports and the department/building lists once.
  useEffect(() => {
    loadReports()
      .then((result) => {
        setReports(result.reports);
        setOffline(result.offline);
      })
      .catch((error) => showToast(error.message, "error"));
    loadDepartmentsAndBuildings().then(setPlaces);
  }, [showToast]);

  function updateList(next) {
    setReports(next);
    if (offline) saveLocalFinance("financialReports", next);
  }

  /** Runs an API request (skipped when offline). Returns true on success. */
  async function callApi(request, errorPrefix) {
    if (offline) return true;
    try {
      await request();
      return true;
    } catch (error) {
      showToast(`${errorPrefix}: ${error.message}`, "error");
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

    let created = normalizeReport({ ...payload, id: generateId("rep") });
    if (!offline) {
      try {
        const res = await api.post("/financial-reports", payload);
        created = normalizeReport({ ...payload, ...res });
      } catch (error) {
        showToast("Error saving report to server: " + error.message, "error");
        return;
      }
    }
    created.generatedBy = user.name;
    updateList([created, ...reports]);
    setModal(null);
    showToast(`Report "${created.title}" created.`, "success");
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
    const ok = await callApi(() => api.patch(`/financial-reports/${report.id}`, payload), "Error updating report");
    if (!ok) return;
    const changes = {
      title: payload.title,
      roi: roi ?? null,
      npv: payload.npv ?? null,
      paybackYears: payload.payback_years ?? null,
      status: payload.status,
      notes: payload.notes,
    };
    updateList(reports.map((r) => (r.id === report.id ? { ...r, ...changes } : r)));
    setModal(null);
    showToast("Report updated.", "success");
  }

  async function handleArchive(report) {
    const ok = await callApi(
      () => api.patch(`/financial-reports/${report.id}`, { archived: true }),
      "Failed to archive report",
    );
    if (!ok) return;
    updateList(reports.map((r) => (r.id === report.id ? { ...r, archived: true } : r)));
    setModal(null);
    showToast(`"${report.title}" archived successfully.`, "success");
  }

  async function handleDelete(report) {
    const ok = await callApi(() => api.delete(`/financial-reports/${report.id}`), "Failed to delete report");
    setModal(null);
    if (!ok) return;
    updateList(reports.filter((r) => r.id !== report.id));
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
