import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchSustainabilityReports,
  removeSustainabilityReport,
  restateSustainabilityReport,
  selectAllSustainabilityReports,
  selectSustainabilityReportsStatus,
  submitSustainabilityReport,
} from "../../store/slices/sustainabilityReportsSlice";
import {
  fetchInitiatives,
  removeInitiative,
  selectCompletedInitiatives,
  selectInitiativesStatus,
} from "../../store/slices/initiativesSlice";
import {
  fetchBuildings,
  selectAllBuildings,
} from "../../store/slices/buildingsSlice";
import {
  fetchTargets,
  selectAllTargets,
} from "../../store/slices/targetsSlice";
import {
  fetchUsers,
  selectAllUsers,
} from "../../store/slices/usersSlice";
import {
  fetchWastageReports,
  removeWastageReport,
  selectAllWastageReports,
  selectWastageReportsStatus,
} from "../../store/slices/wastageReportsSlice";
import { useAuth } from "../../auth/useAuth";
import overviewCss from "../../styles/sustainability_officer/sust_overview.css?inline";
import sharedCss from "../../styles/sustainability_officer/sust_shared.css?inline";
import sustLayoutCss from "./sustainability.css?inline";
import WastageArchive from "./archives/WastageArchive";
import ReportDocument from "./components/ReportDocument";
import { periodName } from "./periods";
import Toast from "./components/Toast";
import "./archives.css";
import { InitiativeSummary } from "./initiativeShared";
import { normalizeStatus } from "./audit/auditShared";
import { normalizeWastageReport } from "../../store/slices/wastageReportsSlice";
import { reportRef, wastageSummary } from "../finance/financeUtils";

