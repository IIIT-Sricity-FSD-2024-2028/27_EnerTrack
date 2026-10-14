/**
 * Audits.jsx — Certified Energy Auditor workspace.
 *
 * Ported from front-end/js/auditor/auditsPage.js.
 *
 * The auditor's whole job on one page: pick an engagement on the left,
 * then on the right record the site, write notes and recommendations, and
 * send the proposal. The client's own team carries the work out and marks
 * each measure done.
 *
 * Each card saves on its own and hands the result back up here, so this
 * page is the one place the audit list is kept.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../api/client";

import ToastStack from "../technician/components/ToastStack";
import { useToast } from "../technician/components/useToast";
import Badge from "./components/Badge";
import EngagementList from "./audits/EngagementList";
import NotesCard from "./audits/NotesCard";
import FindingsCard from "./audits/FindingsCard";
import ProposalCard from "./audits/ProposalCard";
import StatusCard from "./audits/StatusCard";
import InfrastructureManager from "./infrastructure/InfrastructureManager";
import { formatDate } from "./auditorUtils";

import "../../styles/shared/tech_shared.css";
import "../../styles/shared/platform_shared.css";
import "./auditor.css";

/**
 * Gets everything the page shows. Only fetches — it does not touch React
 * state, so it lives outside the component.
 *
 * Only the audits call is required. If any of the others fail, the page
 * still works with what it has (ids instead of names, an empty tier list).
 */
async function fetchWorkspace() {
  const [audits, orgs, buildings, meters, plans] = await Promise.all([
    api.get("/energy-audits"),
    api.get("/organizations").catch(() => []),
    api.get("/buildings").catch(() => []),
    api.get("/meters").catch(() => []),
    api.get("/subscription-plans").catch(() => []),
  ]);

  return {
    audits: audits || [],
    orgs: orgs || [],
    buildings: buildings || [],
    meters: meters || [],
    // Only live tiers can be proposed; a retired one is refused by the server.
    plans: (plans || []).filter((p) => p.is_active),
  };
}

