/**
 * findingsPage.js
 * Certified Energy Auditor — recommendations register.
 *
 * A finding is not just documentation here; it is the attribution rule for
 * the performance share. Two of its fields decide money:
 *
 *   building_ids   which meters a savings claim may count
 *   implemented_on from which month it may count them
 *
 * The pricing page promises the share is "payable only where recommendations
 * were implemented", and this is where that becomes true. A finding sitting
 * in proposed or accepted contributes nothing to any invoice, which is why
 * moving one to implemented is treated as a deliberate act with a date
 * attached rather than a casual status flip.
 */
import {
  badge,
  emptyRow,
  escapeHtml,
  formatCurrency,
  formatDate,
  formValues,
  loadOrFail,
  openModal,
  requireAuditor,
  showToast,
} from "./utils/utils.js";

const STATUSES = ["proposed", "accepted", "implemented", "verified", "rejected"];
const SEVERITIES = ["low", "moderate", "high"];

const state = { audits: [], orgs: [], buildings: [], selectedId: null };

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuditor()) return;

  const root = document.getElementById("auditorApp");
  root.innerHTML = `<div class="card"><p class="muted">Loading findings…</p></div>`;

  const [audits, orgs, buildings] = await Promise.all([
    loadOrFail(() => window.api.get("/energy-audits"), "audits"),
    loadOrFail(() => window.api.get("/organizations"), "organisations"),
    loadOrFail(() => window.api.get("/buildings"), "buildings"),
  ]);

  if (!audits) {
    root.innerHTML = `<div class="card"><h2>Backend unavailable</h2><p class="muted">Start the API on port 3000 and reload.</p></div>`;
    return;
  }

  state.audits = audits;
  state.orgs = orgs || [];
  state.buildings = buildings || [];

  const handed = localStorage.getItem("auditor_selected_audit");
  state.selectedId =
    (handed && audits.some((a) => a.audit_id === handed) && handed) ||
    audits[0]?.audit_id ||
    null;

  render();
});

const selected = () =>
  state.audits.find((a) => a.audit_id === state.selectedId) || null;

const orgName = (id) =>
  state.orgs.find((o) => o.organization_id === id)?.name ?? id;

const buildingName = (id) =>
  state.buildings.find((b) => b.building_id === id)?.name ?? id;

/** Buildings belonging to the audited tenant — the only valid scope. */
const tenantBuildings = (audit) =>
  state.buildings.filter((b) => b.organization_id === audit.organization_id);

function render() {
  const root = document.getElementById("auditorApp");
  const audit = selected();

  root.innerHTML = `
    <div class="card">
      <div class="toolbar" style="margin-bottom:0">
        <div class="field">
          <label for="auditPick">Engagement</label>
          <select id="auditPick">
            ${state.audits
              .map(
                (a) =>
                  `<option value="${escapeHtml(a.audit_id)}" ${a.audit_id === state.selectedId ? "selected" : ""}>
                     ${escapeHtml(orgName(a.organization_id))} — ${escapeHtml(a.status)}
                   </option>`,
              )
              .join("")}
          </select>
        </div>
        <button class="btn btn-dark" type="button" id="addFinding" ${audit ? "" : "disabled"}>
          + Add finding
        </button>
      </div>
    </div>

    ${audit ? renderSummary(audit) : ""}
    ${audit ? renderTable(audit) : `<div class="card"><p class="muted">No engagements.</p></div>`}`;

  wire();
}

function renderSummary(audit) {
  const findings = audit.findings || [];
  const implemented = findings.filter(
    (f) => f.status === "implemented" || f.status === "verified",
  );
  const capex = findings.reduce((sum, f) => sum + (f.capex || 0), 0);
  const saving = findings.reduce((sum, f) => sum + (f.est_annual_saving || 0), 0);
  const creditable = implemented.reduce(
    (sum, f) => sum + (f.est_annual_saving || 0),
    0,
  );

  return `
    <div class="grid4" style="margin-bottom:20px">
      ${tile("Recommendations", findings.length, `${implemented.length} implemented`)}
      ${tile("Estimated annual saving", formatCurrency(saving), "If all were implemented")}
      ${tile("Creditable today", formatCurrency(creditable), "Only implemented measures count", "pos")}
      ${tile("Total capex", formatCurrency(capex), "Client's investment")}
    </div>
    ${
      implemented.length === 0
        ? `<div class="callout warn" style="margin-bottom:20px">
             Nothing is implemented on this engagement, so no savings claim can
             be raised for it yet and no performance share is billable.
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

function renderTable(audit) {
  const findings = audit.findings || [];
  return `
    <div class="card">
      <h2>Findings</h2>
      <p class="sub">
        Buildings scope which meters a savings claim may credit; the
        implementation date scopes from which month.
      </p>
      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Measure</th><th>Category</th><th>Severity</th>
            <th class="num">Annual saving</th><th class="num">Capex</th>
            <th class="num">Payback</th><th>Buildings</th>
            <th>Status</th><th>Implemented</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${
            findings.length === 0
              ? emptyRow(10, "No findings recorded on this engagement.")
              : findings
                  .map(
                    (f) => `
            <tr>
              <td style="max-width:260px">${escapeHtml(f.title)}</td>
              <td>${escapeHtml(f.category)}</td>
              <td>${badge(f.severity)}</td>
              <td class="num">${formatCurrency(f.est_annual_saving)}</td>
              <td class="num">${formatCurrency(f.capex)}</td>
              <td class="num">${f.payback_months || "—"} mo</td>
              <td style="font-size:12px">
                ${(f.building_ids || []).map((b) => escapeHtml(buildingName(b))).join(", ") || "—"}
              </td>
              <td>${badge(f.status)}</td>
              <td class="nowrap">${f.implemented_on ? formatDate(f.implemented_on) : "—"}</td>
              <td class="table-actions">
                <button class="btn btn-light" type="button"
                        data-edit="${escapeHtml(f.finding_id)}">Edit</button>
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
  const root = document.getElementById("auditorApp");

  root.querySelector("#auditPick")?.addEventListener("change", (e) => {
    state.selectedId = e.target.value;
    localStorage.setItem("auditor_selected_audit", state.selectedId);
    render();
  });

  root.querySelector("#addFinding")?.addEventListener("click", () => openFindingModal());

  root.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => openFindingModal(btn.dataset.edit);
  });
}

