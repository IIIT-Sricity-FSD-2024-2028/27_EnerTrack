/**
 * accountsPage.js
 * Account Officer — one client's contract.
 *
 * Everything on this page changes what the client is billed next month, so
 * each action says so plainly. The plan a contract sits on, the share
 * percentage, and the audit whose baseline savings are measured against are
 * the three levers; the rest is history.
 */
import {
  badge,
  emptyRow,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatKwh,
  formatNumber,
  formatPeriod,
  loadOrFail,
  requireAccountOfficer,
  showToast,
} from "./utils/utils.js";

const state = { orgs: [], subs: [], plans: [], audits: [], invoices: [], orgId: null };

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAccountOfficer()) return;

  const root = document.getElementById("aoApp");
  root.innerHTML = `<div class="card"><p class="muted">Loading accounts…</p></div>`;

  const [orgs, subs, plans, audits, invoices] = await Promise.all([
    loadOrFail(() => window.api.get("/organizations"), "organisations"),
    loadOrFail(() => window.api.get("/subscriptions"), "subscriptions"),
    loadOrFail(() => window.api.get("/subscription-plans"), "plans"),
    loadOrFail(() => window.api.get("/energy-audits"), "audits"),
    loadOrFail(() => window.api.get("/platform-invoices"), "invoices"),
  ]);

  if (!orgs) {
    root.innerHTML = `<div class="card"><h2>Backend unavailable</h2><p class="muted">Start the API on port 3000 and reload.</p></div>`;
    return;
  }

  Object.assign(state, {
    orgs,
    subs: subs || [],
    plans: plans || [],
    audits: audits || [],
    invoices: invoices || [],
  });

  const handed = localStorage.getItem("ao_selected_org");
  state.orgId =
    (handed && orgs.some((o) => o.organization_id === handed) && handed) ||
    state.subs[0]?.organization_id ||
    orgs[0]?.organization_id ||
    null;

  render();
});

const org = () => state.orgs.find((o) => o.organization_id === state.orgId) || null;
const sub = () => state.subs.find((s) => s.organization_id === state.orgId) || null;
const plan = () => state.plans.find((p) => p.plan_id === sub()?.plan_id) || null;
const audit = () =>
  state.audits.find((a) => a.audit_id === sub()?.baseline_audit_id) ||
  state.audits.find((a) => a.organization_id === state.orgId) ||
  null;

function render() {
  const root = document.getElementById("aoApp");
  const o = org();
  const s = sub();

  root.innerHTML = `
    <div class="card">
      <div class="toolbar" style="margin-bottom:0">
        <div class="field">
          <label for="orgPick">Client</label>
          <select id="orgPick">
            ${state.orgs
              .map(
                (x) =>
                  `<option value="${escapeHtml(x.organization_id)}" ${x.organization_id === state.orgId ? "selected" : ""}>
                     ${escapeHtml(x.name)}
                   </option>`,
              )
              .join("")}
          </select>
        </div>
      </div>
    </div>

    ${o ? renderOrg(o) : ""}
    ${s ? renderContract(s) : renderNoContract(o)}
    ${renderBaseline()}
    ${renderInvoices()}`;

  wire();
}

function renderOrg(o) {
  return `
    <div class="card">
      <div class="header-row">
        <div>
          <h2>${escapeHtml(o.name)}</h2>
          <p class="sub">${escapeHtml(o.type)} · ${escapeHtml(o.location ?? "—")}</p>
        </div>
        <div>${badge(o.status)}</div>
      </div>
      <dl class="dl" style="margin-top:14px">
        <dt>Floor area</dt><dd>${o.floor_area_sqm ? `${formatNumber(o.floor_area_sqm)} m²` : "—"}</dd>
        <dt>Tariff</dt><dd>${o.tariff_rate ? `₹${o.tariff_rate} / kWh` : "not set"}</dd>
        <dt>Metering</dt><dd>${escapeHtml(o.data_source_tier ?? "not assessed")}</dd>
        <dt>Contract start</dt><dd>${formatDate(o.contract_start)}</dd>
      </dl>
    </div>`;
}

function renderNoContract(o) {
  return `
    <div class="card">
      <h2>No contract</h2>
      <p class="sub">
        ${escapeHtml(o?.name ?? "This organisation")} has no active subscription.
        Nothing will be billed for it until one is opened.
      </p>
    </div>`;
}

function renderContract(s) {
  const p = plan();
  const share = s.performance_share_pct_override ?? p?.performance_share_pct ?? 0;

  return `
    <div class="card">
      <div class="header-row">
        <div><h2>Contract</h2><p class="sub">What this client is billed, and on what terms.</p></div>
        <div>${badge(s.status)}</div>
      </div>

      <div class="grid2" style="margin-top:16px">
        <dl class="dl">
          <dt>Plan</dt><dd>${escapeHtml(p?.name ?? s.plan_id)}</dd>
          <dt>Per meter</dt><dd>${formatCurrency(p?.price_per_meter_month)} / month</dd>
          <dt>Minimum fee</dt><dd>${formatCurrency(p?.min_monthly_fee)} / month</dd>
          <dt>Billing cycle</dt><dd>${escapeHtml(s.billing_cycle)}</dd>
        </dl>
        <dl class="dl">
          <dt>Performance share</dt>
          <dd>${share}%${s.performance_share_pct_override != null ? " (negotiated)" : ""}</dd>
          <dt>Share cap</dt><dd>${p?.share_cap_pct_of_subscription ?? "—"}% of subscription</dd>
          <dt>Audit fee</dt>
          <dd>${s.audit_fee_waived_on ? `waived ${formatDate(s.audit_fee_waived_on)}` : "payable on first invoice"}</dd>
          <dt>Renews</dt><dd>${formatDate(s.renews_on)}</dd>
        </dl>
      </div>

      <div class="section-title">Change the contract</div>
      <div class="toolbar">
        <div class="field">
          <label for="planPick">Move to plan</label>
          <select id="planPick">
            ${state.plans
              .filter((x) => x.is_active || x.plan_id === s.plan_id)
              .map(
                (x) =>
                  `<option value="${escapeHtml(x.plan_id)}" ${x.plan_id === s.plan_id ? "selected" : ""}>
                     ${escapeHtml(x.name)} — ${formatCurrency(x.price_per_meter_month)}/meter
                   </option>`,
              )
              .join("")}
          </select>
        </div>
        <button class="btn btn-dark" type="button" id="changePlan">Change plan</button>
        <button class="btn btn-light" type="button" id="renew">Renew a year</button>
        <button class="btn btn-light" type="button" id="waive"
                ${s.audit_fee_waived_on ? "disabled" : ""}>Waive audit fee</button>
        <button class="btn btn-red" type="button" id="cancel"
                ${s.status === "cancelled" ? "disabled" : ""}>Cancel</button>
      </div>
      <p class="muted" style="font-size:12px">
        A plan change takes effect on the next invoice generated. Invoices
        already raised are not restated.
      </p>
    </div>`;
}

