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
import { useEffect, useState } from "react";
import api from "../../api/client";

import Kpi from "./components/Kpi";
import ImpactTable from "./overview/ImpactTable";
import Pipeline from "./overview/Pipeline";
import OutstandingTable from "./overview/OutstandingTable";
import { formatCurrency, formatKwh } from "./auditorUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/shared/platform_shared.css";
import "./auditor.css";

// The months the "Did it work?" table compares against a year earlier.
const IMPACT_FROM = "2026-03";
const IMPACT_TO = "2026-08";

/**
 * Gets everything the page shows. Only fetches — it does not touch React
 * state, so it lives outside the component.
 *
 * If the audits call fails the whole thing fails (there is nothing to
 * show). If the organisations call fails we carry on and show ids instead
 * of names. A failed savings call just leaves that client without a
 * comparison.
 */
async function fetchPortfolio() {
  const [audits, orgs] = await Promise.all([
    api.get("/energy-audits"),
    api.get("/organizations").catch(() => []),
  ]);

  // Savings are per organisation, so only ask for the ones we audited.
  const orgIds = [];
  for (const audit of audits || []) {
    if (!orgIds.includes(audit.organization_id)) {
      orgIds.push(audit.organization_id);
    }
  }

  const savingsList = await Promise.all(
    orgIds.map((id) =>
      api
        .get(
          "/organizations/" +
            id +
            "/savings?from=" +
            IMPACT_FROM +
            "&to=" +
            IMPACT_TO,
        )
        .catch(() => null),
    ),
  );

  // Turn the list into { orgId: savings } so the tables can look one up.
  const savingsByOrg = {};
  orgIds.forEach((id, i) => {
    savingsByOrg[id] = savingsList[i];
  });

  return { audits: audits || [], orgs: orgs || [], savingsByOrg };
}

export default function AuditorOverview() {
  const [audits, setAudits] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [savingsByOrg, setSavingsByOrg] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Same pattern as the technician pages: setState only inside the
  // .then / .catch callbacks (the lint rules require it).
  function loadData() {
    return fetchPortfolio()
      .then((data) => {
        setError("");
        setAudits(data.audits);
        setOrgs(data.orgs);
        setSavingsByOrg(data.savingsByOrg);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadData();
  }, []);

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
  const openCount = audits.filter(
    (a) => a.status !== "accepted" && a.status !== "declined",
  ).length;

  let findingCount = 0;
  let implementedCount = 0;
  for (const audit of audits) {
    for (const finding of audit.findings || []) {
      findingCount++;
      if (finding.status === "implemented") {
        implementedCount++;
      }
    }
  }

  // A client that used more this year counts as 0, not a negative saving.
  let savedKwh = 0;
  let savedAmount = 0;
  for (const savings of Object.values(savingsByOrg)) {
    if (savings) {
      savedKwh += Math.max(0, savings.saved_kwh || 0);
      savedAmount += Math.max(0, savings.saved_amount || 0);
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
  } else if (error) {
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
            note="Against the same months last year"
            tone="pos"
          />
          <Kpi
            label="Worth to clients"
            value={formatCurrency(savedAmount)}
            note="At their own tariffs"
            tone="pos"
          />
        </div>

        <ImpactTable
          audits={audits}
          savingsByOrg={savingsByOrg}
          orgName={orgName}
        />
        <Pipeline audits={audits} orgName={orgName} />
        <OutstandingTable audits={audits} orgName={orgName} />
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
