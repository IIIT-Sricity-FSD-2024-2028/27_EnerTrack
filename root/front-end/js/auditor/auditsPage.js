/**
 * auditsPage.js
 * Certified Energy Auditor — survey and recommendations.
 *
 * The auditor's whole job, on one page: record what the site actually
 * looks like, then write up what should be done about it. The client's own
 * facilities team carries the work out and marks each measure done.
 *
 * Nothing here touches money. An earlier version of this page locked a
 * baseline and computed a weather-adjusted savings figure, because
 * EnerTrack billed a share of savings and that number had to survive a
 * dispute. It no longer does — the subscription is the revenue — so all of
 * that is gone and this is a straightforward record of professional work.
 */
import {
  badge,
  emptyRow,
  escapeHtml,
  formatCurrency,
  formatDate,
  formValues,
  loadOrFail,
  openModal,
  requireAuditor,
  showToast,
} from "./utils/utils.js";

const STATUSES = ["proposed", "accepted", "implemented", "rejected"];
const SEVERITIES = ["low", "moderate", "high"];
const TIERS = ["", "bms-integration", "manual-upload", "no-metering"];

const state = {
  user: null,
  audits: [],
  orgs: [],
  buildings: [],
  plans: [],
  selectedId: null,
};

document.addEventListener("DOMContentLoaded", async () => {
  state.user = requireAuditor();
  if (!state.user) return;

  const root = document.getElementById("auditorApp");
  root.innerHTML = `<div class="card"><p class="muted">Loading engagements…</p></div>`;

  const [audits, orgs, buildings, plans] = await Promise.all([
    loadOrFail(() => window.api.get("/energy-audits"), "audits"),
    loadOrFail(() => window.api.get("/organizations"), "organisations"),
    loadOrFail(() => window.api.get("/buildings"), "buildings"),
    loadOrFail(() => window.api.get("/subscription-plans"), "tiers"),
  ]);

  if (!audits) {
    root.innerHTML = `<div class="card"><h2>Backend unavailable</h2><p class="muted">Start the API on port 3000 and reload.</p></div>`;
    return;
  }

  state.audits = audits;
  state.orgs = orgs || [];
  state.buildings = buildings || [];
  // Only live tiers can be proposed; a retired one would be refused server side.
  state.plans = (plans || []).filter((p) => p.is_active);

  const handed = localStorage.getItem("auditor_selected_audit");
  state.selectedId =
    (handed && audits.some((a) => a.audit_id === handed) && handed) ||
    audits.find((a) => a.status !== "completed")?.audit_id ||
    audits[0]?.audit_id ||
    null;

  render();
});

const selected = () =>
  state.audits.find((a) => a.audit_id === state.selectedId) || null;

const orgOf = (audit) =>
  state.orgs.find((o) => o.organization_id === audit?.organization_id) || null;

const buildingName = (id) =>
  state.buildings.find((b) => b.building_id === id)?.name ?? id;

/** Buildings belonging to the audited tenant — the only valid scope. */
const tenantBuildings = (audit) =>
  state.buildings.filter((b) => b.organization_id === audit.organization_id);

function render() {
  const root = document.getElementById("auditorApp");
  const audit = selected();

  root.innerHTML = `
    <div class="grid2" style="grid-template-columns:300px 1fr;align-items:start">
      ${renderList()}
      <div>${audit ? renderWorkspace(audit) : `<div class="card"><p class="muted">No engagements.</p></div>`}</div>
    </div>`;

  wire();
}

function renderList() {
  return `
    <div class="card">
      <h2>Engagements</h2>
      <p class="sub">Across every client.</p>
      <div class="pick-list" style="margin-top:12px">
        ${state.audits
          .map((a) => {
            const org = orgOf(a);
            const done = (a.findings || []).filter(
              (f) => f.status === "implemented",
            ).length;
            return `
          <div class="pick ${a.audit_id === state.selectedId ? "active" : ""}"
               data-select="${escapeHtml(a.audit_id)}">
            <div class="pick-title">
              <span>${escapeHtml(org?.name ?? a.organization_id)}</span>
              ${badge(a.status)}
            </div>
            <div class="pick-meta">
              ${(a.findings || []).length} recommendation(s), ${done} implemented
            </div>
          </div>`;
          })
          .join("")}
      </div>
    </div>`;
}

