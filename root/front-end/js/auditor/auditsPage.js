/**
 * auditsPage.js
 * Certified Energy Auditor — site survey and baseline workspace.
 *
 * The important interaction on this page is the baseline. The auditor does
 * NOT type a baseline in: they choose a window, the platform aggregates the
 * meter readings and the weather and occupancy figures for that window, and
 * the auditor confirms or rejects what came back.
 *
 * That ordering is deliberate. The baseline is what every future savings
 * claim — and therefore every performance-share invoice line — is measured
 * against, which makes a hand-entered one the single easiest place to
 * quietly inflate EnerTrack's own revenue. Locking is one-way for the same
 * reason: a baseline that can be edited after claims have been made against
 * it is not a baseline.
 */
import {
  badge,
  currentUser,
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
  suggestion: null,
};

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

  state.audits = audits;
  state.orgs = orgs || [];

  // Prefer whatever the overview page handed over, then fall back to the
  // first engagement that still has work to do.
  const handed = localStorage.getItem("auditor_selected_audit");
  state.selectedId =
    (handed && audits.some((a) => a.audit_id === handed) && handed) ||
    audits.find((a) => !a.baseline?.locked)?.audit_id ||
    audits[0]?.audit_id ||
    null;

  render();
});

function selected() {
  return state.audits.find((a) => a.audit_id === state.selectedId) || null;
}

function orgOf(audit) {
  return state.orgs.find((o) => o.organization_id === audit?.organization_id) || null;
}

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

/* ─── Engagement picker ─────────────────────────────────────────── */

function renderList() {
  return `
    <div class="card">
      <h2>Engagements</h2>
      <p class="sub">Across every client.</p>
      <div class="pick-list" style="margin-top:12px">
        ${state.audits
          .map((a) => {
            const org = orgOf(a);
            return `
          <div class="pick ${a.audit_id === state.selectedId ? "active" : ""}"
               data-select="${escapeHtml(a.audit_id)}">
            <div class="pick-title">
              <span>${escapeHtml(org?.name ?? a.organization_id)}</span>
              ${badge(a.status)}
            </div>
            <div class="pick-meta">
              ${a.baseline?.locked ? `Baseline ${formatPeriod(a.baseline.period_from)}–${formatPeriod(a.baseline.period_to)}` : "No baseline"}
              · ${a.findings?.length || 0} finding(s)
            </div>
          </div>`;
          })
          .join("")}
      </div>
    </div>`;
}

/* ─── Workspace ─────────────────────────────────────────────────── */

