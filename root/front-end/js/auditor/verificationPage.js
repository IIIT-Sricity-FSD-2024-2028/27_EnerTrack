/**
 * verificationPage.js
 * Certified Energy Auditor — savings verification.
 *
 * The page exists to make one comparison impossible to miss: what a naive
 * baseline-minus-actual would have claimed, against what is actually
 * defensible once the baseline is restated for the month's weather,
 * occupancy and floor area.
 *
 * Showing both is a deliberate choice. The auditor works for the party paid
 * a share of the result, so hiding the size of the adjustment inside a
 * single number would leave the client signing something they cannot check.
 * The bars, and the "a naive calculation would have claimed…" line, are the
 * honest version.
 *
 * Note what this page cannot do: make a claim billable. Signing moves it to
 * auditor-signed and no further. The client accepts it from their own
 * dashboard, and until they do the pricing engine ignores it entirely.
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
  requireAuditor,
  showToast,
} from "./utils/utils.js";

const state = {
  user: null,
  audits: [],
  orgs: [],
  selectedId: null,
  period: defaultPeriod(),
  draft: null,
};

/** Last complete month, which is the one an auditor normally verifies. */
function defaultPeriod() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  state.user = requireAuditor();
  if (!state.user) return;

  const root = document.getElementById("auditorApp");
  root.innerHTML = `<div class="card"><p class="muted">Loading engagements…</p></div>`;

  const [audits, orgs] = await Promise.all([
    loadOrFail(() => window.api.get("/energy-audits"), "audits"),
    loadOrFail(() => window.api.get("/organizations"), "organisations"),
  ]);

  if (!audits) {
    root.innerHTML = `<div class="card"><h2>Backend unavailable</h2><p class="muted">Start the API on port 3000 and reload.</p></div>`;
    return;
  }

  state.audits = audits.filter((a) => a.baseline?.locked);
  state.orgs = orgs || [];
  state.selectedId = state.audits[0]?.audit_id ?? null;

  render();
});

const selected = () =>
  state.audits.find((a) => a.audit_id === state.selectedId) || null;

const orgName = (id) =>
  state.orgs.find((o) => o.organization_id === id)?.name ?? id;

