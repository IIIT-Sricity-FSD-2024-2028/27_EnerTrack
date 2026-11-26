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
 * Each card saves on its own through the energyAudits slice, which updates
 * the audit in place, so every card (and the list) shows the change.
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { useLiveData } from "../../store/useLiveData";
import {
  fetchEnergyAudits,
  selectAllEnergyAudits,
} from "../../store/slices/energyAuditsSlice";
import {
  fetchOrganizations,
  selectAllOrganizations,
} from "../../store/slices/organizationsSlice";
import {
  fetchSubscriptionPlans,
  selectActiveSubscriptionPlans,
} from "../../store/slices/subscriptionPlansSlice";
import {
  fetchBuildings,
  selectAllBuildings,
} from "../../store/slices/buildingsSlice";
import { fetchMeters, selectAllMeters } from "../../store/slices/metersSlice";

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

// Only the audits are required, and they are re-read each time the page
// opens. Module level, so useLiveData gets the same array on every render.
const LOADS = [fetchEnergyAudits];

export default function AuditorAudits() {
  const location = useLocation();
  const { toasts, showToast } = useToast();
  const dispatch = useDispatch();
  // Shared with the infrastructure manager below: a building it adds shows
  // up in the recommendation form at once.
  const buildings = useSelector(selectAllBuildings);
  const meters = useSelector(selectAllMeters);

  const audits = useSelector(selectAllEnergyAudits);
  // Names only: if they fail, ids are shown instead.
  const orgs = useSelector(selectAllOrganizations);
  // Only live tiers can be proposed; a retired one is refused by the server.
  const plans = useSelector(selectActiveSubscriptionPlans);
  const { loading, ready, error, reload } = useLiveData(LOADS, {
    intervalMs: 0,
  });

  // The Overview pipeline sends the clicked audit's id in the router state.
  const [selectedId, setSelectedId] = useState(
    location.state ? location.state.auditId : null,
  );

  // The rest is best effort: the page works without it.
  useEffect(() => {
    dispatch(fetchOrganizations());
    dispatch(fetchSubscriptionPlans());
    dispatch(fetchBuildings());
    dispatch(fetchMeters());
  }, [dispatch]);

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
  } else if (!ready) {
    content = (
      <div className="card">
        <h2>Backend unavailable</h2>
        <p className="muted">{error}</p>
        <button type="button" className="btn btn-dark" onClick={reload}>
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

            {/* key= gives each client a fresh manager. It saves through
                the shared slices, so this page sees its changes at once. */}
            <div style={{ marginTop: "14px" }}>
              <InfrastructureManager
                key={audit.organization_id}
                orgId={audit.organization_id}
                showBudget={false}
              />
            </div>
          </div>

          {/* key= makes these cards start fresh when another audit is
              picked, so their form fields show the new audit's values. */}
          <NotesCard
            key={"notes-" + audit.audit_id}
            audit={audit}
            showToast={showToast}
          />
          <FindingsCard
            audit={audit}
            buildings={clientBuildings}
            showToast={showToast}
          />
          <ProposalCard
            key={"proposal-" + audit.audit_id}
            audit={audit}
            org={org}
            plans={plans}
            showToast={showToast}
          />
          <StatusCard audit={audit} showToast={showToast} />
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
