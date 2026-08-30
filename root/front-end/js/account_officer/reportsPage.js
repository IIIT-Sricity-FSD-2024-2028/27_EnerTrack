/**
 * reportsPage.js
 * Account Officer — per-client savings reporting.
 *
 * The renewal conversation, in one table. For each verified month it shows
 * what the client saved, what EnerTrack charged for it, and — the number
 * that actually persuades — what the client kept.
 *
 * It also shows the adjustment openly rather than burying it. A client who
 * can see that EnerTrack voluntarily gave back the mild-weather share of a
 * claim tends to accept the next one without an argument, so the honest
 * number is also the commercially useful one.
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
  requireAccountOfficer,
} from "./utils/utils.js";

const state = { orgs: [], audits: [], subs: [], plans: [], invoices: [], orgId: null };

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAccountOfficer()) return;

  const root = document.getElementById("aoApp");
  root.innerHTML = `<div class="card"><p class="muted">Loading savings reporting…</p></div>`;

  const [orgs, audits, subs, plans, invoices] = await Promise.all([
    loadOrFail(() => window.api.get("/organizations"), "organisations"),
    loadOrFail(() => window.api.get("/energy-audits"), "audits"),
    loadOrFail(() => window.api.get("/subscriptions"), "subscriptions"),
    loadOrFail(() => window.api.get("/subscription-plans"), "plans"),
    loadOrFail(() => window.api.get("/platform-invoices"), "invoices"),
  ]);

  if (!orgs) {
    root.innerHTML = `<div class="card"><h2>Backend unavailable</h2><p class="muted">Start the API on port 3000 and reload.</p></div>`;
    return;
  }

  Object.assign(state, {
    orgs,
    audits: audits || [],
    subs: subs || [],
    plans: plans || [],
    invoices: invoices || [],
  });
  state.orgId =
    localStorage.getItem("ao_selected_org") || orgs[0]?.organization_id || null;

  render();
});

const org = () => state.orgs.find((o) => o.organization_id === state.orgId) || null;
const sub = () => state.subs.find((s) => s.organization_id === state.orgId) || null;
const plan = () => state.plans.find((p) => p.plan_id === sub()?.plan_id) || null;
const audits = () => state.audits.filter((a) => a.organization_id === state.orgId);

function verifications() {
  return audits()
    .flatMap((a) => a.verifications || [])
    .sort((a, b) => b.period.localeCompare(a.period));
}

function render() {
  const root = document.getElementById("aoApp");
  const sharePct =
    sub()?.performance_share_pct_override ?? plan()?.performance_share_pct ?? 0;

  root.innerHTML = `
    <div class="card">
      <div class="toolbar" style="margin-bottom:0">
        <div class="field">
          <label for="orgPick">Client</label>
          <select id="orgPick">
            ${state.orgs
              .map(
                (o) =>
                  `<option value="${escapeHtml(o.organization_id)}" ${o.organization_id === state.orgId ? "selected" : ""}>
                     ${escapeHtml(o.name)}
                   </option>`,
              )
              .join("")}
          </select>
        </div>
      </div>
    </div>

    ${renderHeadline(sharePct)}
    ${renderLedger(sharePct)}
    ${renderFindings()}`;

  document.getElementById("orgPick")?.addEventListener("change", (e) => {
    state.orgId = e.target.value;
    localStorage.setItem("ao_selected_org", state.orgId);
    render();
  });
}

function renderHeadline(sharePct) {
  const all = verifications();
  const accepted = all.filter((v) => v.status === "client-accepted");

  const savedAmount = accepted.reduce((sum, v) => sum + (v.saved_amount || 0), 0);
  const savedKwh = accepted.reduce((sum, v) => sum + (v.saved_kwh || 0), 0);
  const shareBilled = Math.round(savedAmount * (sharePct / 100));
  const kept = savedAmount - shareBilled;

  const givenBack = accepted.reduce(
    (sum, v) => sum + Math.max(0, v.raw_baseline_kwh - v.adjusted_baseline_kwh),
    0,
  );

  return `
    <div class="grid4" style="margin-bottom:20px">
      ${tile("Verified savings", formatKwh(savedKwh), `${accepted.length} accepted month(s)`, "pos")}
      ${tile("Value to client", formatCurrency(savedAmount), "At their tariff")}
      ${tile("EnerTrack share", formatCurrency(shareBilled), `${sharePct}% of accepted savings`)}
      ${tile("Client keeps", formatCurrency(kept), `${savedAmount > 0 ? Math.round((kept / savedAmount) * 100) : 0}% of the benefit`, "pos")}
    </div>

    ${
      givenBack > 0
        ? `<div class="callout" style="margin-bottom:20px">
             Across accepted months, the weather and occupancy adjustment
             reduced the claimable baseline by <strong>${formatKwh(givenBack)}</strong>
             in total. That is consumption the client would have avoided
             anyway, and EnerTrack did not bill a share of it. It is worth
             saying out loud in a renewal conversation.
           </div>`
        : ""
    }`;
}

function tile(label, value, note, tone = "") {
  return `
    <div class="kpi">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value ${tone}" style="font-size:22px">${value}</div>
      <div class="kpi-note">${escapeHtml(note)}</div>
    </div>`;
}

function renderLedger(sharePct) {
  const rows = verifications();

  return `
    <div class="card">
      <h2>Month by month</h2>
      <p class="sub">
        Only accepted months are billed. Signed and disputed ones are shown so
        the gap between what was verified and what was invoiced is visible.
      </p>
      <table style="margin-top:14px">
        <thead><tr>
          <th>Period</th><th>Status</th>
          <th class="num">Baseline</th><th class="num">Adjusted</th>
          <th class="num">Actual</th><th class="num">Saved</th>
          <th class="num">Value</th><th class="num">Share billed</th>
        </tr></thead>
        <tbody>
          ${
            rows.length === 0
              ? emptyRow(8, "No savings verified for this client yet.")
              : rows
                  .map((v) => {
                    const billed = v.status === "client-accepted";
                    return `
              <tr>
                <td class="nowrap">${formatPeriod(v.period)}</td>
                <td>${badge(v.status)}</td>
                <td class="num">${formatKwh(v.raw_baseline_kwh)}</td>
                <td class="num">${formatKwh(v.adjusted_baseline_kwh)}</td>
                <td class="num">${formatKwh(v.actual_kwh)}</td>
                <td class="num">${formatKwh(v.saved_kwh)}</td>
                <td class="num">${formatCurrency(v.saved_amount)}</td>
                <td class="num" style="${billed ? "font-weight:700" : "color:var(--muted)"}">
                  ${billed ? formatCurrency(v.saved_amount * (sharePct / 100)) : "not billed"}
                </td>
              </tr>`;
                  })
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}

function renderFindings() {
  const all = audits().flatMap((a) => a.findings || []);
  const implemented = all.filter(
    (f) => f.status === "implemented" || f.status === "verified",
  );
  const outstanding = all.filter(
    (f) => f.status === "proposed" || f.status === "accepted",
  );

  return `
    <div class="card">
      <h2>Recommendations</h2>
      <p class="sub">
        ${implemented.length} of ${all.length} implemented.
        ${
          outstanding.length
            ? `${formatCurrency(outstanding.reduce((s, f) => s + (f.est_annual_saving || 0), 0))} of estimated annual saving is still on the table — the strongest renewal argument there is.`
            : "Everything recommended has been acted on."
        }
      </p>
      <table style="margin-top:14px">
        <thead><tr>
          <th>Measure</th><th>Category</th><th>Status</th>
          <th class="num">Est. annual saving</th><th class="num">Capex</th><th>Implemented</th>
        </tr></thead>
        <tbody>
          ${
            all.length === 0
              ? emptyRow(6, "No recommendations recorded.")
              : all
                  .map(
                    (f) => `
            <tr>
              <td style="max-width:300px">${escapeHtml(f.title)}</td>
              <td>${escapeHtml(f.category)}</td>
              <td><span class="badge ${f.status === "verified" || f.status === "implemented" ? "resolved" : "new"}">${escapeHtml(f.status)}</span></td>
              <td class="num">${formatCurrency(f.est_annual_saving)}</td>
              <td class="num">${formatCurrency(f.capex)}</td>
              <td class="nowrap">${f.implemented_on ? formatDate(f.implemented_on) : "—"}</td>
            </tr>`,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}
