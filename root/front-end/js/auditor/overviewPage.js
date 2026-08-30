/**
 * overviewPage.js
 * Certified Energy Auditor — portfolio overview.
 *
 * Answers three questions in order of usefulness to the person doing the
 * job: what needs my attention, where is every engagement up to, and how
 * much of what I have signed has actually turned into revenue.
 *
 * That last one is the point of the page. An auditor signing a savings
 * claim is not the end of the process — the client has to accept it before
 * it can be billed — so this deliberately reports signed and accepted as
 * two different numbers rather than one flattering total.
 */
import {
  badge,
  emptyRow,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatKwh,
  formatPeriod,
  loadOrFail,
  requireAuditor,
} from "./utils/utils.js";

const STAGES = [
  { key: "scheduled", label: "Scheduled" },
  { key: "in-progress", label: "In progress" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

document.addEventListener("DOMContentLoaded", async () => {
  const user = requireAuditor();
  if (!user) return;

  const root = document.getElementById("auditorApp");
  root.innerHTML = `<div class="card"><p class="muted">Loading portfolio…</p></div>`;

  const [audits, orgs, verifications] = await Promise.all([
    loadOrFail(() => window.api.get("/energy-audits"), "audits"),
    loadOrFail(() => window.api.get("/organizations"), "organisations"),
    loadOrFail(() => window.api.get("/energy-audits/verifications"), "verifications"),
  ]);

  if (!audits) {
    root.innerHTML = `<div class="card"><h2>Backend unavailable</h2><p class="muted">Start the API on port 3000 and reload.</p></div>`;
    return;
  }

  const orgName = (id) =>
    (orgs || []).find((o) => o.organization_id === id)?.name ?? id;

  root.innerHTML = [
    renderKpis(audits, verifications || []),
    renderAwaitingClient(verifications || [], orgName),
    renderPipeline(audits, orgName),
    renderRecentSignoffs(verifications || [], orgName),
  ].join("");

  root.querySelectorAll("[data-audit]").forEach((el) => {
    el.addEventListener("click", () => {
      // Hand the chosen engagement to the workspace, so the next page opens
      // on it rather than making the auditor find it again.
      localStorage.setItem("auditor_selected_audit", el.dataset.audit);
      window.location.href = "auditor_audits.html";
    });
  });
});

/* ─── KPI row ───────────────────────────────────────────────────── */

function renderKpis(audits, verifications) {
  const open = audits.filter(
    (a) => a.status === "scheduled" || a.status === "in-progress",
  ).length;
  const locked = audits.filter((a) => a.baseline?.locked).length;

  const accepted = verifications.filter((v) => v.status === "client-accepted");
  const awaiting = verifications.filter((v) => v.status === "auditor-signed");
  const disputed = verifications.filter((v) => v.status === "disputed");

  const acceptedKwh = accepted.reduce((sum, v) => sum + (v.saved_kwh || 0), 0);
  const awaitingValue = awaiting.reduce((sum, v) => sum + (v.saved_amount || 0), 0);

  return `
    <div class="grid4" style="margin-bottom:20px">
      ${kpi("Open engagements", open, `${audits.length} in total`)}
      ${kpi("Baselines locked", locked, "Frozen and billable against")}
      ${kpi(
        "Savings accepted",
        formatKwh(acceptedKwh),
        `${accepted.length} claim(s) the client agreed`,
        "pos",
      )}
      ${kpi(
        "Awaiting acceptance",
        formatCurrency(awaitingValue),
        `${awaiting.length} signed, ${disputed.length} disputed — none of it billable yet`,
        awaiting.length ? "neg" : "",
      )}
    </div>`;
}

function kpi(label, value, note, tone = "") {
  return `
    <div class="kpi">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value ${tone}">${value}</div>
      <div class="kpi-note">${escapeHtml(note)}</div>
    </div>`;
}

/* ─── Worklist ──────────────────────────────────────────────────── */

/**
 * Claims sitting between the auditor's signature and the client's.
 *
 * This is the auditor's real worklist. Work that stalls here is work
 * EnerTrack has done and cannot invoice, and the usual cause is a client
 * who has not been walked through the adjustment.
 */
function renderAwaitingClient(verifications, orgName) {
  const stuck = verifications
    .filter((v) => v.status === "auditor-signed" || v.status === "disputed")
    .sort((a, b) => b.period.localeCompare(a.period));

  if (stuck.length === 0) {
    return `
      <div class="card">
        <h2>Nothing waiting on a client</h2>
        <p class="sub">Every signed savings claim has been accepted.</p>
      </div>`;
  }

  return `
    <div class="card">
      <h2>Waiting on the client</h2>
      <p class="sub">
        Signed but not accepted, so not billable. A disputed claim needs the
        adjustment explaining before it can move.
      </p>
      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Organisation</th><th>Period</th><th>Status</th>
            <th class="num">Verified saving</th><th class="num">Value</th><th>Note</th>
          </tr>
        </thead>
        <tbody>
          ${stuck
            .map(
              (v) => `
            <tr>
              <td>${escapeHtml(v.organization_name || orgName(v.organization_id))}</td>
              <td class="nowrap">${formatPeriod(v.period)}</td>
              <td>${badge(v.status)}</td>
              <td class="num">${formatKwh(v.saved_kwh)}</td>
              <td class="num">${formatCurrency(v.saved_amount)}</td>
              <td class="muted" style="font-size:12px">${escapeHtml(
                v.dispute_reason || `Signed ${formatDate(v.signed_on)}`,
              )}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

/* ─── Pipeline ──────────────────────────────────────────────────── */

function renderPipeline(audits, orgName) {
  return `
    <div class="card">
      <h2>Engagement pipeline</h2>
      <p class="sub">Click an engagement to open its survey and baseline.</p>
      <div class="pipeline" style="margin-top:14px">
        ${STAGES.map((stage) => {
          const inStage = audits.filter((a) => a.status === stage.key);
          return `
            <div class="pipe-col">
              <h4><span>${escapeHtml(stage.label)}</span><span>${inStage.length}</span></h4>
              ${
                inStage.length === 0
                  ? `<p class="muted" style="font-size:12px">—</p>`
                  : inStage
                      .map(
                        (a) => `
                <div class="pipe-card" data-audit="${escapeHtml(a.audit_id)}">
                  <div class="pc-org">${escapeHtml(orgName(a.organization_id))}</div>
                  <div class="pc-meta">
                    ${a.baseline?.locked ? "Baseline locked" : "No baseline yet"} ·
                    ${a.findings?.length || 0} finding(s)
                  </div>
                </div>`,
                      )
                      .join("")
              }
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

/* ─── Recent sign-offs ──────────────────────────────────────────── */

function renderRecentSignoffs(verifications, orgName) {
  const accepted = verifications
    .filter((v) => v.status === "client-accepted")
    .sort((a, b) => (b.accepted_on || "").localeCompare(a.accepted_on || ""))
    .slice(0, 8);

  return `
    <div class="card">
      <h2>Accepted savings</h2>
      <p class="sub">
        Claims the client agreed. These are the only ones the pricing engine
        will bill a performance share against.
      </p>
      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Organisation</th><th>Period</th>
            <th class="num">Adjusted baseline</th><th class="num">Actual</th>
            <th class="num">Verified saving</th><th>Accepted</th>
          </tr>
        </thead>
        <tbody>
          ${
            accepted.length === 0
              ? emptyRow(6, "No accepted savings yet.")
              : accepted
                  .map(
                    (v) => `
            <tr>
              <td>${escapeHtml(v.organization_name || orgName(v.organization_id))}</td>
              <td class="nowrap">${formatPeriod(v.period)}</td>
              <td class="num">${formatKwh(v.adjusted_baseline_kwh)}</td>
              <td class="num">${formatKwh(v.actual_kwh)}</td>
              <td class="num" style="color:var(--pos);font-weight:700">
                ${formatKwh(v.saved_kwh)}
              </td>
              <td class="nowrap">${formatDate(v.accepted_on)}</td>
            </tr>`,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}
