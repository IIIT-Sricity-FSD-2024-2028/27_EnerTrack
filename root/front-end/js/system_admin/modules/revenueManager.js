import { escapeHtml, formatCurrency, showToast } from "../utils/ui.js";

/* ══════════════════════════════════════════════════════
   Revenue Manager — the platform's own P&L

   Reads GET /platform-invoices/revenue-summary, which aggregates across
   every tenant and is therefore restricted to EnerTrack staff. A client
   calling it gets 403; this tab is hidden from them as a convenience, not
   as the control.

   The number worth arguing about on this page is the recurring/outcome
   split. EnerTrack's three revenue streams are not equally reliable:

     audit fee          one-time, and often waived to win the deal
     subscription       recurring and predictable
     performance share  depends on verified savings the client accepts,
                        which depends in part on the weather

   A model whose headline differentiator is the unpredictable stream is a
   fragile one, so the split is shown prominently rather than buried in a
   total. Recurring should dominate.
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
            EnerTrack staff only. Sign in as Super Admin or Account Officer.
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
            Across every client organisation. MRR is computed from live
            contracts and current meter counts, so it is what the platform
            will bill next month rather than what it billed last.
          </p>
        </div>
      </div>

      ${renderTiles(summary)}
      ${renderMix(summary)}
      ${renderCollections(summary)}
      ${renderByOrganization(summary)}
      ${renderByPlan(summary)}
    </section>`;
}

function renderTiles(s) {
  return `
    <div class="table-card" style="padding:18px;margin-bottom:16px">
      <div class="stat-row" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
        ${tile("Monthly recurring revenue", formatCurrency(s.mrr))}
        ${tile("Annual run rate", formatCurrency(s.arr))}
        ${tile("Billed to date", formatCurrency(s.billed_to_date))}
        ${tile("Outstanding", formatCurrency(s.collections.issued + s.collections.overdue))}
      </div>
    </div>`;
}

function tile(label, value) {
  return `
    <div>
      <div class="muted-cell" style="text-transform:uppercase;letter-spacing:.04em;font-size:11px;font-weight:700">
        ${escapeHtml(label)}
      </div>
      <div style="font-size:24px;font-weight:700;margin-top:6px">${value}</div>
    </div>`;
}

/**
 * The recurring-versus-outcome split, drawn as one bar.
 *
 * A bar rather than two numbers because the ratio is the point: it says how
 * much of the business survives a mild year.
 */
function renderMix(s) {
  const mix = s.revenue_mix;
  const total = Math.max(1, mix.recurring + mix.outcome + mix.audit_fees);
  const pct = (v) => `${((v / total) * 100).toFixed(1)}%`;

  return `
    <div class="table-card" style="padding:18px;margin-bottom:16px">
      <h3 style="font-size:15px;margin-bottom:4px">Revenue mix</h3>
      <p class="muted-cell" style="margin-bottom:14px">
        ${mix.recurring_pct}% of everything billed so far is the recurring
        subscription. The performance share is an alignment signal, not the
        business — EnerTrack measures and reports; the client's own
        technicians do the implementing.
      </p>

      <div style="display:flex;height:28px;border-radius:6px;overflow:hidden;background:#eef1f4">
        <div style="width:${pct(mix.recurring)};background:#1e3a5f" title="Subscription"></div>
        <div style="width:${pct(mix.outcome)};background:#15803d" title="Performance share"></div>
        <div style="width:${pct(mix.audit_fees)};background:#b45309" title="Audit fees"></div>
      </div>

      <div style="display:flex;gap:22px;margin-top:12px;font-size:13px;flex-wrap:wrap">
        ${legend("#1e3a5f", "Subscription", mix.recurring)}
        ${legend("#15803d", "Performance share", mix.outcome)}
        ${legend("#b45309", "Audit fees", mix.audit_fees)}
      </div>
    </div>`;
}

function legend(colour, label, value) {
  return `
    <span style="display:inline-flex;align-items:center;gap:8px">
      <span style="width:11px;height:11px;border-radius:3px;background:${colour};display:inline-block"></span>
      ${escapeHtml(label)} — <strong>${formatCurrency(value)}</strong>
    </span>`;
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
               ${formatCurrency(c.overdue)} is past its due date. The Account
               Officer's billing page chases these.
             </p>`
          : ""
      }
    </div>`;
}

function renderByOrganization(s) {
  const rows = s.by_organization
    .map(
      (o) => `
    <tr>
      <td><strong>${escapeHtml(o.organization_name)}</strong></td>
      <td><span class="badge ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></td>
      <td>${escapeHtml(o.plan_name ?? "—")}</td>
      <td>${o.billed_meter_count}</td>
      <td>${o.invoices}</td>
      <td>${formatCurrency(o.billed_to_date)}</td>
      <td>${formatCurrency(o.outstanding)}</td>
    </tr>`,
    )
    .join("");

  return `
    <div class="table-card" style="margin-bottom:16px">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Organisation</th><th>Status</th><th>Plan</th>
              <th>Meters billed</th><th>Invoices</th>
              <th>Billed to date</th><th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="7"><div class="empty-state">No client organisations.</div></td></tr>`}
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
            <tr><th>Plan</th><th>Subscribers</th><th>MRR</th><th>Annualised</th></tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4"><div class="empty-state">No plans defined.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}
