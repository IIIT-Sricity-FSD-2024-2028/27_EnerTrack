import {
  badge,
  escapeHtml,
  formValues,
  formatCurrency,
  openModal,
  showFormErrors,
  showToast,
} from "../utils/ui.js";

/* ══════════════════════════════════════════════════════
   Organisations Manager — the tenant list

   An organisation is the tenant boundary: the customer EnerTrack holds a
   contract with. Campuses, buildings, departments and meters all hang
   beneath one.

   WHAT you see is decided entirely by the backend, not here:

     Super Admin (no x-org-id)  ->  every client organisation
     A client's own admin       ->  their own organisation only

   WHETHER you can change it is decided by the backend too: the write routes
   are @Roles("Super Admin") and answer 403 for anyone else. The one role
   check in this file only hides buttons that would fail, so a client admin
   sees their own record read-only instead of clicking Delete and collecting
   an error toast. It is cosmetic, and removing it would not grant anybody
   anything.
   ══════════════════════════════════════════════════════ */

const STATUSES = ["prospect", "audited", "active", "churned"];

export function renderOrganizationsManager(container, app) {
  const orgs = app.state.organizations || [];
  const isPlatformView = !currentOrgId();
  const canWrite = isSuperAdmin();

  const rows = orgs.map((o) => renderOrgRow(o, app, canWrite)).join("");
  const emptyRow = `<tr><td colspan="8"><div class="empty-state">No organisations found.</div></td></tr>`;

  const subtitle = isPlatformView
    ? "Every client organisation on the platform. Each one is an isolated tenant."
    : canWrite
      ? "Your organisation. Other tenants are not visible from this account."
      : "Your organisation. Only EnerTrack staff can change these details.";

  container.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Organisations</h2>
          <p>${subtitle}</p>
        </div>
        ${canWrite ? `<button class="btn-dark" type="button" data-action="add-org">+ Add Organisation</button>` : ""}
      </div>

      <div class="table-card">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Type</th>
                <th>Location</th>
                <th>Status</th>
                <th>Floor area</th>
                <th>Tariff</th>
                <th>Campuses</th>
                <th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>${rows || emptyRow}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  container
    .querySelector('[data-action="add-org"]')
    ?.addEventListener("click", () => openOrgModal(app));
  container.querySelectorAll("[data-edit-org]").forEach((b) => {
    b.addEventListener("click", () => openOrgModal(app, b.dataset.editOrg));
  });
  container.querySelectorAll("[data-delete-org]").forEach((b) => {
    b.addEventListener("click", () => deleteOrg(b.dataset.deleteOrg, app));
  });
}

/** True when the signed-in user is EnerTrack's platform operator. */
function isSuperAdmin() {
  try {
    const u = JSON.parse(localStorage.getItem("currentUser") || "null");
    return !!u && u.role === "Super Admin";
  } catch (_) {
    return false;
  }
}

/** Tenant of the signed-in user, or null for EnerTrack staff. */
function currentOrgId() {
  try {
    const u = JSON.parse(localStorage.getItem("currentUser") || "null");
    return u && u.organization_id ? u.organization_id : null;
  } catch (_) {
    return null;
  }
}

function renderOrgRow(org, app, canWrite) {
  // Campuses already in state are scoped to the same tenant, so this is a
  // local count rather than another round trip.
  const campusCount = (app.state.campuses || []).filter(
    (c) => c.organization_id === org.organization_id,
  ).length;

  const isMine = org.organization_id === currentOrgId();
  const youTag = isMine
    ? `<span class="badge active" style="margin-left:6px">You</span>`
    : "";

  const area = org.floor_area_sqm
    ? escapeHtml(Number(org.floor_area_sqm).toLocaleString("en-IN")) + " m&sup2;"
    : "-";
  const tariff = org.tariff_rate
    ? formatCurrency(org.tariff_rate) + " /unit"
    : "-";

  return `
    <tr>
      <td>
        <strong>${escapeHtml(org.name)}</strong>${youTag}
        <div class="muted-cell">${escapeHtml(org.organization_id)}</div>
      </td>
      <td>${escapeHtml(org.type || "-")}</td>
      <td>${escapeHtml(org.location || "-")}</td>
      <td>${badge(org.status || "prospect")}</td>
      <td>${area}</td>
      <td>${tariff}</td>
      <td>${campusCount}</td>
      <td>
        ${
          canWrite
            ? `<div class="row-actions">
          <button class="icon-btn" type="button" data-edit-org="${escapeHtml(org.organization_id)}">Edit</button>
          <button class="icon-btn btn-danger" type="button" data-delete-org="${escapeHtml(org.organization_id)}">Delete</button>
        </div>`
            : `<span class="muted-cell">Read only</span>`
        }
      </td>
    </tr>`;
}

function options(list, selected) {
  return list
    .map((v) => {
      const sel = v === selected ? " selected" : "";
      return `<option value="${escapeHtml(v)}"${sel}>${escapeHtml(v)}</option>`;
    })
    .join("");
}

