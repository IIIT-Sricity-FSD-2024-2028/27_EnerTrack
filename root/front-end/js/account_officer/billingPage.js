/**
 * billingPage.js
 * Account Officer — invoice pipeline.
 *
 * The flow is preview → generate → issue → mark paid, and it is split that
 * way on purpose. Preview computes a period's invoice without saving
 * anything and explains, in words, why the performance-share line is present
 * or absent. That explanation is the useful part: "why is there no savings
 * line this month?" is the question this role fields constantly, and the
 * answer is always one of four specific things — no verification exists, the
 * auditor has not signed it, the client has not accepted it, or the client
 * disputed it.
 *
 * Nothing on an invoice is typed here. The engine reads the live meter count,
 * the contract and an accepted verification, so a figure on a bill can always
 * be traced back to the record that produced it via its source_ref.
 */
import {
  badge,
  emptyRow,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatPeriod,
  loadOrFail,
  requireAccountOfficer,
  showToast,
} from "./utils/utils.js";

const state = {
  orgs: [],
  invoices: [],
  orgId: null,
  period: lastCompleteMonth(),
  preview: null,
};

function lastCompleteMonth() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAccountOfficer()) return;

  const root = document.getElementById("aoApp");
  root.innerHTML = `<div class="card"><p class="muted">Loading billing…</p></div>`;

  const [orgs, invoices] = await Promise.all([
    loadOrFail(() => window.api.get("/organizations"), "organisations"),
    loadOrFail(() => window.api.get("/platform-invoices"), "invoices"),
  ]);

  if (!orgs) {
    root.innerHTML = `<div class="card"><h2>Backend unavailable</h2><p class="muted">Start the API on port 3000 and reload.</p></div>`;
    return;
  }

  state.orgs = orgs;
  state.invoices = invoices || [];
  state.orgId =
    localStorage.getItem("ao_selected_org") || orgs[0]?.organization_id || null;

  render();
});

const orgName = (id) =>
  state.orgs.find((o) => o.organization_id === id)?.name ?? id;