export default function SustainabilityArchives() {
  const { user } = useAuth();
  // The server lets the Sustainability Officer delete only what never ran
  // (a rejected initiative); completed work can only be removed by the
  // Organization Admin.
  const canDeleteInitiative = (init) =>
    user?.role === "Organization Admin" ||
    (user?.role === "Sustainability Officer" && init.status === "rejected");
  // The backend lets only the Organization Admin delete a wastage report.
  const canDeleteWastage = user?.role === "Organization Admin";

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  // The tab lives in the URL (?tab=), so links and the back button land on it.
  const activeTab = ["reports", "initiatives", "wastage"].includes(urlTab)
    ? urlTab
    : "reports";

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const [searchQuery, setSearchQuery] = useState("");
  const dispatch = useDispatch();
  const reports = useSelector(selectAllSustainabilityReports);
  const initiatives = useSelector(selectCompletedInitiatives);
  const buildings = useSelector(selectAllBuildings);
  const targets = useSelector(selectAllTargets);
  const users = useSelector(selectAllUsers);
  const wastageRows = useSelector(selectAllWastageReports);
  const reportsStatus = useSelector(selectSustainabilityReportsStatus);
  const initiativesStatus = useSelector(selectInitiativesStatus);
  const wastageStatus = useSelector(selectWastageReportsStatus);
  const [toast, setToast] = useState(null);
  const loadErrors = [
    reportsStatus === "failed" && "reports",
    initiativesStatus === "failed" && "initiatives",
    wastageStatus === "failed" && "wastage reports",
  ].filter(Boolean);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
  }, []);

  // Load the records for each tab and their display names.
  useEffect(() => {
    dispatch(fetchSustainabilityReports());
    dispatch(fetchInitiatives());
    // The audit page can change case status outside this store.
    dispatch(fetchWastageReports({ force: true }));
    dispatch(fetchUsers());
    dispatch(fetchBuildings());
    dispatch(fetchTargets());
  }, [dispatch]);

  // Normalize finished cases for the archive and resolve reporter names.
  const wastage = useMemo(() => {
    const directory = Object.fromEntries(users.map((entry) => [entry.user_id, entry]));
    return wastageRows
      .map((raw) => {
        const r = normalizeWastageReport(raw, user);
        const reporter = directory[raw.reporter_id];
        return {
          ...r,
          status: normalizeStatus(r.status),
          shortId: reportRef(r.id),
          priority: r.details?.priority || "Medium",
          reporterName:
            reporter?.name ||
            (r.reporterName && r.reporterName !== "Unknown" ? r.reporterName : "Sustainability Officer"),
        };
      })
      .filter(
        (r) =>
          r.status === "Closed" ||
          r.status === "Dismissed" ||
          r.details?.soArchived,
      )
      .sort((x, y) => {
        const at = (r) =>
          r.details?.closedAt || r.details?.deliveredAt || r.details?.dismissedAt || r.details?.soArchivedAt || r.timestamp;
        return String(at(y)).localeCompare(String(at(x)));
      });
  }, [user, users, wastageRows]);

  // Delete a saved report. Removed from the list only once the server
  // has deleted it.
  const handleRemoveReport = async (report) => {
    const reportId = report.report_id || report.id;
    if (!window.confirm(`Delete "${report.title}" permanently? This cannot be undone.`)) return;
    try {
      await dispatch(removeSustainabilityReport(reportId)).unwrap();
      showToast("Report deleted.", "success");
    } catch (err) {
      showToast(err.message || "Could not delete the report.", "error");
    }
  };

  const reportTitles = Object.fromEntries(reports.map((r) => [r.report_id, r.title]));

  // Send a draft to the Organization Admin for approval.
  const handleSubmitReport = async (report) => {
    try {
      await dispatch(submitSustainabilityReport(report.report_id)).unwrap();
      showToast("Sent to the Organization Admin for approval.", "success");
    } catch (err) {
      showToast(err.message || "Could not submit the report.", "error");
    }
  };

  // Correct a published report: a new draft, linked to it; the original stays.
  const handleRestate = async (report) => {
    if (!window.confirm(`Start a corrected version of "${report.title}"? The published report stays as it is.`)) return;
    try {
      await dispatch(restateSustainabilityReport(report.report_id)).unwrap();
      showToast("A corrected draft was created from today's readings.", "success");
    } catch (err) {
      showToast(err.message || "Could not restate the report.", "error");
    }
  };

  // Delete an archived initiative for good.
  const handleRemoveInitiative = async (init) => {
    const initId = init.initiative_id;
    if (!window.confirm(`Delete "${init.title}" permanently? This cannot be undone.`)) return;
    try {
      await dispatch(removeInitiative(initId)).unwrap();
      showToast("Initiative deleted.", "success");
    } catch (err) {
      showToast(err.message || "Could not delete the initiative.", "error");
    }
  };

  // Delete a closed wastage report for good (Organization Admin only).
  const handleDeleteWastage = async (report) => {
    try {
      await dispatch(removeWastageReport(report.id)).unwrap();
      showToast(`WR-${report.shortId} deleted.`, "success");
    } catch (err) {
      showToast(err.message || "Could not delete the report.", "error");
    }
  };

  // Filtered collections based on search
  const filteredReports = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.period && r.period.toLowerCase().includes(q)),
    );
  }, [reports, searchQuery]);

  const filteredInitiatives = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return initiatives;
    return initiatives.filter(
      (i) =>
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.target_reduction && i.target_reduction.toLowerCase().includes(q)),
    );
  }, [initiatives, searchQuery]);

  const filteredWastage = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return wastage;
    return wastage.filter((w) => {
      const { summary, location } = wastageSummary(w);
      return [`WR-${w.shortId}`, w.type, location, summary, w.reporterName]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(q));
    });
  }, [wastage, searchQuery]);

  return (
    <div
      className="sustainability-archives-container"
      style={{ width: "100%", maxWidth: "1400px", margin: "0 auto" }}
    >
      <style>{overviewCss}</style>
      <style>{sharedCss}</style>
      <style>{sustLayoutCss}</style>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <header className="arc-head">
        <h1>Archives</h1>
        <p>Saved reports, archived initiatives and closed wastage cases.</p>
      </header>

      {/* Tabs and search */}
      <div className="arc-bar">
        <div className="arc-tabs" role="tablist" aria-label="Archive sections">
          {[
            { id: "reports", label: "Reports", count: reports.length },
            { id: "initiatives", label: "Initiatives", count: initiatives.length },
            { id: "wastage", label: "Wastage cases", count: wastage.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`arc-tab${activeTab === tab.id ? " is-active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
              <span className="arc-tab__count">{tab.count}</span>
            </button>
          ))}
        </div>

        <label className="arc-search">
          <span className="visually-hidden">Search archives</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search by title or period"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
      </div>

      {loadErrors.length > 0 && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          <strong>Some archives could not be loaded:</strong> {loadErrors.join(", ")}. Those
          sections may look empty; reload the page to try again.
        </div>
      )}

      {/* Reports */}
      {activeTab === "reports" && (
        <div className="arc-list">
          {filteredReports.length === 0 ? (
            <div className="arc-empty">
              {searchQuery ? "No reports match your search." : "No saved reports yet. Build one on the Reports page and save it."}
            </div>
          ) : (
            filteredReports.map((r) => (
              <ReportCard
                key={r.report_id || r.id}
                report={r}
                titles={reportTitles}
                canDelete={(r.status ?? "draft") === "draft" && (user?.role === "Organization Admin" || r.generated_by_id === user?.user_id)}
                onDelete={() => handleRemoveReport(r)}
                onSubmit={() => handleSubmitReport(r)}
                onRestate={() => handleRestate(r)}
              />
            ))
          )}
        </div>
      )}

      {/* Initiatives */}
      {activeTab === "initiatives" && (
        <div className="arc-list">
          {filteredInitiatives.length === 0 ? (
            <div className="arc-empty">
              {searchQuery
                ? "No initiatives match your search."
                : "No archived initiatives. Archive a completed or rejected initiative from the Initiatives board."}
            </div>
          ) : (
            filteredInitiatives.map((i) => {
              const archivedOn = new Date(i.archived_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const isRejected = i.status === "rejected";
              return (
                <article key={i.initiative_id} className="arc-card">
                  <div className="arc-card__head">
                    <div className="arc-card__titles">
                      <h3>{i.title}</h3>
                      <p className="arc-card__meta">
                        <span className="arc-chip">{isRejected ? "Rejected" : "Completed"}</span>
                        <span>Archived on {archivedOn}</span>
                        {i.target_reduction && <span>Target {i.target_reduction}</span>}
                      </p>
                    </div>
                    {canDeleteInitiative(i) && (
                      <div className="arc-card__actions">
                        <button type="button" className="arc-btn arc-btn--danger" onClick={() => handleRemoveInitiative(i)}>
                          Delete initiative
                        </button>
                      </div>
                    )}
                  </div>
                  {/* The full record: work, result and timeline. Money is left out of archives. */}
                  <InitiativeSummary init={i} buildings={buildings} targets={targets} showMoney={false} />
                  {!isRejected && Array.isArray(i.outcomes) && i.outcomes.length > 0 && (
                    <ul className="arc-card__outcomes">
                      {i.outcomes.map((o, idx) => (
                        <li key={idx}>{typeof o === "string" ? o : JSON.stringify(o)}</li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Wastage reports */}
      {activeTab === "wastage" && (
        <WastageArchive
          reports={filteredWastage}
          totalCount={wastage.length}
          canDelete={canDeleteWastage}
          onDelete={handleDeleteWastage}
        />
      )}
    </div>
  );
}

const STATUS_LABEL = {
  draft: "Draft",
  submitted: "Waiting for approval",
  approved: "Approved",
  published: "Published",
};

/** One saved report: its key figures, and the full report on request. */
function ReportCard({ report: r, titles, canDelete, onDelete, onSubmit, onRestate }) {
  const [open, setOpen] = useState(false);
  const metrics = r.metrics || {};
  // Older reports stored only summary figures; newer ones keep the whole
  // snapshot (totals, previous period, data gaps) and can be opened in full.
  const hasSnapshot = !!r.totals;
  // Reports saved before the rename carry carbonOffset; it meant the same.
  const avoided = metrics.avoidedEmissions ?? metrics.carbonOffset;
  const shown = (v) => (v === null ? "Not measured" : v || "—");
  const saved = r.generated_at
    ? new Date(r.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const gaps = Array.isArray(r.data_gaps) ? r.data_gaps.length : 0;
  const docId = `report-${r.report_id}`;

  return (
    <article className="arc-card">
      <div className="arc-card__head">
        <div className="arc-card__titles">
          <h3>{r.title}</h3>
          <p className="arc-card__meta">
            <span>{r.from ? periodName(r.from, r.to) : r.period}</span>
            {saved && <span>Saved {saved}</span>}
            {r.status && <span className="arc-chip">{STATUS_LABEL[r.status] || r.status}</span>}
            {hasSnapshot && (
              <span>{gaps === 0 ? "No data gaps" : `${gaps} data gap${gaps === 1 ? "" : "s"}`}</span>
            )}
          </p>
        </div>
        <div className="arc-card__actions">
          {hasSnapshot && (
            <button
              type="button"
              className="arc-btn"
              aria-expanded={open}
              aria-controls={docId}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide report" : "View report"}
            </button>
          )}
          {(r.status ?? "draft") === "draft" && r.totals && (
            <button type="button" className="arc-btn arc-btn--primary" onClick={onSubmit}>
              Submit for approval
            </button>
          )}
          {r.status === "published" && !r.superseded_by && r.totals && (
            <button type="button" className="arc-btn" onClick={onRestate}>
              Restate
            </button>
          )}
          {canDelete && (
            <button type="button" className="arc-btn arc-btn--danger" onClick={onDelete}>
              Delete draft
            </button>
          )}
        </div>
      </div>

      {(r.status ?? "draft") === "draft" && r.review_note && (
        <p className="arc-card__notice">Sent back by the Organization Admin: {r.review_note}</p>
      )}
      {r.status === "submitted" && <p className="arc-card__note">With the Organization Admin for approval.</p>}
      {r.status === "approved" && <p className="arc-card__note">Approved; the Organization Admin will publish it.</p>}
      {r.supersedes && (
        <p className="arc-card__note">Corrects “{titles[r.supersedes] || "an earlier report"}”.</p>
      )}
      {r.superseded_by && (
        <p className="arc-card__note">Replaced by a corrected version: “{titles[r.superseded_by] || "restated report"}”.</p>
      )}

      <dl className="arc-figs">
        <div>
          <dt>Energy change</dt>
          <dd>{shown(metrics.energyReduction)}</dd>
        </div>
        <div>
          <dt>Energy used</dt>
          <dd>{shown(metrics.energyConsumed)}</dd>
        </div>
        <div>
          <dt>Avoided emissions</dt>
          <dd>{shown(avoided)}</dd>
        </div>
        <div>
          <dt>Water saved</dt>
          <dd>{shown(metrics.waterSaved)}</dd>
        </div>
      </dl>

      {!hasSnapshot && (
        <p className="arc-card__note">Saved before full reports were kept, so only these figures are available.</p>
      )}

      {open && hasSnapshot && (
        <div className="arc-card__doc" id={docId}>
          <ReportDocument report={r} />
        </div>
      )}
    </article>
  );
}
