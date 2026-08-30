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
 * The second reason it exists is the accept/dispute queue. EnerTrack's
 * performance share is a percentage of savings measured against a baseline
 * that EnerTrack's own auditor locked — so without a counterparty, the
 * vendor would be marking its own homework. Nothing is billable until
 * someone here accepts it, and the buttons below are that counterparty.
 *
 * Everything on this page is read-only except those two actions. The
 * backend enforces it: a client role has no write access to plans,
 * subscriptions or invoices, and can only accept or dispute a verification
 * belonging to its own organisation.
 */

const els = {};

const CLIENT_ROLES = [
  "Economic Buyer",
  "Financial Analyst",
  "System Administrator",
  "Super Admin",
  "Account Officer",
];

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("subscriptionApp");
  if (!root) return;

  const user = currentUser();
  if (!user || !CLIENT_ROLES.includes(user.role)) {
    window.location.href = "../sign_in/sign_in.html";
    return;
  }

  root.innerHTML = `<div class="sub" style="padding:24px 0">Loading your subscription…</div>`;

  const orgId = user.organization_id;
  if (!orgId) {
    root.innerHTML = `
      <div class="sub-card">
        <h2>No organisation</h2>
        <p>
          This account belongs to EnerTrack rather than to a client, so it has
          no subscription of its own. Use the Account Officer dashboard to see
          client billing.
        </p>
      </div>`;
    return;
  }

  let subscription = null;
  let invoices = [];
  let audits = [];

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

  [invoices, audits] = await Promise.all([
    window.api.get("/platform-invoices").catch(() => []),
    window.api.get("/energy-audits").catch(() => []),
  ]);

  els.root = root;
  els.user = user;
  els.subscription = subscription;
  els.invoices = Array.isArray(invoices) ? invoices : [];
  els.audits = Array.isArray(audits) ? audits : [];

  render();
});

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch (_) {
    return null;
  }
}

function verifications() {
  return els.audits
    .flatMap((a) => (a.verifications || []).map((v) => ({ ...v, audit_id: a.audit_id })))
    .sort((a, b) => b.period.localeCompare(a.period));
}

function render() {
  els.root.innerHTML = [
    renderPlan(),
    renderPendingClaims(),
    renderValue(),
    renderInvoices(),
  ].join("");

  els.root.querySelectorAll("[data-accept]").forEach((btn) => {
    btn.onclick = () => accept(btn.dataset.auditId, btn.dataset.accept);
  });
  els.root.querySelectorAll("[data-dispute]").forEach((btn) => {
    btn.onclick = () => dispute(btn.dataset.auditId, btn.dataset.dispute);
  });
}

/* ─── Plan ──────────────────────────────────────────────────────── */

