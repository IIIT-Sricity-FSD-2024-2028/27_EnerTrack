/**
 * overviewPage.js
 * Certified Energy Auditor — portfolio overview.
 *
 * Two questions, in the order they matter: where is every engagement up to,
 * and did the recommendations actually work.
 *
 * The second one is why this page exists. An auditor writing measures that
 * nobody implements, or that get implemented and change nothing, has no way
 * to know it — so the impact panel pulls each client's consumption against
 * the same month a year earlier and shows the answer. That figure is
 * reported, never billed: EnerTrack charges a subscription, so this is
 * evidence the service works rather than the basis of an invoice.
 */
import {
  badge,
  emptyRow,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatKwh,
  loadOrFail,
  requireAuditor,
} from "./utils/utils.js";

const STAGES = [
  { key: "scheduled", label: "Scheduled" },
  { key: "in-progress", label: "In progress" },
  { key: "completed", label: "Completed" },
];

/** Rolling window the impact panel compares over. */
const IMPACT_FROM = "2026-03";
const IMPACT_TO = "2026-08";

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuditor()) return;

  const root = document.getElementById("auditorApp");
  root.innerHTML = `<div class="card"><p class="muted">Loading portfolio…</p></div>`;

  const [audits, orgs] = await Promise.all([
    loadOrFail(() => window.api.get("/energy-audits"), "audits"),
    loadOrFail(() => window.api.get("/organizations"), "organisations"),
  ]);

  if (!audits) {
    root.innerHTML = `<div class="card"><h2>Backend unavailable</h2><p class="muted">Start the API on port 3000 and reload.</p></div>`;
    return;
  }

  const orgName = (id) =>
    (orgs || []).find((o) => o.organization_id === id)?.name ?? id;

  // Savings are per-organisation, so only ask for the ones actually audited.
  const auditedOrgs = [...new Set(audits.map((a) => a.organization_id))];
  const savings = await Promise.all(
    auditedOrgs.map((id) =>
      window.api
        .get(`/organizations/${id}/savings?from=${IMPACT_FROM}&to=${IMPACT_TO}`)
        .catch(() => null),
    ),
  );
  const savingsByOrg = Object.fromEntries(
    auditedOrgs.map((id, i) => [id, savings[i]]),
  );

  root.innerHTML = [
    renderKpis(audits, savingsByOrg),
    renderImpact(audits, savingsByOrg, orgName),
    renderPipeline(audits, orgName),
    renderOutstanding(audits, orgName),
  ].join("");

  root.querySelectorAll("[data-audit]").forEach((el) => {
    el.addEventListener("click", () => {
      localStorage.setItem("auditor_selected_audit", el.dataset.audit);
      window.location.href = "auditor_audits.html";
    });
  });
});

function renderKpis(audits, savingsByOrg) {
  const open = audits.filter((a) => a.status !== "completed").length;
  const findings = audits.flatMap((a) => a.findings || []);
  const implemented = findings.filter((f) => f.status === "implemented");

  const savedKwh = Object.values(savingsByOrg).reduce(
    (sum, s) => sum + Math.max(0, s?.saved_kwh || 0),
    0,
  );
  const savedAmount = Object.values(savingsByOrg).reduce(
    (sum, s) => sum + Math.max(0, s?.saved_amount || 0),
    0,
  );

  return `
    <div class="grid4" style="margin-bottom:20px">
      ${kpi("Open engagements", open, `${audits.length} in total`)}
      ${kpi(
        "Recommendations",
        findings.length,
        `${implemented.length} carried out by clients`,
      )}
      ${kpi("Energy saved", formatKwh(savedKwh), "Against the same months last year", "pos")}
      ${kpi("Worth to clients", formatCurrency(savedAmount), "At their own tariffs", "pos")}
    </div>`;
}

function kpi(label, value, note, tone = "") {
  return `
    <div class="kpi">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value ${tone}" style="font-size:23px">${value}</div>
      <div class="kpi-note">${escapeHtml(note)}</div>
    </div>`;
}