function openFindingModal(findingId) {
  const audit = selected();
  const finding = findingId
    ? audit.findings.find((f) => f.finding_id === findingId)
    : null;
  const chosen = new Set(finding?.building_ids || []);

  openModal({
    title: finding ? "Edit finding" : "New finding",
    confirmLabel: finding ? "Save changes" : "Add finding",
    bodyHTML: `
      <div class="field">
        <label>Measure</label>
        <input name="title" value="${escapeHtml(finding?.title ?? "")}"
               placeholder="e.g. Chiller plant sequencing on return-water temperature" />
      </div>
      <div class="grid2">
        <div class="field">
          <label>Category</label>
          <input name="category" value="${escapeHtml(finding?.category ?? "")}"
                 placeholder="HVAC, Lighting, Generation…" />
        </div>
        <div class="field">
          <label>Severity</label>
          <select name="severity">
            ${SEVERITIES.map(
              (s) =>
                `<option value="${s}" ${finding?.severity === s ? "selected" : ""}>${s}</option>`,
            ).join("")}
          </select>
        </div>
      </div>
      <div class="grid2">
        <div class="field">
          <label>Estimated annual saving (₹)</label>
          <input name="est_annual_saving" type="number" min="0"
                 value="${finding?.est_annual_saving ?? 0}" />
        </div>
        <div class="field">
          <label>Capex (₹)</label>
          <input name="capex" type="number" min="0" value="${finding?.capex ?? 0}" />
        </div>
      </div>
      ${
        finding
          ? `<div class="field">
               <label>Status</label>
               <select name="status">
                 ${STATUSES.map(
                   (s) =>
                     `<option value="${s}" ${finding.status === s ? "selected" : ""}>${s}</option>`,
                 ).join("")}
               </select>
             </div>
             <div class="field">
               <label>Implemented on (leave blank to stamp today)</label>
               <input name="implemented_on" type="date" value="${finding.implemented_on ?? ""}" />
             </div>
             <div class="callout warn" style="margin-bottom:12px">
               Setting this to <strong>implemented</strong> makes the measure
               creditable from that date. Reverting it withdraws the claim.
             </div>`
          : ""
      }
      <div class="field">
        <label>Buildings affected</label>
        <div class="pick-list" style="max-height:180px">
          ${tenantBuildings(audit)
            .map(
              (b) => `
            <label class="pick" style="display:flex;gap:10px;align-items:center;cursor:pointer">
              <input type="checkbox" data-building="${escapeHtml(b.building_id)}"
                     ${chosen.has(b.building_id) ? "checked" : ""}
                     style="width:auto;margin:0" />
              <span>${escapeHtml(b.name)}</span>
            </label>`,
            )
            .join("")}
        </div>
        <p class="muted" style="font-size:11px;margin-top:6px">
          Only meters in these buildings can be credited with this measure's savings.
        </p>
      </div>`,
    onConfirm: async (overlay) => {
      const values = formValues(overlay);
      const buildingIds = [...overlay.querySelectorAll("[data-building]")]
        .filter((cb) => cb.checked)
        .map((cb) => cb.dataset.building);

      if (!values.title) {
        showToast("A measure needs a title.", "warning");
        return false;
      }
      if (buildingIds.length === 0) {
        showToast(
          "Pick at least one building — without a scope the measure can never be credited.",
          "warning",
          6000,
        );
        return false;
      }

      const body = {
        title: values.title,
        category: values.category || "General",
        severity: values.severity,
        est_annual_saving: Number(values.est_annual_saving) || 0,
        capex: Number(values.capex) || 0,
        building_ids: buildingIds,
      };

      try {
        if (finding) {
          if (values.status) body.status = values.status;
          if (values.implemented_on) body.implemented_on = values.implemented_on;
          const updated = await window.api.patch(
            `/energy-audits/${audit.audit_id}/findings/${finding.finding_id}`,
            body,
          );
          Object.assign(finding, updated);
          showToast("Finding updated.", "success");
        } else {
          const created = await window.api.post(
            `/energy-audits/${audit.audit_id}/findings`,
            body,
          );
          audit.findings.push(created);
          showToast("Finding added.", "success");
        }
        render();
        return true;
      } catch (err) {
        showToast(err.message, "error", 7000);
        return false;
      }
    },
  });
}
