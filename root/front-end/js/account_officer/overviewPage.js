/**
 * overviewPage.js
 * Account Officer — book of accounts.
 *
 * Built around one idea: the officer's job is not to watch revenue arrive,
 * it is to unblock the revenue that has not. So the page leads with what is
 * stuck rather than with a portfolio total.
 *
 * Two things stick, and they are different problems:
 *   · a savings claim the client has not accepted — work EnerTrack has done
 *     and cannot invoice, usually because nobody has walked the client
 *     through the baseline adjustment
 *   · an invoice past its due date — work invoiced and not paid
 */
import {
  badge,
  daysUntil,
  emptyRow,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatKwh,
  formatPeriod,
  loadOrFail,
  requireAccountOfficer,
} from "./utils/utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAccountOfficer()) return;

  const root = document.getElementById("aoApp");
  root.innerHTML = `<div class="card"><p class="muted">Loading book of accounts…</p></div>`;

  const [summary, subs, plans, orgs, verifications, invoices] = await Promise.all([
    loadOrFail(() => window.api.get("/platform-invoices/revenue-summary"), "revenue summary"),
    loadOrFail(() => window.api.get("/subscriptions"), "subscriptions"),
    loadOrFail(() => window.api.get("/subscription-plans"), "plans"),
    loadOrFail(() => window.api.get("/organizations"), "organisations"),
    loadOrFail(() => window.api.get("/energy-audits/verifications"), "verifications"),
    loadOrFail(() => window.api.get("/platform-invoices"), "invoices"),
  ]);

  if (!summary) {
    root.innerHTML = `<div class="card"><h2>Backend unavailable</h2><p class="muted">Start the API on port 3000 and reload.</p></div>`;
    return;
  }

  const ctx = {
    summary,
    subs: subs || [],
    plans: plans || [],
    orgs: orgs || [],
    verifications: verifications || [],
    invoices: invoices || [],
  };

  root.innerHTML = [
    renderKpis(ctx),
    renderBlocked(ctx),
    renderAccounts(ctx),
    renderRenewals(ctx),
  ].join("");

  root.querySelectorAll("[data-org]").forEach((el) => {
    el.addEventListener("click", () => {
      localStorage.setItem("ao_selected_org", el.dataset.org);
      window.location.href = "ao_accounts.html";
    });
  });
});

/* ─── KPIs ──────────────────────────────────────────────────────── */

function renderKpis({ summary, verifications }) {
  const unbilled = verifications
    .filter((v) => v.status === "auditor-signed")
    .reduce((sum, v) => sum + (v.saved_amount || 0), 0);

  return `
    <div class="grid4" style="margin-bottom:20px">
      ${kpi("Monthly recurring revenue", formatCurrency(summary.mrr), `${formatCurrency(summary.arr)} annualised`)}
      ${kpi(
        "Revenue mix",
        `${summary.revenue_mix.recurring_pct}% recurring`,
        `${formatCurrency(summary.revenue_mix.outcome)} from verified savings`,
      )}
      ${kpi(
        "Overdue",
        formatCurrency(summary.collections.overdue),
        "Invoiced and unpaid",
        summary.collections.overdue > 0 ? "neg" : "",
      )}
      ${kpi(
        "Unaccepted savings",
        formatCurrency(unbilled),
        "Verified but not signed off — cannot be billed",
        unbilled > 0 ? "neg" : "",
      )}
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

/* ─── Blocked revenue ───────────────────────────────────────────── */

function renderBlocked({ verifications, invoices, orgs }) {
  const orgName = (id) =>
    orgs.find((o) => o.organization_id === id)?.name ?? id;

  const stuck = verifications.filter(
    (v) => v.status === "auditor-signed" || v.status === "disputed",
  );
  const overdue = invoices.filter((i) => i.status === "overdue");

  if (stuck.length === 0 && overdue.length === 0) {
    return `
      <div class="card">
        <h2>Nothing blocked</h2>
        <p class="sub">Every verified saving is accepted and every invoice is paid.</p>
      </div>`;
  }

  return `
    <div class="card">
      <h2>Blocked revenue</h2>
      <p class="sub">The work to do this week, worst first.</p>

      ${
        stuck.length
          ? `<div class="section-title">Savings awaiting the client</div>
             <table>
               <thead><tr>
                 <th>Client</th><th>Period</th><th>Status</th>
                 <th class="num">Verified saving</th><th class="num">Value</th><th>Blocker</th>
               </tr></thead>
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
                       v.dispute_reason ||
                         `Signed ${formatDate(v.signed_on)}, no response yet`,
                     )}</td>
                   </tr>`,
                   )
                   .join("")}
               </tbody>
             </table>`
          : ""
      }

      ${
        overdue.length
          ? `<div class="section-title">Overdue invoices</div>
             <table>
               <thead><tr>
                 <th>Client</th><th>Period</th><th>Due</th>
                 <th class="num">Amount</th><th class="num">Days late</th>
               </tr></thead>
               <tbody>
                 ${overdue
                   .map((i) => {
                     const late = daysUntil(i.due_on);
                     return `
                   <tr>
                     <td>${escapeHtml(orgName(i.organization_id))}</td>
                     <td class="nowrap">${formatPeriod(i.period)}</td>
                     <td class="nowrap">${formatDate(i.due_on)}</td>
                     <td class="num">${formatCurrency(i.total)}</td>
                     <td class="num" style="color:var(--neg);font-weight:700">
                       ${late === null ? "—" : Math.abs(Math.min(late, 0))}
                     </td>
                   </tr>`;
                   })
                   .join("")}
               </tbody>
             </table>`
          : ""
      }
    </div>`;
}

