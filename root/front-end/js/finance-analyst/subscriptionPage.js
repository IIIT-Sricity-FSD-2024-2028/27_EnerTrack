/**
 * subscriptionPage.js
 * Client-side view of the EnerTrack relationship.
 *
 * Two things to keep straight, because they are easy to confuse and this
 * page exists partly to stop that happening:
 *
 *   Utility Costs (finance_costs.html)  what you pay your electricity supplier
 *   This page                           what you pay EnerTrack for the service
 *
 * The page answers one question honestly: is this worth it? On the left,
 * what the subscription costs. On the right, what consumption has actually
 * done against the same months last year. EnerTrack does not charge a share
 * of savings — the subscription is the whole bill — so this comparison is
 * evidence rather than an invoice, and the client keeps every rupee of it.
 *
 * Entirely read-only. A client has no write access to tiers, contracts or
 * invoices, and the backend enforces that regardless of what this page does.
 */

const els = {};

const ALLOWED = [
  "Economic Buyer",
  "Financial Analyst",
  "Organization Admin",
  "Super Admin",
];

/** Rolling window the savings panel compares over. */
const SAVINGS_FROM = "2026-03";
const SAVINGS_TO = "2026-08";

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("subscriptionApp");
  if (!root) return;

  const user = currentUser();
  if (!user || !ALLOWED.includes(user.role)) {
    window.location.href = "../sign_in/sign_in.html";
    return;
  }

  // Wired here, before any of the early returns below, since the sidebar
  // is on screen regardless of whether this account turns out to have an
  // organisation or a live subscription — every other finance-analyst
  // page wires this on load, and this one never had.
  wireNavigation();

  root.innerHTML = `<div class="sub" style="padding:24px 0">Loading your subscription…</div>`;

  const orgId = user.organization_id;
  if (!orgId) {
    root.innerHTML = `
      <div class="sub-card">
        <h2>No organisation</h2>
        <p>
          This account belongs to EnerTrack rather than to a client, so it has
          no subscription of its own.
        </p>
      </div>`;
    return;
  }

  let subscription;
  try {
    subscription = await window.api.get(`/subscriptions/by-organization/${orgId}`);
  } catch (err) {
    root.innerHTML = `
      <div class="sub-card">
        <h2>No active subscription</h2>
        <p>${escapeHtml(err.message)}</p>
      </div>`;
    return;
  }

  const [invoices, users, campuses, savings] = await Promise.all([
    window.api.get("/platform-invoices").catch(() => []),
    window.api.get("/users").catch(() => []),
    window.api.get("/campus").catch(() => []),
    window.api
      .get(`/organizations/${orgId}/savings?from=${SAVINGS_FROM}&to=${SAVINGS_TO}`)
      .catch(() => null),
  ]);

  Object.assign(els, {
    root,
    user,
    subscription,
    invoices: Array.isArray(invoices) ? invoices : [],
    // Every user except a Campus Visitor. The same rule the backend bills
    // on, restated here only so the page can show the working.
    staff: (Array.isArray(users) ? users : []).filter(
      (u) => u.organization_id === orgId && u.role !== "Campus Visitor",
    ),
    visitors: (Array.isArray(users) ? users : []).filter(
      (u) => u.organization_id === orgId && u.role === "Campus Visitor",
    ),
    campuses: (Array.isArray(campuses) ? campuses : []).filter(
      (c) => c.organization_id === orgId,
    ),
    savings,
  });

  render();
});

/**
 * The sidebar's nav items are plain <div data-page="..."> elements, not
 * links, on every finance-analyst page — so without this, clicking one
 * does nothing. Every other page in this section wires it; this one
 * simply never had it.
 */
function wireNavigation() {
  document.querySelectorAll(".menu-item[data-page]").forEach((item) => {
    item.addEventListener("click", () => {
      window.location.href = item.dataset.page;
    });
  });
}

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch (_) {
    return null;
  }
}

function render() {
  els.root.innerHTML = [
    renderPlan(),
    renderUsage(),
    renderValue(),
    renderInvoices(),
  ].join("");
}