export default function AuditorAudits() {
  const location = useLocation();
  const { toasts, showToast } = useToast();

  const [audits, setAudits] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [meters, setMeters] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The Overview pipeline sends the clicked audit's id in the router state.
  const [selectedId, setSelectedId] = useState(
    location.state ? location.state.auditId : null,
  );

  function loadData() {
    return fetchWorkspace()
      .then((data) => {
        setError("");
        setAudits(data.audits);
        setOrgs(data.orgs);
        setBuildings(data.buildings);
        setMeters(data.meters);
        setPlans(data.plans);
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

  /** Called by the infrastructure manager after it saves or deletes. */
  function reloadBuildingsAndMeters() {
    Promise.all([api.get("/buildings"), api.get("/meters")])
      .then(([newBuildings, newMeters]) => {
        setBuildings(newBuildings || []);
        setMeters(newMeters || []);
      })
      .catch(() => {
        // Keep the old lists; the manager has already shown any error.
      });
  }

  // ── Which audit is open ──────────────────────────────
  // The one picked, else the first still open, else the first of all.
  let audit = audits.find((a) => a.audit_id === selectedId);
  if (!audit) {
    audit = audits.find(
      (a) => a.status !== "accepted" && a.status !== "declined",
    );
  }
  if (!audit) {
    audit = audits[0];
  }

  // ── Saving: each card hands back what the server returned ──

  /** Swap in the updated copy of an audit the server sent back. */
  function handleAuditSaved(updated) {
    setAudits((current) =>
      current.map((a) => (a.audit_id === updated.audit_id ? updated : a)),
    );
  }

  /** Add a new finding, or replace an edited one, on the open audit. */
  function handleFindingSaved(saved) {
    const auditId = audit.audit_id;
    setAudits((current) =>
      current.map((a) => {
        if (a.audit_id !== auditId) {
          return a;
        }
        const findings = a.findings || [];
        const exists = findings.some((f) => f.finding_id === saved.finding_id);
        let newFindings;
        if (exists) {
          newFindings = findings.map((f) =>
            f.finding_id === saved.finding_id ? saved : f,
          );
        } else {
          newFindings = [...findings, saved];
        }
        return { ...a, findings: newFindings };
      }),
    );
  }

  /** An organisation's name, or its id if we could not load the names. */
  function orgName(id) {
    const org = orgs.find((o) => o.organization_id === id);
    if (org) {
      return org.name;
    }
    return id;
  }

  // ── Pick what goes under the header ──────────────────
  let content;
  if (loading) {
    content = (
      <div className="card">
        <p className="muted">Loading engagements…</p>
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
  } else if (!audit) {
    content = (
      <div className="card">
        <p className="muted">No engagements.</p>
      </div>
    );
  } else {
    const org = orgs.find((o) => o.organization_id === audit.organization_id);
    // Only this client's buildings and meters belong in their audit.
    const clientBuildings = buildings.filter(
      (b) => b.organization_id === audit.organization_id,
    );
    const clientMeters = meters.filter(
      (m) => m.organization_id === audit.organization_id,
    );

    content = (
      <div
        className="grid2"
        style={{ gridTemplateColumns: "300px 1fr", alignItems: "start" }}
      >
        <EngagementList
          audits={audits}
          selectedId={audit.audit_id}
          onSelect={setSelectedId}
          orgName={orgName}
        />

        <div>
          {/* Who and where */}
          <div className="card">
            <div className="header-row">
              <div>
                <h2>{orgName(audit.organization_id)}</h2>
                <p className="sub">
                  {org ? org.type : "—"} · {org ? org.location : "—"} · visited{" "}
                  {formatDate(audit.conducted_on)}
                </p>
              </div>
              <Badge status={audit.status} />
            </div>
          </div>

          {/* Infrastructure: the auditor records the client's estate
              while walking the site. */}
          <div className="card">
            <div className="header-row">
              <div>
                <h2>Infrastructure</h2>
                <p className="sub">
                  Record campuses, buildings, departments and meters as you walk
                  the site — exactly what the client will see on their own
                  dashboard once they&apos;re onboard.
                </p>
              </div>
              <div className="sub" style={{ whiteSpace: "nowrap" }}>
                <strong>{clientBuildings.length}</strong> building(s) ·{" "}
                <strong>{clientMeters.length}</strong> meter(s)
              </div>
            </div>

            {/* key= gives each client a fresh manager. onChange reloads
                the buildings and meters this page uses, so a building
                added here shows up in the recommendation form at once. */}
            <div style={{ marginTop: "14px" }}>
              <InfrastructureManager
                key={audit.organization_id}
                orgId={audit.organization_id}
                onChange={reloadBuildingsAndMeters}
              />
            </div>
          </div>

          {/* key= makes these cards start fresh when another audit is
              picked, so their form fields show the new audit's values. */}
          <NotesCard
            key={"notes-" + audit.audit_id}
            audit={audit}
            onSaved={handleAuditSaved}
            showToast={showToast}
          />
          <FindingsCard
            audit={audit}
            buildings={clientBuildings}
            onFindingSaved={handleFindingSaved}
            showToast={showToast}
          />
          <ProposalCard
            key={"proposal-" + audit.audit_id}
            audit={audit}
            org={org}
            plans={plans}
            onSaved={handleAuditSaved}
            showToast={showToast}
          />
          <StatusCard
            audit={audit}
            onSaved={handleAuditSaved}
            showToast={showToast}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <span className="platform-tag">EnerTrack staff · all tenants</span>
        <h1 style={{ marginTop: "10px" }}>Survey and recommendations</h1>
        <p>
          Record what you found on site, then write up what needs fixing. The
          client&apos;s own team carries the work out and marks it done.
        </p>
      </header>

      {content}

      <ToastStack toasts={toasts} />
    </div>
  );
}