function renderWorkspace(audit) {
  const org = orgOf(audit);
  return `
    <div class="card">
      <div class="header-row">
        <div>
          <h2>${escapeHtml(org?.name ?? audit.organization_id)}</h2>
          <p class="sub">
            ${escapeHtml(org?.type ?? "—")} · ${escapeHtml(org?.location ?? "—")}
            · visited ${formatDate(audit.conducted_on)}
          </p>
        </div>
        <div>${badge(audit.status)}</div>
      </div>
    </div>

    ${renderSurvey(audit)}
    ${renderFindings(audit)}
    ${renderProposal(audit)}
    ${renderStatus(audit)}`;
}

function renderSurvey(audit) {
  const s = audit.survey || {};
  return `
    <div class="card">
      <h2>Site survey</h2>
      <p class="sub">What you found walking the estate.</p>
      <div class="grid4" style="margin-top:14px">
        <div class="field">
          <label for="svBuildings">Buildings surveyed</label>
          <input id="svBuildings" type="number" min="0" value="${s.buildings_surveyed ?? 0}" />
        </div>
        <div class="field">
          <label for="svMeters">Meters located</label>
          <input id="svMeters" type="number" min="0" value="${s.meters_found ?? 0}" />
        </div>
        <div class="field">
          <label for="svTier">Existing metering</label>
          <select id="svTier">
            ${TIERS.map(
              (t) =>
                `<option value="${t}" ${s.data_source_tier === t ? "selected" : ""}>${t || "— not assessed —"}</option>`,
            ).join("")}
          </select>
        </div>
        <div class="field">
          <label for="svArea">Floor area (m²)</label>
          <input id="svArea" type="number" min="0" value="${s.floor_area_sqm ?? 0}" />
        </div>
      </div>
      <div class="field">
        <label for="svNotes">Notes</label>
        <textarea id="svNotes">${escapeHtml(s.notes ?? "")}</textarea>
      </div>
      <button class="btn btn-dark" type="button" id="saveSurvey">Save survey</button>
    </div>`;
}

function renderFindings(audit) {
  const findings = audit.findings || [];
  const saving = findings.reduce((sum, f) => sum + (f.est_annual_saving || 0), 0);
  const done = findings.filter((f) => f.status === "implemented");
  const outstanding = findings.filter(
    (f) => f.status === "proposed" || f.status === "accepted",
  );

  return `
    <div class="card">
      <div class="header-row">
        <div>
          <h2>Recommendations</h2>
          <p class="sub">
            ${findings.length} measure(s), ${done.length} implemented.
            ${formatCurrency(saving)} of estimated annual saving identified.
          </p>
        </div>
        <button class="btn btn-dark" type="button" id="addFinding">+ Add recommendation</button>
      </div>

      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Measure</th><th>Category</th><th>Severity</th>
            <th class="num">Annual saving</th><th class="num">Capex</th>
            <th class="num">Payback</th><th>Buildings</th>
            <th>Status</th><th>Done</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${
            findings.length === 0
              ? emptyRow(10, "No recommendations recorded yet.")
              : findings
                  .map(
                    (f) => `
            <tr>
              <td style="max-width:250px">${escapeHtml(f.title)}</td>
              <td>${escapeHtml(f.category)}</td>
              <td>${badge(f.severity)}</td>
              <td class="num">${formatCurrency(f.est_annual_saving)}</td>
              <td class="num">${formatCurrency(f.capex)}</td>
              <td class="num">${f.payback_months || "—"} mo</td>
              <td style="font-size:12px">
                ${(f.building_ids || []).map((b) => escapeHtml(buildingName(b))).join(", ") || "—"}
              </td>
              <td>${badge(f.status)}</td>
              <td class="nowrap">${f.implemented_on ? formatDate(f.implemented_on) : "—"}</td>
              <td class="table-actions">
                <button class="btn btn-light" type="button" data-edit="${escapeHtml(f.finding_id)}">Edit</button>
              </td>
            </tr>`,
                  )
                  .join("")
          }
        </tbody>
      </table>

      ${
        outstanding.length
          ? `<div class="callout" style="margin-top:16px">
               <strong>${formatCurrency(outstanding.reduce((s, f) => s + (f.est_annual_saving || 0), 0))}</strong>
               of estimated annual saving is still on the table across
               ${outstanding.length} measure(s) the client has not carried out.
             </div>`
          : ""
      }
    </div>`;
}

