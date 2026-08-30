import { escapeHtml, formatCurrency } from "../utils/ui.js";

/* ══════════════════════════════════════════════════════
   Revenue Manager — the platform's own numbers

   Reads GET /platform-invoices/revenue-summary, which aggregates across
   every tenant and is therefore restricted to EnerTrack staff. A client
   calling it gets 403; hiding this tab from them is a convenience, not the
   control.

   Revenue here is one thing — the subscription — so there is no mix to
   break down. What is worth watching instead is seat utilisation. An
   organisation at or over its allowance is either already paying an
   overage or about to, and either way it is the next conversation. That
   makes it a more actionable number than a revenue total, which only tells
   you what already happened.
   ══════════════════════════════════════════════════════ */

export function renderRevenueManager(container, app) {
  const summary = app.state.revenueSummary;

  if (!summary) {
    container.innerHTML = `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Revenue</h2>
            <p>Could not load the platform revenue summary.</p>
          </div>
        </div>
        <div class="table-card">
          <div class="empty-state">
            This view aggregates across every tenant, so it is available to
            EnerTrack staff only. Sign in as Super Admin.
          </div>
        </div>
      </section>`;
    return;
  }

  container.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Revenue</h2>
          <p>
            Across every client. MRR is computed from live contracts and
            current staff counts, so it is what the platform will bill next
            month rather than what it billed last.
          </p>
        </div>
      </div>

      ${renderTiles(summary)}
      ${renderCollections(summary)}
      ${renderByOrganization(summary)}
      ${renderByPlan(summary)}
    </section>`;
}

function renderTiles(s) {
  const nearLimit = s.by_organization.filter(
    (o) => o.seat_utilisation_pct !== null && o.seat_utilisation_pct >= 80,
  ).length;

  return `
    <div class="table-card" style="padding:18px;margin-bottom:16px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
        ${tile("Monthly recurring revenue", formatCurrency(s.mrr))}
        ${tile("Annual run rate", formatCurrency(s.arr))}
        ${tile("Billed to date", formatCurrency(s.billed_to_date))}
        ${tile(
          "At or near seat limit",
          String(nearLimit),
          "Clients at 80% of their allowance or above",
        )}
      </div>
    </div>`;
}

function tile(label, value, note) {
  return `
    <div>
      <div class="muted-cell" style="text-transform:uppercase;letter-spacing:.04em;font-size:11px;font-weight:700">
        ${escapeHtml(label)}
      </div>
      <div style="font-size:24px;font-weight:700;margin-top:6px">${value}</div>
      ${note ? `<div class="muted-cell" style="margin-top:4px">${escapeHtml(note)}</div>` : ""}
    </div>`;
}

function renderCollections(s) {
  const c = s.collections;
  return `
    <div class="table-card" style="padding:18px;margin-bottom:16px">
      <h3 style="font-size:15px;margin-bottom:12px">Collections</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
        ${tile("Paid", formatCurrency(c.paid))}
        ${tile("Issued", formatCurrency(c.issued))}
        ${tile("Overdue", formatCurrency(c.overdue))}
        ${tile("Draft", formatCurrency(c.draft))}
      </div>
      ${
        c.overdue > 0
          ? `<p class="muted-cell" style="margin-top:12px">
               ${formatCurrency(c.overdue)} is past its due date.
             </p>`
          : ""
      }
    </div>`;
}

/**
 * The seat bar is the useful column. It shows, per client, how full their
 * allowance is — and turns red past 100%, which is where an overage is
 * already being charged and an upgrade would probably suit them better.
 */
function renderByOrganization(s) {
  const rows = s.by_organization
    .map((o) => {
      const pct = o.seat_utilisation_pct;
      const over = o.seats_over_allowance > 0;
      const width = pct === null ? 0 : Math.min(100, pct);
      const colour = over ? "#b42318" : pct !== null && pct >= 80 ? "#b45309" : "#15803d";

      return `
    <tr>
      <td><strong>${escapeHtml(o.organization_name)}</strong></td>
      <td><span class="badge ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></td>
      <td>${escapeHtml(o.plan_name ?? "—")}</td>
      <td style="min-width:170px">
        ${
          pct === null
            ? `<span class="muted-cell">No contract</span>`
            : `<div style="display:flex;align-items:center;gap:8px">
                 <div style="flex:1;height:8px;background:#eef1f4;border-radius:4px;overflow:hidden">
                   <div style="width:${width}%;height:100%;background:${colour}"></div>
                 </div>
                 <span style="font-size:12px;white-space:nowrap">
                   ${o.billable_staff}/${o.included_seats}
                 </span>
               </div>
               ${over ? `<div class="muted-cell">${o.seats_over_allowance} seat(s) billed extra</div>` : ""}`
        }
      </td>
      <td>
        ${o.campuses_used}${o.max_campuses === null ? " / ∞" : ` / ${o.max_campuses}`}
      </td>
      <td>${formatCurrency(o.monthly)}</td>
      <td>${formatCurrency(o.billed_to_date)}</td>
      <td>${formatCurrency(o.outstanding)}</td>
    </tr>`;
    })
    .join("");

  return `
    <div class="table-card" style="margin-bottom:16px">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Organisation</th><th>Status</th><th>Tier</th>
              <th>Staff seats used</th><th>Campuses</th>
              <th>Per month</th><th>Billed to date</th><th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="8"><div class="empty-state">No client organisations.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderByPlan(s) {
  const rows = s.by_plan
    .map(
      (p) => `
    <tr>
      <td><strong>${escapeHtml(p.plan_name)}</strong></td>
      <td>${p.subscribers}</td>
      <td>${formatCurrency(p.mrr)}</td>
      <td>${formatCurrency(p.mrr * 12)}</td>
    </tr>`,
    )
    .join("");

  return `
    <div class="table-card">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Tier</th><th>Clients</th><th>MRR</th><th>Annualised</th></tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4"><div class="empty-state">No tiers defined.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}