function renderWorkspace(audit) {
  const org = orgOf(audit);
  return `
    <div class="card">
      <div class="header-row">
        <div>
          <h2>${escapeHtml(org?.name ?? audit.organization_id)}</h2>
          <p class="sub">
            ${escapeHtml(org?.type ?? "—")} · ${escapeHtml(org?.location ?? "—")}
            · tariff ${org?.tariff_rate ? `₹${org.tariff_rate}/kWh` : "not set"}
          </p>
        </div>
        <div>${badge(audit.status)}</div>
      </div>
    </div>

    ${renderSurvey(audit)}
    ${audit.baseline?.locked ? renderLockedBaseline(audit) : renderBaselineBuilder(audit)}
    ${renderStatusActions(audit)}`;
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
          <input id="svBuildings" name="buildings_surveyed" type="number" min="0"
                 value="${s.buildings_surveyed ?? 0}" />
        </div>
        <div class="field">
          <label for="svMeters">Meters located</label>
          <input id="svMeters" name="meters_found" type="number" min="0"
                 value="${s.meters_found ?? 0}" />
        </div>
        <div class="field">
          <label for="svTier">Existing metering</label>
          <select id="svTier" name="data_source_tier">
            ${["", "bms-integration", "manual-upload", "no-metering"]
              .map(
                (t) =>
                  `<option value="${t}" ${s.data_source_tier === t ? "selected" : ""}>${t || "— not assessed —"}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="svArea">Floor area (m²)</label>
          <input id="svArea" name="floor_area_sqm" type="number" min="0"
                 value="${s.floor_area_sqm ?? 0}" />
        </div>
      </div>
      <div class="field">
        <label for="svNotes">Notes</label>
        <textarea id="svNotes" name="notes">${escapeHtml(s.notes ?? "")}</textarea>
      </div>
      <button class="btn btn-dark" type="button" id="saveSurvey">Save survey</button>
    </div>`;
}

/* ─── Baseline: build ───────────────────────────────────────────── */

function renderBaselineBuilder(audit) {
  const sug = state.suggestion;

  return `
    <div class="card">
      <h2>Establish the baseline</h2>
      <p class="sub">
        Choose a window of at least six months of clean readings. The platform
        computes the average monthly consumption and the weather and occupancy
        it happened under; you confirm it.
      </p>

      <div class="toolbar" style="margin-top:14px">
        <div class="field">
          <label for="blFrom">From</label>
          <input id="blFrom" type="month" value="${sug?.period_from ?? "2025-03"}" />
        </div>
        <div class="field">
          <label for="blTo">To</label>
          <input id="blTo" type="month" value="${sug?.period_to ?? "2025-08"}" />
        </div>
        <button class="btn btn-light" type="button" id="suggestBaseline">
          Suggest from meter readings
        </button>
      </div>

      ${
        sug
          ? `
        <div class="callout" style="margin-bottom:16px">
          Computed from <strong>${sug.meter_ids.length}</strong> live electricity
          meter(s) across <strong>${sug.months_with_data}</strong> of
          ${sug.months_in_window} months. These figures come from the readings on
          file, not from anyone's estimate.
        </div>

        <div class="grid4">
          <div class="field">
            <label for="blKwh">Baseline (kWh / month)</label>
            <input id="blKwh" type="number" value="${sug.baseline_kwh}" />
          </div>
          <div class="field">
            <label for="blCdd">Cooling degree days</label>
            <input id="blCdd" type="number" value="${sug.factors.cooling_degree_days}" />
          </div>
          <div class="field">
            <label for="blOcc">Occupancy index</label>
            <input id="blOcc" type="number" step="0.01" value="${sug.factors.occupancy_index}" />
          </div>
          <div class="field">
            <label for="blArea">Floor area (m²)</label>
            <input id="blArea" type="number" value="${sug.factors.floor_area_sqm}" />
          </div>
        </div>

        <div class="callout warn" style="margin:6px 0 16px">
          The three factors are not optional. Without them a later month cannot
          be normalised, and the client would be billed a share of any mild
          weather or drop in occupancy as though it were a saving.
        </div>

        <details style="margin-bottom:16px">
          <summary class="muted" style="cursor:pointer;font-size:13px">
            Month-by-month consumption in this window
          </summary>
          <table style="margin-top:10px">
            <thead><tr><th>Month</th><th class="num">Consumption</th></tr></thead>
            <tbody>
              ${sug.monthly
                .map(
                  (m) =>
                    `<tr><td>${formatPeriod(m.period)}</td><td class="num">${formatKwh(m.kwh)}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </details>

        <button class="btn btn-green" type="button" id="lockBaseline">
          Lock baseline — this cannot be undone
        </button>`
          : `<p class="muted" style="font-size:13px">
               Pick a window and press <strong>Suggest from meter readings</strong>.
             </p>`
      }
    </div>`;
}

/* ─── Baseline: locked ──────────────────────────────────────────── */

function renderLockedBaseline(audit) {
  const b = audit.baseline;
  return `
    <div class="card">
      <div class="header-row">
        <div>
          <h2>Baseline</h2>
          <p class="sub">
            Locked ${formatDate(b.locked_on)} · window ${formatPeriod(b.period_from)} to
            ${formatPeriod(b.period_to)}
          </p>
        </div>
        <span class="badge resolved">Locked</span>
      </div>

      <div class="grid2" style="margin-top:16px">
        <dl class="dl">
          <dt>Consumption</dt><dd>${formatKwh(b.baseline_kwh)} / month</dd>
          <dt>Cost</dt><dd>${formatCurrency(b.baseline_cost)} / month</dd>
          <dt>Emissions</dt><dd>${formatNumber(b.baseline_co2_kg)} kg CO₂ / month</dd>
          <dt>Water</dt><dd>${formatNumber(b.baseline_water_kl)} kL / month</dd>
        </dl>
        <dl class="dl">
          <dt>Cooling degree days</dt><dd>${formatNumber(b.factors.cooling_degree_days)}</dd>
          <dt>Occupancy index</dt><dd>${b.factors.occupancy_index}</dd>
          <dt>Floor area</dt><dd>${formatNumber(b.factors.floor_area_sqm)} m²</dd>
        </dl>
      </div>

      <div class="callout good" style="margin-top:16px">
        Every savings claim for this client is measured against these numbers,
        restated for the weather and occupancy of the month being claimed.
        Re-baselining means raising a new audit, not editing this one.
      </div>
    </div>`;
}

/* ─── Status ────────────────────────────────────────────────────── */

function renderStatusActions(audit) {
  const canSubmit = audit.status === "in-progress" && audit.baseline?.locked;
  return `
    <div class="card">
      <h2>Engagement status</h2>
      <p class="sub">Currently ${escapeHtml(audit.status)}.</p>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-light" type="button" data-status="in-progress">
          Mark in progress
        </button>
        <button class="btn btn-dark" type="button" data-status="submitted" ${canSubmit ? "" : "disabled"}>
          Submit for approval
        </button>
        <button class="btn btn-green" type="button" data-status="approved">
          Approve
        </button>
      </div>
      ${
        !audit.baseline?.locked
          ? `<p class="muted" style="font-size:12px;margin-top:10px">
               An engagement cannot be submitted until its baseline is locked.
             </p>`
          : ""
      }
    </div>`;
}

/* ─── Wiring ────────────────────────────────────────────────────── */

function wire() {
  const root = document.getElementById("auditorApp");

  root.querySelectorAll("[data-select]").forEach((el) => {
    el.onclick = () => {
      state.selectedId = el.dataset.select;
      state.suggestion = null;
      localStorage.setItem("auditor_selected_audit", state.selectedId);
      render();
    };
  });

  const audit = selected();
  if (!audit) return;

  root.querySelector("#saveSurvey")?.addEventListener("click", () => saveSurvey(audit));
  root.querySelector("#suggestBaseline")?.addEventListener("click", () => suggest(audit));
  root.querySelector("#lockBaseline")?.addEventListener("click", () => lock(audit));

  root.querySelectorAll("[data-status]").forEach((btn) => {
    btn.onclick = () => setStatus(audit, btn.dataset.status);
  });
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

async function suggest(audit) {
  const from = document.getElementById("blFrom").value;
  const to = document.getElementById("blTo").value;
  if (!from || !to) {
    showToast("Choose both ends of the baseline window.", "warning");
    return;
  }

  try {
    state.suggestion = await window.api.get(
      `/energy-audits/${audit.audit_id}/baseline-suggestion?from=${from}&to=${to}`,
    );
    render();
  } catch (err) {
    showToast(err.message, "error", 7000);
  }
}

async function lock(audit) {
  const sug = state.suggestion;
  if (!sug) return;

  const body = {
    period_from: sug.period_from,
    period_to: sug.period_to,
    baseline_kwh: Number(document.getElementById("blKwh").value),
    baseline_cost: sug.baseline_cost,
    baseline_co2_kg: sug.baseline_co2_kg,
    factors: {
      cooling_degree_days: Number(document.getElementById("blCdd").value),
      occupancy_index: Number(document.getElementById("blOcc").value),
      floor_area_sqm: Number(document.getElementById("blArea").value),
    },
    locked_by: state.user.user_id,
  };

  if (!window.confirm(
    `Lock the baseline at ${body.baseline_kwh.toLocaleString("en-IN")} kWh/month?\n\n` +
      `Every savings claim for this client will be measured against it, and it cannot be edited afterwards.`,
  ))
    return;

  try {
    audit.baseline = await window.api.patch(
      `/energy-audits/${audit.audit_id}/baseline`,
      body,
    );
    state.suggestion = null;
    showToast("Baseline locked.", "success");
    render();
  } catch (err) {
    showToast(err.message, "error", 7000);
  }
}

async function setStatus(audit, status) {
  try {
    const updated = await window.api.patch(`/energy-audits/${audit.audit_id}`, {
      status,
      ...(status === "approved"
        ? { approved_on: new Date().toISOString().slice(0, 10) }
        : {}),
    });
    Object.assign(audit, updated);
    showToast(`Engagement marked ${status}.`, "success");
    render();
  } catch (err) {
    showToast(err.message, "error", 6000);
  }
}