function openOrgModal(app, orgId = null) {
  const org =
    (app.state.organizations || []).find((o) => o.organization_id === orgId) ||
    null;

  openModal({
    title: org ? "Edit Organisation" : "Add Organisation",
    confirmLabel: org ? "Save Organisation" : "Add Organisation",
    bodyHtml: `
      <form class="form-grid">
        <div class="form-field full">
          <label for="orgName">Name</label>
          <input id="orgName" value="${escapeHtml(org?.name || "")}" placeholder="Riverside Polytechnic">
          <span class="field-error" data-error-for="name"></span>
        </div>
        <div class="form-field">
          <label for="orgType">Type</label>
          <input id="orgType" value="${escapeHtml(org?.type || "")}" placeholder="University">
          <span class="field-error" data-error-for="type"></span>
        </div>
        <div class="form-field">
          <label for="orgLocation">Location</label>
          <input id="orgLocation" value="${escapeHtml(org?.location || "")}" placeholder="Pune, Maharashtra">
          <span class="field-error" data-error-for="location"></span>
        </div>
        ${
          org
            ? `<div class="form-field">
                 <label for="orgStatus">Status</label>
                 <select id="orgStatus">${options(STATUSES, org?.status || "prospect")}</select>
                 <span class="field-error" data-error-for="status"></span>
               </div>`
            : // A new organisation is always a prospect. Status now moves on
              // its own as the engagement progresses — audited once EnerTrack
              // sends a proposal, active once the client accepts it — so
              // picking it by hand here would just fight that automation the
              // first time a proposal actually goes out.
              ""
        }
        <div class="form-field">
          <label for="orgArea">Floor area (m&sup2;)</label>
          <input id="orgArea" type="number" min="0" step="1" value="${escapeHtml(org?.floor_area_sqm ?? "")}">
          <span class="field-error" data-error-for="floor_area_sqm"></span>
        </div>
        <div class="form-field">
          <label for="orgTariff">Tariff rate (per unit)</label>
          <input id="orgTariff" type="number" min="0" step="0.01" value="${escapeHtml(org?.tariff_rate ?? "")}">
          <span class="field-error" data-error-for="tariff_rate"></span>
        </div>
        <div class="form-field">
          <label for="orgContract">Contract start</label>
          <input id="orgContract" type="date" value="${escapeHtml(org?.contract_start || "")}">
          <span class="field-error" data-error-for="contract_start"></span>
        </div>
      </form>`,
    onConfirm: (modal) => {
      const vals = formValues(modal, {
        name: "#orgName",
        type: "#orgType",
        location: "#orgLocation",
        status: "#orgStatus",
        floor_area_sqm: "#orgArea",
        tariff_rate: "#orgTariff",
        contract_start: "#orgContract",
      });

      const errors = {};
      if (!vals.name || vals.name.length < 3)
        errors.name = "Enter an organisation name (min 3 chars).";
      if (!vals.type) errors.type = "Enter a type, for example University.";
      if (vals.floor_area_sqm !== "" && Number(vals.floor_area_sqm) < 0)
        errors.floor_area_sqm = "Enter a positive number.";
      if (vals.tariff_rate !== "" && Number(vals.tariff_rate) < 0)
        errors.tariff_rate = "Enter a positive number.";
      if (Object.keys(errors).length) {
        showFormErrors(modal, errors);
        return false;
      }

      const payload = {
        name: vals.name,
        type: vals.type,
        location: vals.location || null,
        // #orgStatus doesn't exist in the DOM on creation (see above), so
        // vals.status would otherwise come back "" — not a valid
        // OrganizationStatus and not what a new organisation should be.
        status: orgId ? vals.status : "prospect",
        floor_area_sqm:
          vals.floor_area_sqm === "" ? null : Number(vals.floor_area_sqm),
        tariff_rate: vals.tariff_rate === "" ? null : Number(vals.tariff_rate),
        contract_start: vals.contract_start || null,
      };

      app.update(async (state) => {
        try {
          if (orgId) {
            await window.api.patch("/organizations/" + orgId, payload);
          } else {
            await window.api.post("/organizations", payload);
          }
          state.organizations = await window.api.get("/organizations");
        } catch (err) {
          console.error("Organisation save failed:", err);
          showToast(err.message || "Could not save organisation.", "error");
        }
      }, org ? "Organisation updated." : "Organisation added.");
      return true;
    },
  });
}

function deleteOrg(orgId, app) {
  const org = (app.state.organizations || []).find(
    (o) => o.organization_id === orgId,
  );
  if (!org) return;

  openModal({
    title: "Delete Organisation",
    // The backend refuses to delete an organisation that still owns campuses,
    // so this warning describes a rule that is genuinely enforced server side.
    bodyHtml: `<p>Delete <strong>${escapeHtml(org.name)}</strong>?</p>
               <p class="muted-cell">An organisation that still owns campuses cannot be deleted.</p>`,
    confirmLabel: "Delete",
    danger: true,
    onConfirm: () => {
      app.update(async (state) => {
        try {
          await window.api.delete("/organizations/" + orgId);
          state.organizations = await window.api.get("/organizations");
        } catch (err) {
          console.error("Organisation delete failed:", err);
          showToast(err.message || "Could not delete organisation.", "error");
        }
      }, "Organisation deleted.");
      return true;
    },
  });
}