function renderPlan() {
  const s = els.subscription;
  const p = s.plan || {};
  const share = s.performance_share_pct_override ?? p.performance_share_pct ?? 0;

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
          <span class="sub-k">Monitoring subscription</span>
          <span class="sub-v">${money(p.price_per_meter_month)} per meter / month</span>
          <span class="sub-n">Minimum ${money(p.min_monthly_fee)} / month</span>
        </div>
        <div>
          <span class="sub-k">Performance share</span>
          <span class="sub-v">${share}% of verified savings</span>
          <span class="sub-n">
            Capped at ${p.share_cap_pct_of_subscription ?? "—"}% of your
            subscription fee, and payable only on savings you have accepted.
          </span>
        </div>
        <div>
          <span class="sub-k">Audit fee</span>
          <span class="sub-v">
            ${s.audit_fee_waived_on ? "Waived" : "Charged on first invoice"}
          </span>
          <span class="sub-n">
            ${s.audit_fee_waived_on ? `Waived on signature, ${date(s.audit_fee_waived_on)}` : "One-time site assessment"}
          </span>
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

/* ─── The counter-signature queue ───────────────────────────────── */

function renderPendingClaims() {
  const pending = verifications().filter((v) => v.status === "auditor-signed");

  if (pending.length === 0) {
    return `
      <div class="sub-card">
        <h2>Savings claims</h2>
        <p>Nothing is waiting for your approval.</p>
      </div>`;
  }

  return `
    <div class="sub-card sub-card-attention">
      <div class="sub-card-head">
        <div>
          <h2>Savings awaiting your approval</h2>
          <p>
            EnerTrack's auditor has verified these. Nothing is invoiced until
            you accept — if a figure looks wrong, dispute it and say why.
          </p>
        </div>
        <span class="sub-badge pending">${pending.length} to review</span>
      </div>

      ${pending.map(renderClaim).join("")}
    </div>`;
}

function renderClaim(v) {
  const rawSaving = Math.max(0, v.raw_baseline_kwh - v.actual_kwh);
  const givenBack = rawSaving - v.saved_kwh;

  return `
    <div class="claim">
      <div class="claim-head">
        <strong>${period(v.period)}</strong>
        <span class="sub-n">signed ${date(v.signed_on)}</span>
      </div>

      <table class="claim-table">
        <tr>
          <td>Your baseline</td>
          <td class="r">${kwh(v.raw_baseline_kwh)}</td>
          <td class="n">As locked at the time of the audit</td>
        </tr>
        <tr>
          <td>Adjusted for this month</td>
          <td class="r">${kwh(v.adjusted_baseline_kwh)}</td>
          <td class="n">
            Restated for ${num(v.actual_factors.cooling_degree_days)} cooling
            degree days and occupancy ${v.actual_factors.occupancy_index}
          </td>
        </tr>
        <tr>
          <td>You actually used</td>
          <td class="r">${kwh(v.actual_kwh)}</td>
          <td class="n">Metered</td>
        </tr>
        <tr class="claim-total">
          <td>Verified saving</td>
          <td class="r">${kwh(v.saved_kwh)}</td>
          <td class="n">${money(v.saved_amount)} at your tariff</td>
        </tr>
      </table>

      ${
        givenBack > 0
          ? `<p class="claim-note">
               A raw before-and-after comparison would have claimed
               <strong>${kwh(rawSaving)}</strong>. The baseline adjustment
               removed <strong>${kwh(givenBack)}</strong> of that as weather and
               occupancy rather than anything the measures achieved. You are not
               being billed for it.
             </p>`
          : `<p class="claim-note">
               This month ran harder than your baseline window, so the
               adjustment credited you with more than a raw comparison would.
             </p>`
      }

      <div class="claim-actions">
        <button class="sub-btn sub-btn-accept" type="button"
                data-accept="${escapeHtml(v.verification_id)}"
                data-audit-id="${escapeHtml(v.audit_id)}">
          Accept — this becomes billable
        </button>
        <button class="sub-btn sub-btn-dispute" type="button"
                data-dispute="${escapeHtml(v.verification_id)}"
                data-audit-id="${escapeHtml(v.audit_id)}">
          Dispute
        </button>
      </div>
    </div>`;
}

/* ─── Value ─────────────────────────────────────────────────────── */

function renderValue() {
  const all = verifications();
  const accepted = all.filter((v) => v.status === "client-accepted");
  const p = els.subscription.plan || {};
  const share =
    els.subscription.performance_share_pct_override ?? p.performance_share_pct ?? 0;

  const saved = accepted.reduce((sum, v) => sum + (v.saved_amount || 0), 0);
  const paid = els.invoices
    .filter((i) => i.status === "paid" || i.status === "issued" || i.status === "overdue")
    .reduce((sum, i) => sum + i.total, 0);
  const shareBilled = Math.round(saved * (share / 100));
  const net = saved - shareBilled;

  return `
    <div class="sub-card">
      <h2>What this has been worth</h2>
      <p>Savings you have accepted, against what EnerTrack has invoiced.</p>

      <div class="sub-grid" style="margin-top:16px">
        <div>
          <span class="sub-k">Savings accepted</span>
          <span class="sub-v pos">${money(saved)}</span>
          <span class="sub-n">${accepted.length} verified month(s)</span>
        </div>
        <div>
          <span class="sub-k">Performance share billed</span>
          <span class="sub-v">${money(shareBilled)}</span>
          <span class="sub-n">${share}% of the above</span>
        </div>
        <div>
          <span class="sub-k">You kept</span>
          <span class="sub-v pos">${money(net)}</span>
          <span class="sub-n">
            ${saved > 0 ? Math.round((net / saved) * 100) : 0}% of the benefit
          </span>
        </div>
        <div>
          <span class="sub-k">Invoiced to date</span>
          <span class="sub-v">${money(paid)}</span>
          <span class="sub-n">Subscription, share and any audit fee</span>
        </div>
      </div>

      ${
        all.some((v) => v.status === "disputed")
          ? `<p class="claim-note" style="margin-top:14px">
               You have disputed claims on file. Those have not been invoiced
               and will not be until they are resolved.
             </p>`
          : ""
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
            <th>Period</th><th>Lines</th><th class="r">Subtotal</th>
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
              <td>${period(i.period)}</td>
              <td class="n">
                ${i.line_items.map((l) => `${escapeHtml(readable(l.type))} ${money(l.amount)}`).join("<br>")}
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

/* ─── Actions ───────────────────────────────────────────────────── */

async function accept(auditId, verificationId) {
  if (
    !window.confirm(
      "Accept this savings verification?\n\n" +
        "It becomes billable, and EnerTrack's performance share for that month " +
        "will appear on your next invoice.",
    )
  )
    return;

  try {
    await window.api.patch(
      `/energy-audits/${auditId}/verifications/${verificationId}/accept`,
      { accepted_by: els.user.user_id },
    );
    await reload();
    toast("Accepted. This month's savings are now billable.", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function dispute(auditId, verificationId) {
  const reason = window.prompt(
    "What is wrong with this claim?\n\n" +
      "Be specific — the adjustment factors, the buildings included, or the " +
      "period itself. EnerTrack's auditor sees this.",
  );
  if (!reason || !reason.trim()) return;

  try {
    await window.api.patch(
      `/energy-audits/${auditId}/verifications/${verificationId}/dispute`,
      { dispute_reason: reason.trim() },
    );
    await reload();
    toast("Disputed. It will not be invoiced while it is open.", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function reload() {
  const [invoices, audits] = await Promise.all([
    window.api.get("/platform-invoices").catch(() => els.invoices),
    window.api.get("/energy-audits").catch(() => els.audits),
  ]);
  els.invoices = Array.isArray(invoices) ? invoices : els.invoices;
  els.audits = Array.isArray(audits) ? audits : els.audits;
  render();
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

function kwh(value) {
  return `${num(value)} kWh`;
}

function date(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? escapeHtml(value)
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function period(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return escapeHtml(value ?? "—");
  const [y, m] = value.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}

function readable(type) {
  return {
    subscription: "Subscription",
    "audit-fee": "Audit fee",
    "performance-share": "Performance share",
  }[type] ?? type;
}

function toast(message, type) {
  let box = document.getElementById("subToast");
  if (!box) {
    box = document.createElement("div");
    box.id = "subToast";
    document.body.appendChild(box);
  }
  box.className = `sub-toast ${type}`;
  box.textContent = message;
  box.style.opacity = "1";
  setTimeout(() => {
    box.style.opacity = "0";
  }, 4500);
}
