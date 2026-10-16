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
import { impactClients, hasComparison } from "./overview/impact";
import { formatCurrency, formatKwh } from "./auditorUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/shared/platform_shared.css";
import "./auditor.css";

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

  // Each client is measured over their own window: from the month after
  // their first implemented measure (see overview/impact.js). A client with
  // no window has nothing to measure yet, so no call is made for them.
  const clients = impactClients(audits || []);
  const impact = await Promise.all(
    clients.map((client) => {
      if (!client.window) return { ...client, savings: null };
      const { from, to } = client.window;
      return api
        .get(`/organizations/${client.organization_id}/savings?from=${from}&to=${to}`)
        .catch(() => null)
        .then((savings) => ({ ...client, savings }));
    }),
  );

  return { audits: audits || [], orgs: orgs || [], impact };
}

export default function AuditorOverview() {
  const [audits, setAudits] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [impact, setImpact] = useState([]);
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
        setImpact(data.impact);
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