function renderBaseline() {
  const a = audit();
  if (!a) {
    return `
      <div class="card">
        <h2>Baseline</h2>
        <p class="sub">No audit engagement recorded for this client.</p>
      </div>`;
  }

  if (!a.baseline?.locked) {
    return `
      <div class="card">
        <h2>Baseline</h2>
        <p class="sub">
          Engagement is ${escapeHtml(a.status)} with no locked baseline, so no
          performance share can be billed for this client yet.
        </p>
      </div>`;
  }

  const b = a.baseline;
  const accepted = (a.verifications || []).filter((v) => v.status === "client-accepted");

  return `
    <div class="card">
      <h2>Baseline</h2>
      <p class="sub">
        Locked ${formatDate(b.locked_on)} over ${formatPeriod(b.period_from)}–${formatPeriod(b.period_to)}.
        Every savings claim for this client is measured against it.
      </p>
      <div class="grid2" style="margin-top:14px">
        <dl class="dl">
          <dt>Consumption</dt><dd>${formatKwh(b.baseline_kwh)} / month</dd>
          <dt>Cost</dt><dd>${formatCurrency(b.baseline_cost)} / month</dd>
        </dl>
        <dl class="dl">
          <dt>Accepted claims</dt><dd>${accepted.length}</dd>
          <dt>Savings accepted</dt>
          <dd>${formatKwh(accepted.reduce((sum, v) => sum + (v.saved_kwh || 0), 0))}</dd>
        </dl>
      </div>
    </div>`;
}

function renderInvoices() {
  const rows = state.invoices
    .filter((i) => i.organization_id === state.orgId)
    .sort((a, b) => b.period.localeCompare(a.period));

  return `
    <div class="card">
      <h2>Billing history</h2>
      <p class="sub">EnerTrack's invoices to this client.</p>
      <table style="margin-top:14px">
        <thead><tr>
          <th>Period</th><th>Status</th><th>Lines</th>
          <th class="num">Subtotal</th><th class="num">Total</th><th>Paid</th>
        </tr></thead>
        <tbody>
          ${
            rows.length === 0
              ? emptyRow(6, "Nothing billed to this client yet.")
              : rows
                  .map(
                    (i) => `
            <tr>
              <td class="nowrap">${formatPeriod(i.period)}</td>
              <td>${badge(i.status)}</td>
              <td style="font-size:12px">
                ${i.line_items.map((l) => escapeHtml(l.type)).join(", ")}
              </td>
              <td class="num">${formatCurrency(i.subtotal)}</td>
              <td class="num">${formatCurrency(i.total)}</td>
              <td class="nowrap">${formatDate(i.paid_on)}</td>
            </tr>`,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}

/* ─── Wiring ────────────────────────────────────────────────────── */

function wire() {
  const root = document.getElementById("aoApp");

  root.querySelector("#orgPick")?.addEventListener("change", (e) => {
    state.orgId = e.target.value;
    localStorage.setItem("ao_selected_org", state.orgId);
    render();
  });

  const s = sub();
  if (!s) return;

  root.querySelector("#changePlan")?.addEventListener("click", async () => {
    const planId = document.getElementById("planPick").value;
    if (planId === s.plan_id) {
      showToast("Already on that plan.", "info");
      return;
    }
    await act(() => window.api.patch(`/subscriptions/${s.subscription_id}/change-plan`, { plan_id: planId }), "Plan changed.");
  });

  root.querySelector("#renew")?.addEventListener("click", () =>
    act(() => window.api.patch(`/subscriptions/${s.subscription_id}/renew`, {}), "Contract renewed."),
  );

  root.querySelector("#waive")?.addEventListener("click", () =>
    act(
      () => window.api.patch(`/subscriptions/${s.subscription_id}/waive-audit-fee`, {}),
      "Audit fee waived — it will not appear on the first invoice.",
    ),
  );

  root.querySelector("#cancel")?.addEventListener("click", () => {
    if (!window.confirm("Cancel this contract? Billing history is kept.")) return;
    act(() => window.api.patch(`/subscriptions/${s.subscription_id}/cancel`, {}), "Contract cancelled.");
  });
}

async function act(fn, message) {
  try {
    const updated = await fn();
    const index = state.subs.findIndex(
      (s) => s.subscription_id === updated.subscription_id,
    );
    if (index !== -1) state.subs[index] = updated;
    showToast(message, "success");
    render();
  } catch (err) {
    showToast(err.message, "error", 6000);
  }
}