function render() {
  const root = document.getElementById("auditorApp");

  if (state.audits.length === 0) {
    root.innerHTML = `
      <div class="card">
        <h2>No locked baselines</h2>
        <p class="sub">
          Savings can only be verified against a locked baseline. Lock one on
          the Audits &amp; Baselines page first.
        </p>
      </div>`;
    return;
  }

  const audit = selected();

  root.innerHTML = `
    <div class="card">
      <div class="toolbar" style="margin-bottom:0">
        <div class="field">
          <label for="auditPick">Client</label>
          <select id="auditPick">
            ${state.audits
              .map(
                (a) =>
                  `<option value="${escapeHtml(a.audit_id)}" ${a.audit_id === state.selectedId ? "selected" : ""}>
                     ${escapeHtml(orgName(a.organization_id))}
                   </option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="periodPick">Period</label>
          <input id="periodPick" type="month" value="${state.period}" />
        </div>
        <button class="btn btn-dark" type="button" id="compute">Compute savings</button>
      </div>
    </div>

    ${state.draft ? renderDraft(audit, state.draft) : renderPrompt()}
    ${renderHistory(audit)}`;

  wire();
}

function renderPrompt() {
  return `
    <div class="card">
      <p class="muted" style="font-size:13px">
        Pick a client and a month, then press <strong>Compute savings</strong>.
        Nothing is saved until you choose to record it.
      </p>
    </div>`;
}

/* ─── The comparison ────────────────────────────────────────────── */

function renderDraft(audit, d) {
  // Bars are scaled against the largest figure on screen so the three are
  // directly comparable by eye.
  const max = Math.max(d.raw_baseline_kwh, d.adjusted_baseline_kwh, d.actual_kwh, 1);
  const pct = (v) => `${Math.max(2, (v / max) * 100).toFixed(1)}%`;

  const adjustedDown = d.adjustment_kwh < 0;
  const overclaim = d.unadjusted_saved_kwh - d.saved_kwh;

  return `
    <div class="card">
      <div class="header-row">
        <div>
          <h2>${escapeHtml(orgName(audit.organization_id))} — ${formatPeriod(d.period)}</h2>
          <p class="sub">
            Crediting ${d.finding_ids.length} implemented measure(s) across
            ${d.meter_ids.length} meter(s).
            ${d.scope_share < 0.999 ? `Those meters account for ${(d.scope_share * 100).toFixed(0)}% of the baseline estate, so the baseline is scoped to match.` : ""}
          </p>
        </div>
      </div>

      <div class="compare" style="margin-top:20px">
        ${bar(
          "Baseline",
          "As locked, scoped to the credited meters",
          "raw",
          pct(d.raw_baseline_kwh),
          formatKwh(d.raw_baseline_kwh),
        )}
        ${bar(
          "Adjusted baseline",
          `Restated for ${formatNumber(d.actual_factors.cooling_degree_days)} CDD and occupancy ${d.actual_factors.occupancy_index}`,
          "adjusted",
          pct(d.adjusted_baseline_kwh),
          formatKwh(d.adjusted_baseline_kwh),
        )}
        ${bar(
          "Actual consumption",
          "Metered this period",
          "actual",
          pct(d.actual_kwh),
          formatKwh(d.actual_kwh),
        )}
        ${bar(
          "Verified saving",
          "Adjusted baseline minus actual",
          "saved",
          pct(d.saved_kwh),
          formatKwh(d.saved_kwh),
        )}
      </div>

      <div class="callout ${overclaim > 0 ? "warn" : "good"}" style="margin-top:20px">
        ${
          overclaim > 0
            ? `A naive baseline-minus-actual would have claimed
               <strong>${formatKwh(d.unadjusted_saved_kwh)}</strong>
               (${formatCurrency(d.unadjusted_saved_amount)}). The month ran
               ${adjustedDown ? "milder" : "differently"} than the baseline window,
               and ${formatKwh(overclaim)} of that drop is weather and occupancy
               rather than anything the client's measures achieved. It is not
               billed.`
            : `The adjustment moved the baseline
               <strong>${adjustedDown ? "down" : "up"} by ${formatKwh(Math.abs(d.adjustment_kwh))}</strong>.
               This month ran harder than the baseline window, so the client is
               credited with more than a raw comparison would have given them.`
        }
      </div>

      <div class="grid2" style="margin-top:20px">
        <dl class="dl">
          <dt>Verified saving</dt>
          <dd style="color:var(--pos);font-weight:700">
            ${formatKwh(d.saved_kwh)} · ${formatCurrency(d.saved_amount)}
          </dd>
          <dt>Cooling degree days</dt><dd>${formatNumber(d.actual_factors.cooling_degree_days)}</dd>
          <dt>Occupancy index</dt><dd>${d.actual_factors.occupancy_index}</dd>
          <dt>Floor area</dt><dd>${formatNumber(d.actual_factors.floor_area_sqm)} m²</dd>
        </dl>
        <div>
          <div class="callout">
            Signing records your professional opinion. It does
            <strong>not</strong> make this billable — the client counter-signs
            from their own dashboard, and the pricing engine bills nothing
            until they do.
          </div>
          <button class="btn btn-green btn-full" type="button" id="recordAndSign"
                  ${d.claimable ? "" : "disabled"} style="margin-top:12px">
            Record and sign this verification
          </button>
          ${
            !d.claimable
              ? `<p class="muted" style="font-size:12px;margin-top:8px">
                   ${
                     d.finding_ids.length === 0
                       ? "Nothing to claim: no implemented measure covered this period."
                       : "Nothing to claim: consumption did not fall below the adjusted baseline."
                   }
                 </p>`
              : ""
          }
        </div>
      </div>
    </div>`;
}

function bar(label, sub, tone, width, value) {
  return `
    <div class="cmp-row">
      <div class="cmp-label">${escapeHtml(label)}<small>${escapeHtml(sub)}</small></div>
      <div class="cmp-track"><div class="cmp-fill ${tone}" style="width:${width}"></div></div>
      <div class="cmp-value">${value}</div>
    </div>`;
}

/* ─── History ───────────────────────────────────────────────────── */

function renderHistory(audit) {
  const rows = [...(audit?.verifications || [])].sort((a, b) =>
    b.period.localeCompare(a.period),
  );

  return `
    <div class="card">
      <h2>Verification history</h2>
      <p class="sub">
        Only <strong>client-accepted</strong> rows reach an invoice. Signed and
        disputed ones are work EnerTrack cannot bill.
      </p>
      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Period</th><th>Status</th>
            <th class="num">Adjusted baseline</th><th class="num">Actual</th>
            <th class="num">Saved</th><th class="num">Value</th>
            <th>Signed</th><th>Accepted</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length === 0
              ? emptyRow(9, "No verifications recorded for this client.")
              : rows
                  .map(
                    (v) => `
            <tr>
              <td class="nowrap">${formatPeriod(v.period)}</td>
              <td>${badge(v.status)}</td>
              <td class="num">${formatKwh(v.adjusted_baseline_kwh)}</td>
              <td class="num">${formatKwh(v.actual_kwh)}</td>
              <td class="num">${formatKwh(v.saved_kwh)}</td>
              <td class="num">${formatCurrency(v.saved_amount)}</td>
              <td class="nowrap">${formatDate(v.signed_on)}</td>
              <td class="nowrap">${formatDate(v.accepted_on)}</td>
              <td class="table-actions">
                ${
                  v.status === "draft"
                    ? `<button class="btn btn-dark" type="button" data-sign="${escapeHtml(v.verification_id)}">Sign</button>`
                    : ""
                }
              </td>
            </tr>
            ${
              v.status === "disputed"
                ? `<tr><td colspan="9" style="border-top:none;padding-top:0">
                     <div class="callout warn">
                       Disputed ${formatDate(v.disputed_on)}:
                       ${escapeHtml(v.dispute_reason || "no reason given")}
                     </div></td></tr>`
                : ""
            }`,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}

/* ─── Wiring ────────────────────────────────────────────────────── */

function wire() {
  const root = document.getElementById("auditorApp");

  root.querySelector("#auditPick")?.addEventListener("change", (e) => {
    state.selectedId = e.target.value;
    state.draft = null;
    render();
  });

  root.querySelector("#periodPick")?.addEventListener("change", (e) => {
    state.period = e.target.value;
    state.draft = null;
  });

  root.querySelector("#compute")?.addEventListener("click", compute);
  root.querySelector("#recordAndSign")?.addEventListener("click", recordAndSign);

  root.querySelectorAll("[data-sign]").forEach((btn) => {
    btn.onclick = () => sign(btn.dataset.sign);
  });
}

async function compute() {
  const audit = selected();
  const period = document.getElementById("periodPick").value;
  if (!period) {
    showToast("Choose a period.", "warning");
    return;
  }
  state.period = period;

  try {
    state.draft = await window.api.get(
      `/energy-audits/${audit.audit_id}/verification-suggestion?period=${period}`,
    );
    render();
  } catch (err) {
    state.draft = null;
    showToast(err.message, "error", 7000);
    render();
  }
}

async function recordAndSign() {
  const audit = selected();

  try {
    const created = await window.api.post(
      `/energy-audits/${audit.audit_id}/verifications`,
      { period: state.period },
    );
    const signed = await window.api.patch(
      `/energy-audits/${audit.audit_id}/verifications/${created.verification_id}/sign`,
      { signed_by: state.user.user_id },
    );

    audit.verifications.push(signed);
    state.draft = null;
    showToast(
      "Signed. It now needs the client's acceptance before it can be billed.",
      "success",
      6000,
    );
    render();
  } catch (err) {
    showToast(err.message, "error", 7000);
  }
}

async function sign(verificationId) {
  const audit = selected();
  try {
    const signed = await window.api.patch(
      `/energy-audits/${audit.audit_id}/verifications/${verificationId}/sign`,
      { signed_by: state.user.user_id },
    );
    const existing = audit.verifications.find(
      (v) => v.verification_id === verificationId,
    );
    Object.assign(existing, signed);
    showToast("Signed. Awaiting client acceptance.", "success");
    render();
  } catch (err) {
    showToast(err.message, "error", 7000);
  }
}