/* ─── Accounts ──────────────────────────────────────────────────── */

function renderAccounts({ summary, subs, plans, orgs }) {
  const planName = (id) => plans.find((p) => p.plan_id === id)?.name ?? "—";

  return `
    <div class="card">
      <h2>Accounts</h2>
      <p class="sub">Click a client to open its contract.</p>
      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Client</th><th>Status</th><th>Plan</th>
            <th class="num">Meters billed</th><th class="num">Billed to date</th>
            <th class="num">Outstanding</th><th>Renews</th>
          </tr>
        </thead>
        <tbody>
          ${
            summary.by_organization.length === 0
              ? emptyRow(7, "No client organisations.")
              : summary.by_organization
                  .map((row) => {
                    const sub = subs.find(
                      (s) => s.organization_id === row.organization_id,
                    );
                    const renews = sub?.renews_on;
                    const left = daysUntil(renews);
                    return `
              <tr data-org="${escapeHtml(row.organization_id)}" style="cursor:pointer">
                <td>${escapeHtml(row.organization_name)}</td>
                <td>${badge(row.status)}</td>
                <td>${escapeHtml(row.plan_name ?? planName(sub?.plan_id))}</td>
                <td class="num">${row.billed_meter_count}</td>
                <td class="num">${formatCurrency(row.billed_to_date)}</td>
                <td class="num" style="${row.outstanding > 0 ? "color:var(--neg);font-weight:700" : ""}">
                  ${formatCurrency(row.outstanding)}
                </td>
                <td class="nowrap">
                  ${renews ? formatDate(renews) : "—"}
                  ${
                    left !== null && left <= 60 && left >= 0
                      ? `<span class="badge review" style="margin-left:6px">${left}d</span>`
                      : ""
                  }
                </td>
              </tr>`;
                  })
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}

/* ─── Renewals ──────────────────────────────────────────────────── */

function renderRenewals({ subs, orgs, plans }) {
  const orgName = (id) => orgs.find((o) => o.organization_id === id)?.name ?? id;
  const planName = (id) => plans.find((p) => p.plan_id === id)?.name ?? "—";

  const soon = subs
    .filter((s) => {
      const left = daysUntil(s.renews_on);
      return left !== null && left <= 120;
    })
    .sort((a, b) => (a.renews_on || "").localeCompare(b.renews_on || ""));

  return `
    <div class="card">
      <h2>Renewals within 120 days</h2>
      <p class="sub">
        Take the savings reporting into these conversations — a client that
        can see what it saved is a client that renews.
      </p>
      <table style="margin-top:14px">
        <thead><tr><th>Client</th><th>Plan</th><th>Renews</th><th class="num">Days</th><th>Status</th></tr></thead>
        <tbody>
          ${
            soon.length === 0
              ? emptyRow(5, "No renewals due in the next 120 days.")
              : soon
                  .map((s) => {
                    const left = daysUntil(s.renews_on);
                    return `
              <tr>
                <td>${escapeHtml(orgName(s.organization_id))}</td>
                <td>${escapeHtml(planName(s.plan_id))}</td>
                <td class="nowrap">${formatDate(s.renews_on)}</td>
                <td class="num">${left}</td>
                <td>${badge(s.status)}</td>
              </tr>`;
                  })
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}