/**
 * The proposal: which tier suits the estate the auditor just walked, and what
 * it will cost.
 *
 * Deliberately ONE document rather than two approvals. The first draft of this
 * workflow had the client sign off a requirements list and see a price only
 * afterwards — but nobody approves a scope without knowing the cost, and a
 * surprising price reopens the scope anyway, so that round trip bought nothing.
 *
 * The auditor picks a tier and enters what they counted on site. The monthly
 * figure comes back from the pricing engine; it is never typed here, so it
 * cannot be quietly discounted.
 */
function renderProposal(audit) {
  const p = audit.proposal;
  const org = orgOf(audit);
  const decided = audit.status === "accepted" || audit.status === "declined";

  return `
    <div class="card">
      <div class="header-row">
        <div>
          <h2>Proposal</h2>
          <p class="sub">
            What this organisation needs and what it costs, on one document.
            Their Organization Admin approves it, and the subscription starts
            the moment they do.
          </p>
        </div>
        ${p ? badge(audit.status) : ""}
      </div>

      ${
        p
          ? `<dl class="dl" style="margin-top:14px">
               <dt>Proposed tier</dt>
               <dd>${escapeHtml(planName(p.recommended_plan_id))}</dd>
               <dt>Monthly estimate</dt>
               <dd><strong>${formatCurrency(p.monthly_estimate)}</strong> before GST</dd>
               <dt>Counted on site</dt>
               <dd>${p.estimated_staff} staff, ${p.estimated_campuses} campus(es)</dd>
               <dt>Sent</dt>
               <dd>${formatDate(p.sent_on)}</dd>
             </dl>`
          : ""
      }

      ${
        audit.status === "changes-requested" && p?.response_note
          ? `<div class="callout warn" style="margin-top:16px">
               <strong>${escapeHtml(org?.name ?? "The client")} asked for changes on
               ${formatDate(p.responded_on)}:</strong><br>
               ${escapeHtml(p.response_note)}
             </div>`
          : ""
      }
      ${
        audit.status === "declined" && p?.response_note
          ? `<div class="callout warn" style="margin-top:16px">
               <strong>Declined on ${formatDate(p.responded_on)}:</strong><br>
               ${escapeHtml(p.response_note)}
             </div>`
          : ""
      }
      ${
        audit.status === "accepted" && p
          ? `<div class="callout good" style="margin-top:16px">
               Accepted on ${formatDate(p.responded_on)}. Their subscription is
               live and billing has started.
             </div>`
          : ""
      }

      ${
        decided
          ? ""
          : `<div class="section-title">${p ? "Revise and resend" : "Send a proposal"}</div>
             <div class="toolbar">
               <div class="field">
                 <label for="propPlan">Tier</label>
                 <select id="propPlan">
                   ${state.plans
                     .map(
                       (x) =>
                         `<option value="${escapeHtml(x.plan_id)}" ${x.plan_id === p?.recommended_plan_id ? "selected" : ""}>
                            ${escapeHtml(x.name)} — ${formatCurrency(x.base_monthly_fee)}/mo,
                            ${x.included_seats} staff,
                            ${x.max_campuses === null ? "unlimited" : x.max_campuses} campus(es)
                          </option>`,
                     )
                     .join("")}
                 </select>
               </div>
               <div class="field">
                 <label for="propStaff">Staff counted</label>
                 <input id="propStaff" type="number" min="0" value="${p?.estimated_staff ?? 0}" />
               </div>
               <div class="field">
                 <label for="propCampuses">Campuses</label>
                 <input id="propCampuses" type="number" min="1" value="${p?.estimated_campuses ?? 1}" />
               </div>
               <button class="btn btn-green" type="button" id="sendProposal">
                 ${p ? "Resend proposal" : "Send proposal"}
               </button>
             </div>
             <p class="muted" style="font-size:12px">
               The monthly figure is computed from the tier and the headcount you
               enter. It is an estimate — the first invoice bills whatever the
               staff count actually is on the day.
             </p>`
      }
    </div>`;
}