function render() {
  const root = document.getElementById("aoApp");

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
        <div class="field">
          <label for="periodPick">Period</label>
          <input id="periodPick" type="month" value="${state.period}" />
        </div>
        <button class="btn btn-dark" type="button" id="previewBtn">Preview invoice</button>
      </div>
    </div>

    ${state.preview ? renderPreview(state.preview) : renderPrompt()}
    ${renderPipeline()}`;

  wire();
}

function renderPrompt() {
  return `
    <div class="card">
      <p class="muted" style="font-size:13px">
        Pick a client and a period, then press <strong>Preview invoice</strong>.
        Nothing is saved until you generate it.
      </p>
    </div>`;
}

/* ─── Preview ───────────────────────────────────────────────────── */

function renderPreview(p) {
  const hasShare = p.line_items.some((l) => l.type === "performance-share");

  return `
    <div class="card">
      <div class="header-row">
        <div>
          <h2>${escapeHtml(p.organization_name)} — ${formatPeriod(p.period)}</h2>
          <p class="sub">
            ${escapeHtml(p.plan_name)} · ${p.billed_meter_count} metered points ·
            ${p.share_pct}% share on accepted savings
          </p>
        </div>
        <span class="badge new">Not saved</span>
      </div>

      <table style="margin-top:16px">
        <thead><tr>
          <th>Line</th><th>Description</th>
          <th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th><th>Source</th>
        </tr></thead>
        <tbody>
          ${p.line_items
            .map(
              (l) => `
            <tr>
              <td>${escapeHtml(l.type)}</td>
              <td style="max-width:340px">${escapeHtml(l.description)}</td>
              <td class="num">${l.quantity}</td>
              <td class="num">${formatCurrency(l.unit_price)}</td>
              <td class="num">${formatCurrency(l.amount)}</td>
              <td class="muted" style="font-size:11px">${escapeHtml(l.source_ref ?? "—")}</td>
            </tr>`,
            )
            .join("")}
          <tr>
            <td colspan="4" class="num" style="font-weight:600">Subtotal</td>
            <td class="num" style="font-weight:600">${formatCurrency(p.subtotal)}</td><td></td>
          </tr>
          <tr>
            <td colspan="4" class="num">GST @ ${p.tax_pct}%</td>
            <td class="num">${formatCurrency(p.tax_amount)}</td><td></td>
          </tr>
          <tr>
            <td colspan="4" class="num" style="font-weight:700;font-size:15px">Total</td>
            <td class="num" style="font-weight:700;font-size:15px">${formatCurrency(p.total)}</td><td></td>
          </tr>
        </tbody>
      </table>

      <div class="callout ${hasShare ? "good" : "warn"}" style="margin-top:18px">
        <strong>Performance share:</strong> ${escapeHtml(p.performance_share_note)}
      </div>

      <button class="btn btn-green" type="button" id="generateBtn" style="margin-top:16px">
        Generate this invoice as a draft
      </button>
    </div>`;
}

/* ─── Pipeline ──────────────────────────────────────────────────── */

function renderPipeline() {
  const rows = [...state.invoices].sort((a, b) => {
    const byPeriod = b.period.localeCompare(a.period);
    return byPeriod !== 0 ? byPeriod : orgName(a.organization_id).localeCompare(orgName(b.organization_id));
  });

  return `
    <div class="card">
      <h2>Invoice pipeline</h2>
      <p class="sub">Draft → issued → paid. Issuing sets a 30-day due date.</p>
      <table style="margin-top:14px">
        <thead><tr>
          <th>Client</th><th>Period</th><th>Status</th>
          <th class="num">Subtotal</th><th class="num">Total</th>
          <th>Issued</th><th>Due</th><th></th>
        </tr></thead>
        <tbody>
          ${
            rows.length === 0
              ? emptyRow(8, "No invoices yet.")
              : rows
                  .map(
                    (i) => `
            <tr>
              <td>${escapeHtml(orgName(i.organization_id))}</td>
              <td class="nowrap">${formatPeriod(i.period)}</td>
              <td>${badge(i.status)}</td>
              <td class="num">${formatCurrency(i.subtotal)}</td>
              <td class="num">${formatCurrency(i.total)}</td>
              <td class="nowrap">${formatDate(i.issued_on)}</td>
              <td class="nowrap">${formatDate(i.due_on)}</td>
              <td class="table-actions">
                ${
                  i.status === "draft"
                    ? `<button class="btn btn-dark" type="button" data-issue="${escapeHtml(i.platform_invoice_id)}">Issue</button>`
                    : i.status === "issued" || i.status === "overdue"
                      ? `<button class="btn btn-green" type="button" data-paid="${escapeHtml(i.platform_invoice_id)}">Mark paid</button>`
                      : ""
                }
              </td>
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
    state.preview = null;
    localStorage.setItem("ao_selected_org", state.orgId);
    render();
  });

  root.querySelector("#periodPick")?.addEventListener("change", (e) => {
    state.period = e.target.value;
    state.preview = null;
  });

  root.querySelector("#previewBtn")?.addEventListener("click", preview);
  root.querySelector("#generateBtn")?.addEventListener("click", generate);

  root.querySelectorAll("[data-issue]").forEach((btn) => {
    btn.onclick = () => transition(btn.dataset.issue, "issue", "Invoice issued.");
  });
  root.querySelectorAll("[data-paid]").forEach((btn) => {
    btn.onclick = () => transition(btn.dataset.paid, "mark-paid", "Payment recorded.");
  });
}

async function preview() {
  const period = document.getElementById("periodPick").value;
  if (!period) {
    showToast("Choose a period.", "warning");
    return;
  }
  state.period = period;

  try {
    state.preview = await window.api.get(
      `/platform-invoices/preview?organization_id=${state.orgId}&period=${period}`,
    );
    render();
  } catch (err) {
    state.preview = null;
    showToast(err.message, "error", 7000);
    render();
  }
}

async function generate() {
  try {
    const invoice = await window.api.post("/platform-invoices/generate", {
      organization_id: state.orgId,
      period: state.period,
    });
    state.invoices.push(invoice);
    state.preview = null;
    showToast("Draft invoice generated. Review it, then issue.", "success", 5000);
    render();
  } catch (err) {
    showToast(err.message, "error", 7000);
  }
}

async function transition(id, action, message) {
  try {
    const updated = await window.api.patch(`/platform-invoices/${id}/${action}`, {});
    const index = state.invoices.findIndex((i) => i.platform_invoice_id === id);
    if (index !== -1) state.invoices[index] = updated;
    showToast(message, "success");
    render();
  } catch (err) {
    showToast(err.message, "error", 6000);
  }
}