/**
 * Did the work land?
 *
 * Consumption for March–August 2026 against the same months of 2025. Like
 * months against like months, which is what makes the comparison fair
 * without any weather modelling — a campus uses far more in May than in
 * December, so only May against May tells you anything.
 */
function renderImpact(audits, savingsByOrg, orgName) {
  const rows = audits
    .filter((a) => a.status === "completed")
    .map((a) => ({
      audit: a,
      s: savingsByOrg[a.organization_id],
      done: (a.findings || []).filter((f) => f.status === "implemented").length,
    }));

  return `
    <div class="card">
      <h2>Did it work?</h2>
      <p class="sub">
        March–August 2026 against the same months of 2025. Comparing like
        months cancels the seasons, so what is left is the change your
        recommendations made.
      </p>
      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Client</th><th class="num">Measures done</th>
            <th class="num">Last year</th><th class="num">This year</th>
            <th class="num">Change</th><th class="num">Worth</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length === 0
              ? emptyRow(6, "No completed engagements yet.")
              : rows
                  .map(({ audit, s, done }) => {
                    if (!s || !s.has_comparison)
                      return `
              <tr>
                <td>${escapeHtml(orgName(audit.organization_id))}</td>
                <td class="num">${done}</td>
                <td colspan="4" class="muted" style="font-size:12px">
                  Not enough history to compare year on year yet.
                </td>
              </tr>`;

                    const improved = s.saved_kwh > 0;
                    return `
              <tr>
                <td>${escapeHtml(orgName(audit.organization_id))}</td>
                <td class="num">${done}</td>
                <td class="num">${formatKwh(s.kwh_year_ago)}</td>
                <td class="num">${formatKwh(s.kwh)}</td>
                <td class="num" style="font-weight:700;color:${improved ? "var(--pos)" : "var(--muted)"}">
                  ${s.change_pct}%
                </td>
                <td class="num" style="color:${improved ? "var(--pos)" : "var(--muted)"}">
                  ${improved ? formatCurrency(s.saved_amount) : "—"}
                </td>
              </tr>`;
                  })
                  .join("")
          }
        </tbody>
      </table>
      <p class="muted" style="font-size:12px;margin-top:12px">
        A client that has implemented nothing should read close to flat. That
        is the check that this number tracks the work rather than the calendar.
      </p>
    </div>`;
}

function renderPipeline(audits, orgName) {
  return `
    <div class="card">
      <h2>Engagement pipeline</h2>
      <p class="sub">Click an engagement to open its survey and recommendations.</p>
      <div class="pipeline" style="margin-top:14px;grid-template-columns:repeat(3,1fr)">
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
                    ${(a.findings || []).length} recommendation(s) ·
                    ${a.conducted_on ? `visited ${formatDate(a.conducted_on)}` : `due ${formatDate(a.scheduled_on)}`}
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

/** Measures a client has agreed to but not yet acted on. */
function renderOutstanding(audits, orgName) {
  const rows = audits.flatMap((a) =>
    (a.findings || [])
      .filter((f) => f.status === "proposed" || f.status === "accepted")
      .map((f) => ({ ...f, organization_id: a.organization_id })),
  );

  return `
    <div class="card">
      <h2>Still to be done</h2>
      <p class="sub">
        Recommendations no client has carried out yet — the savings sitting
        unclaimed, and the thing worth raising at the next visit.
      </p>
      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Client</th><th>Measure</th><th>Severity</th><th>Status</th>
            <th class="num">Est. annual saving</th><th class="num">Payback</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length === 0
              ? emptyRow(6, "Every recommendation has been acted on.")
              : rows
                  .map(
                    (f) => `
            <tr>
              <td>${escapeHtml(orgName(f.organization_id))}</td>
              <td style="max-width:300px">${escapeHtml(f.title)}</td>
              <td>${badge(f.severity)}</td>
              <td>${badge(f.status)}</td>
              <td class="num">${formatCurrency(f.est_annual_saving)}</td>
              <td class="num">${f.payback_months || "—"} mo</td>
            </tr>`,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}