function planName(planId) {
  return state.plans.find((p) => p.plan_id === planId)?.name ?? planId;
}

function renderStatus(audit) {
  return `
    <div class="card">
      <h2>Engagement status</h2>
      <p class="sub">Currently ${escapeHtml(audit.status)}.</p>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-light" type="button" data-status="scheduled">Scheduled</button>
        <button class="btn btn-light" type="button" data-status="in-progress">In progress</button>
        <button class="btn btn-green" type="button" data-status="completed">Mark completed</button>
      </div>
    </div>`;
}

/* ─── Wiring ────────────────────────────────────────────────────── */

function wire() {
  const root = document.getElementById("auditorApp");

  root.querySelectorAll("[data-select]").forEach((el) => {
    el.onclick = () => {
      state.selectedId = el.dataset.select;
      localStorage.setItem("auditor_selected_audit", state.selectedId);
      render();
    };
  });

  const audit = selected();
  if (!audit) return;

  root.querySelector("#saveSurvey")?.addEventListener("click", () => saveSurvey(audit));
  root.querySelector("#addFinding")?.addEventListener("click", () => openFindingModal(audit));
  root.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => openFindingModal(audit, b.dataset.edit);
  });
  root.querySelectorAll("[data-status]").forEach((b) => {
    b.onclick = () => setStatus(audit, b.dataset.status);
  });
  root.querySelector("#sendProposal")?.addEventListener("click", () =>
    sendProposal(audit),
  );
}

async function sendProposal(audit) {
  const body = {
    recommended_plan_id: document.getElementById("propPlan").value,
    estimated_staff: Number(document.getElementById("propStaff").value || 0),
    estimated_campuses: Number(document.getElementById("propCampuses").value || 1),
  };

  try {
    const updated = await window.api.post(
      `/energy-audits/${audit.audit_id}/proposal`,
      body,
    );
    Object.assign(audit, updated);
    showToast(
      "Proposal sent. Their Organization Admin has been notified.",
      "success",
      5000,
    );
    render();
  } catch (err) {
    // The backend refuses a tier too small for the estate, or an organisation
    // with no admin to send to. Both messages are worth showing in full.
    showToast(err.message, "error", 8000);
  }
}

async function saveSurvey(audit) {
  const body = {
    buildings_surveyed: Number(document.getElementById("svBuildings").value || 0),
    meters_found: Number(document.getElementById("svMeters").value || 0),
    floor_area_sqm: Number(document.getElementById("svArea").value || 0),
    notes: document.getElementById("svNotes").value.trim(),
  };
  const tier = document.getElementById("svTier").value;
  if (tier) body.data_source_tier = tier;

  try {
    audit.survey = await window.api.patch(
      `/energy-audits/${audit.audit_id}/survey`,
      body,
    );
    showToast("Survey saved.", "success");
    render();
  } catch (err) {
    showToast(err.message, "error", 6000);
  }
}

async function setStatus(audit, status) {
  try {
    const updated = await window.api.patch(`/energy-audits/${audit.audit_id}`, {
      status,
      ...(status === "completed" && !audit.conducted_on
        ? { conducted_on: new Date().toISOString().slice(0, 10) }
        : {}),
    });
    Object.assign(audit, updated);
    showToast(`Engagement marked ${status}.`, "success");
    render();
  } catch (err) {
    showToast(err.message, "error", 6000);
  }
}