/* ─── Plan ──────────────────────────────────────────────────────── */

function renderPlan() {
  const s = els.subscription;
  const p = s.plan || {};

  return `
    <div class="sub-card">
      <div class="sub-card-head">
        <div>
          <h2>${escapeHtml(p.name ?? "Your plan")}</h2>
          <p>${escapeHtml(p.tagline ?? "")}</p>
        </div>
        <span class="sub-badge ${escapeHtml(s.status)}">${escapeHtml(s.status)}</span>
      </div>

      <div class="sub-grid">
        <div>
          <span class="sub-k">Monthly fee</span>
          <span class="sub-v">${money(p.base_monthly_fee)}</span>
          <span class="sub-n">Covers everything up to your allowances</span>
        </div>
        <div>
          <span class="sub-k">Included staff</span>
          <span class="sub-v">${num(p.included_seats)} seats</span>
          <span class="sub-n">Then ${money(p.price_per_extra_seat)} per extra staff account</span>
        </div>
        <div>
          <span class="sub-k">Campuses</span>
          <span class="sub-v">${p.max_campuses === null ? "Unlimited" : num(p.max_campuses)}</span>
          <span class="sub-n">Included in this tier</span>
        </div>
        <div>
          <span class="sub-k">Renews</span>
          <span class="sub-v">${date(s.renews_on)}</span>
          <span class="sub-n">Billed ${escapeHtml(s.billing_cycle)}</span>
        </div>
      </div>

      ${
        (p.features || []).length
          ? `<ul class="sub-features">
               ${p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
             </ul>`
          : ""
      }
    </div>`;
}

/* ─── Usage against allowances ──────────────────────────────────── */

function renderUsage() {
  const p = els.subscription.plan || {};
  const staff = els.staff.length;
  const included = p.included_seats ?? 0;
  const over = Math.max(0, staff - included);
  const campuses = els.campuses.length;

  const seatPct = included > 0 ? Math.min(100, (staff / included) * 100) : 0;
  const seatColour = over ? "#b42318" : seatPct >= 80 ? "#b45309" : "#15803d";

  return `
    <div class="sub-card">
      <h2>Your usage this month</h2>
      <p>What your bill is calculated from.</p>

      <div class="usage-row">
        <div class="usage-label">
          Staff accounts
          <small>${staff} of ${included} included</small>
        </div>
        <div class="usage-track">
          <div class="usage-fill" style="width:${seatPct}%;background:${seatColour}"></div>
        </div>
        <div class="usage-value">
          ${over > 0 ? `${over} over` : `${included - staff} spare`}
        </div>
      </div>

      <div class="usage-row">
        <div class="usage-label">
          Campuses
          <small>${campuses} of ${p.max_campuses === null ? "unlimited" : p.max_campuses}</small>
        </div>
        <div class="usage-track">
          <div class="usage-fill" style="width:${
            p.max_campuses ? Math.min(100, (campuses / p.max_campuses) * 100) : 8
          }%;background:#1e3a5f"></div>
        </div>
        <div class="usage-value">${campuses}</div>
      </div>

      <table class="sub-table" style="margin-top:20px">
        <tbody>
          <tr>
            <td>${escapeHtml(els.subscription.plan?.name ?? "Tier")} monthly fee</td>
            <td class="r">${money(p.base_monthly_fee)}</td>
          </tr>
          ${
            over > 0
              ? `<tr>
                   <td>${over} additional staff seat${over === 1 ? "" : "s"} × ${money(p.price_per_extra_seat)}</td>
                   <td class="r">${money(over * p.price_per_extra_seat)}</td>
                 </tr>`
              : ""
          }
          <tr class="usage-total">
            <td>Before GST</td>
            <td class="r">${money((p.base_monthly_fee || 0) + over * (p.price_per_extra_seat || 0))}</td>
          </tr>
        </tbody>
      </table>

      <p class="claim-note">
        Your ${els.visitors.length} Campus Visitor account${els.visitors.length === 1 ? "" : "s"}
        ${els.visitors.length === 1 ? "does" : "do"} not count towards a seat.
        Anyone on campus can report a fault without adding to your bill —
        the people who spot problems first should never be a cost.
      </p>
    </div>`;
}

/* ─── Value ─────────────────────────────────────────────────────── */

function renderValue() {
  const s = els.savings;
  const paid = els.invoices
    .filter((i) => i.status !== "draft")
    .reduce((sum, i) => sum + i.total, 0);

  if (!s || !s.has_comparison) {
    return `
      <div class="sub-card">
        <h2>What you have saved</h2>
        <p>
          Not enough history yet to compare against the same months last
          year. This fills in once a full year of readings is on file.
        </p>
      </div>`;
  }

  const improved = s.saved_kwh > 0;

  return `
    <div class="sub-card ${improved ? "sub-card-good" : ""}">
      <h2>What you have saved</h2>
      <p>
        ${monthName(s.from)} to ${monthName(s.to)}, against the same months a
        year earlier. Comparing like months with like cancels the seasons, so
        what is left is the change your own team made.
      </p>

      <div class="sub-grid" style="margin-top:16px">
        <div>
          <span class="sub-k">A year ago</span>
          <span class="sub-v">${num(s.kwh_year_ago)} kWh</span>
          <span class="sub-n">Same months, ${Number(s.from.slice(0, 4)) - 1}</span>
        </div>
        <div>
          <span class="sub-k">This year</span>
          <span class="sub-v">${num(s.kwh)} kWh</span>
          <span class="sub-n">${s.months_compared} months measured</span>
        </div>
        <div>
          <span class="sub-k">Change</span>
          <span class="sub-v ${improved ? "pos" : ""}">${s.change_pct}%</span>
          <span class="sub-n">${num(Math.abs(s.saved_co2_kg))} kg CO₂ ${improved ? "avoided" : "added"}</span>
        </div>
        <div>
          <span class="sub-k">${improved ? "Worth to you" : "Additional cost"}</span>
          <span class="sub-v ${improved ? "pos" : ""}">${money(Math.abs(s.saved_amount))}</span>
          <span class="sub-n">At your own tariff</span>
        </div>
      </div>

      ${
        improved
          ? `<p class="claim-note">
               You have paid EnerTrack <strong>${money(paid)}</strong> in total
               and saved <strong>${money(s.saved_amount)}</strong> in energy
               over these months. We charge a subscription, not a share of your
               savings — every rupee of that is yours.
             </p>`
          : `<p class="claim-note">
               Consumption is up on last year. Your audit recommendations are
               under Recommendations, and your account contact can walk through
               what is driving it.
             </p>`
      }
    </div>`;
}

/* ─── Invoices ──────────────────────────────────────────────────── */

function renderInvoices() {
  const rows = [...els.invoices].sort((a, b) => b.period.localeCompare(a.period));

  return `
    <div class="sub-card">
      <h2>Invoices from EnerTrack</h2>
      <p>
        Not to be confused with your utility bills, which are under Utility
        Costs.
      </p>

      <table class="sub-table">
        <thead>
          <tr>
            <th>Period</th><th>What for</th><th class="r">Before GST</th>
            <th class="r">GST</th><th class="r">Total</th><th>Status</th><th>Due</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length === 0
              ? `<tr><td colspan="7" class="empty">No invoices yet.</td></tr>`
              : rows
                  .map(
                    (i) => `
            <tr>
              <td>${monthName(i.period)}</td>
              <td class="n">
                ${i.line_items.map((l) => `${escapeHtml(l.description)} — ${money(l.amount)}`).join("<br>")}
              </td>
              <td class="r">${money(i.subtotal)}</td>
              <td class="r">${money(i.tax_amount)}</td>
              <td class="r"><strong>${money(i.total)}</strong></td>
              <td><span class="sub-badge ${escapeHtml(i.status)}">${escapeHtml(i.status)}</span></td>
              <td>${date(i.due_on)}</td>
            </tr>`,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function num(value) {
  return new Intl.NumberFormat("en-IN").format(Math.round(Number(value || 0)));
}

function date(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? escapeHtml(value)
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function monthName(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return escapeHtml(value ?? "—");
  const [y, m] = value.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}
