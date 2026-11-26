/**
 * Overview.jsx — Certified Energy Auditor landing page.
 *
 * Ported from front-end/js/auditor/overviewPage.js.
 *
 * Answers two questions: where is every engagement up to, and did the
 * recommendations actually work. The savings figure is reported, never
 * billed — EnerTrack charges a subscription — so it is evidence the
 * service works, not the basis of an invoice.
 *
 * Read-only. All editing happens on the Audits page.
 */
import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loadAuditPortfolio,
  selectAllEnergyAudits,
  selectAuditCounts,
  selectEnergyAuditsError,
  selectEnergyAuditsStatus,
  selectImpactWithSavings,
  selectOutstandingFindings,
} from "../../store/slices/energyAuditsSlice";
import {
  fetchOrganizations,
  selectAllOrganizations,
} from "../../store/slices/organizationsSlice";

import Kpi from "./components/Kpi";
import ImpactTable from "./overview/ImpactTable";
import Pipeline from "./overview/Pipeline";
import OutstandingTable from "./overview/OutstandingTable";
import { hasComparison } from "../../store/derive/auditImpact";
import { formatCurrency, formatKwh } from "./auditorUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/shared/platform_shared.css";
import "./auditor.css";

export default function AuditorOverview() {
  const dispatch = useDispatch();
  const audits = useSelector(selectAllEnergyAudits);
  // Names only: if they fail, ids are shown instead.
  const orgs = useSelector(selectAllOrganizations);
  const counts = useSelector(selectAuditCounts);
  const outstanding = useSelector(selectOutstandingFindings);
  // Each client is measured over their own window: from the month after
  // their first implemented measure (see overview/impact.js). `savings` is
  // undefined until that client's call answers, null if it failed.
  const impact = useSelector(selectImpactWithSavings);
  const status = useSelector(selectEnergyAuditsStatus);
  const error = useSelector(selectEnergyAuditsError);

  // Wait for every measurable client's savings too, so the KPI cards and
  // the "Did it work?" table never show half-loaded figures.
  const savingsPending = impact.some((c) => c.window && c.savings === undefined);
  const loading =
    status === "idle" || status === "loading" || (status === "succeeded" && savingsPending);

  // Audits (then savings) are re-read each time the page opens.
  const loadData = useCallback(() => dispatch(loadAuditPortfolio()), [dispatch]);
  useEffect(() => {
    loadData();
    dispatch(fetchOrganizations());
  }, [dispatch, loadData]);

  /** An organisation's name, or its id if we could not load the names. */
  function orgName(id) {
    const org = orgs.find((o) => o.organization_id === id);
    if (org) {
      return org.name;
    }
    return id;
  }

  // ── KPI numbers ──────────────────────────────────────
  // Open = the client has not said yes or no to the proposal yet.
  const { open: openCount, findings: findingCount, implemented: implementedCount } = counts;

  // Summed from the same rows "Did it work?" shows, so the cards and the
  // table always agree. A client that used more counts as 0, not a negative.
  let savedKwh = 0;
  let savedAmount = 0;
  for (const client of impact) {
    if (hasComparison(client)) {
      savedKwh += Math.max(0, client.savings.saved_kwh || 0);
      savedAmount += Math.max(0, client.savings.saved_amount || 0);
    }
  }

  // ── Pick what goes under the header ──────────────────
  let content;
  if (loading) {
    content = (
      <div className="card">
        <p className="muted">Loading portfolio…</p>
      </div>
    );
  } else if (status === "failed") {
    content = (
      <div className="card">
        <h2>Backend unavailable</h2>
        <p className="muted">{error}</p>
        <button type="button" className="btn btn-dark" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  } else {
    content = (
      <div>
        <div className="grid4" style={{ marginBottom: "20px" }}>
          <Kpi
            label="Open engagements"
            value={openCount}
            note={audits.length + " in total"}
          />
          <Kpi
            label="Recommendations"
            value={findingCount}
            note={implementedCount + " carried out by clients"}
          />
          <Kpi
            label="Energy saved"
            value={formatKwh(savedKwh)}
            note="Since each client's measures went in"
            tone="pos"
          />
          <Kpi
            label="Worth to clients"
            value={formatCurrency(savedAmount)}
            note="At their own tariffs"
            tone="pos"
          />
        </div>

        <ImpactTable impact={impact} orgName={orgName} />
        <Pipeline audits={audits} orgName={orgName} />
        <OutstandingTable rows={outstanding} orgName={orgName} />
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <span className="platform-tag">EnerTrack staff · all tenants</span>
        <h1 style={{ marginTop: "10px" }}>Audit portfolio</h1>
        <p>
          Every engagement you are certifying, across all client organisations,
          and what the recommendations you wrote have actually saved.
        </p>
      </header>

      {content}
    </div>
  );
}