function openFindingModal(audit, findingId) {
  const finding = findingId
    ? audit.findings.find((f) => f.finding_id === findingId)
    : null;
  const chosen = new Set(finding?.building_ids || []);

  openModal({
    title: finding ? "Edit recommendation" : "New recommendation",
    confirmLabel: finding ? "Save changes" : "Add recommendation",
    bodyHTML: `
      <div class="field">
        <label>Measure</label>
        <input name="title" value="${escapeHtml(finding?.title ?? "")}"
               placeholder="e.g. Chiller plant sequencing on return-water temperature" />
      </div>
      <div class="grid2">
        <div class="field">
          <label>Category</label>
          <input name="category" value="${escapeHtml(finding?.category ?? "")}"
                 placeholder="HVAC, Lighting, Generation…" />
        </div>
        <div class="field">
          <label>Severity</label>
          <select name="severity">
            ${SEVERITIES.map(
              (s) =>
                `<option value="${s}" ${finding?.severity === s ? "selected" : ""}>${s}</option>`,
            ).join("")}
          </select>
        </div>
      </div>
      <div class="grid2">
        <div class="field">
          <label>Estimated annual saving (₹)</label>
          <input name="est_annual_saving" type="number" min="0" value="${finding?.est_annual_saving ?? 0}" />
        </div>
        <div class="field">
          <label>Capex (₹)</label>
          <input name="capex" type="number" min="0" value="${finding?.capex ?? 0}" />
        </div>
      </div>
      <p class="muted" style="font-size:11px;margin:-4px 0 12px">
        Payback is worked out from these two when you leave it to us.
      </p>
      ${
        finding
          ? `<div class="field">
               <label>Status</label>
               <select name="status">
                 ${STATUSES.map(
                   (s) =>
                     `<option value="${s}" ${finding.status === s ? "selected" : ""}>${s}</option>`,
                 ).join("")}
               </select>
             </div>`
          : ""
      }
      <div class="field">
        <label>Buildings affected</label>
        <div class="pick-list" style="max-height:180px">
          ${tenantBuildings(audit)
            .map(
              (b) => `
            <label class="pick" style="display:flex;gap:10px;align-items:center;cursor:pointer">
              <input type="checkbox" data-building="${escapeHtml(b.building_id)}"
                     ${chosen.has(b.building_id) ? "checked" : ""} style="width:auto;margin:0" />
              <span>${escapeHtml(b.name)}</span>
            </label>`,
            )
            .join("")}
        </div>
      </div>`,
    onConfirm: async (overlay) => {
      const values = formValues(overlay);
      const buildingIds = [...overlay.querySelectorAll("[data-building]")]
        .filter((cb) => cb.checked)
        .map((cb) => cb.dataset.building);

      if (!values.title) {
        showToast("A measure needs a title.", "warning");
        return false;
      }
      if (buildingIds.length === 0) {
        showToast("Pick at least one building the measure affects.", "warning");
        return false;
      }

      const body = {
        title: values.title,
        category: values.category || "General",
        severity: values.severity,
        est_annual_saving: Number(values.est_annual_saving) || 0,
        capex: Number(values.capex) || 0,
        building_ids: buildingIds,
      };

      try {
        if (finding) {
          if (values.status) body.status = values.status;
          const updated = await window.api.patch(
            `/energy-audits/${audit.audit_id}/findings/${finding.finding_id}`,
            body,
          );
          Object.assign(finding, updated);
          showToast("Recommendation updated.", "success");
        } else {
          const created = await window.api.post(
            `/energy-audits/${audit.audit_id}/findings`,
            body,
          );
          audit.findings.push(created);
          showToast("Recommendation added.", "success");
        }
        render();
        return true;
      } catch (err) {
        showToast(err.message, "error", 7000);
        return false;
      }
    },
  });
}
