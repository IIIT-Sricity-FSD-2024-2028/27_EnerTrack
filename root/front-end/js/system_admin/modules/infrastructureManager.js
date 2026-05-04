import { createId, METER_STATUSES, METER_TYPES } from "../data/mockData.js";
import { badge, escapeHtml, formValues, formatCurrency, formatLabel, openModal, showFormErrors, showToast } from "../utils/ui.js";

export function renderInfrastructureManager(container, app) {
  ensureSelectedBuilding(app);
  const selectedBuilding = app.state.buildings.find((building) => building.building_id === app.selectedBuildingId) || null;
  const buildingCards = app.state.buildings.map((building) => renderBuildingCard(building, app)).join("");
  const meters = selectedBuilding
    ? app.state.meters.filter((meter) => meter.building_id === selectedBuilding.building_id)
    : [];

  container.innerHTML = `
    <section class="infrastructure-grid">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>Buildings</h2>
            <p>Uses Building table fields: building_id, campus_id, name, budget.</p>
          </div>
          <button class="btn-dark" type="button" data-action="add-building">Add</button>
        </div>
        <div class="building-list">
          ${buildingCards || `<div class="empty-state">No buildings added yet.</div>`}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>${selectedBuilding ? escapeHtml(selectedBuilding.name) : "Meters"}</h2>
            <p>${selectedBuilding ? `${escapeHtml(getCampusName(app.state, selectedBuilding.campus_id))} - ${formatCurrency(selectedBuilding.budget)}` : "Select a building to manage linked meters."}</p>
          </div>
          <button class="btn-dark" type="button" data-action="add-meter" ${selectedBuilding ? "" : "disabled"}>Add Meter</button>
        </div>
        ${renderMeterList(meters, selectedBuilding)}
      </div>
    </section>
  `;

  wireBuildingEvents(container, app);
  wireMeterEvents(container, app, selectedBuilding);
}

function renderBuildingCard(building, app) {
  const meterCount = app.state.meters.filter((meter) => meter.building_id === building.building_id).length;
  const isActive = app.selectedBuildingId === building.building_id;

  return `
    <article class="building-card ${isActive ? "active" : ""}" data-building-card="${escapeHtml(building.building_id)}">
      <button class="building-select" type="button" data-select-building="${escapeHtml(building.building_id)}">
        <h3>${escapeHtml(building.name)}</h3>
        <div class="building-meta">
          ${escapeHtml(getCampusName(app.state, building.campus_id))} - ${formatCurrency(building.budget)} - ${meterCount} meters
        </div>
        <div class="muted-cell">${escapeHtml(building.building_id)}</div>
      </button>
      <div class="building-actions">
        <button class="icon-btn" type="button" title="Edit building" data-edit-building="${escapeHtml(building.building_id)}">Edit</button>
        <button class="icon-btn btn-danger" type="button" title="Delete building" data-delete-building="${escapeHtml(building.building_id)}">Delete</button>
      </div>
    </article>
  `;
}

function renderMeterList(meters, selectedBuilding) {
  if (!selectedBuilding) {
    return `<div class="empty-state">Add or select a building to see its meters.</div>`;
  }

  if (meters.length === 0) {
    return `<div class="empty-state">No meters linked to this building yet.</div>`;
  }

  return `
    <div class="meter-list">
      ${meters.map(renderMeterCard).join("")}
    </div>
  `;
}

function renderMeterCard(meter) {
  return `
    <article class="meter-card">
      <div class="meter-card-header">
        <div>
          <h3 class="meter-title">${escapeHtml(meter.meter_code)}</h3>
          <div class="meter-meta">${escapeHtml(formatLabel(meter.meter_type))} - ${escapeHtml(meter.zone || "No zone")}</div>
        </div>
        ${badge(meter.status)}
      </div>
      <div class="meter-schema-list">
        <span>meter_id</span><strong>${escapeHtml(meter.meter_id)}</strong>
        <span>building_id</span><strong>${escapeHtml(meter.building_id)}</strong>
      </div>
      <div class="row-actions meter-actions">
        <button class="btn-outline" type="button" data-edit-meter="${escapeHtml(meter.meter_id)}">Edit</button>
        <button class="btn-outline btn-danger" type="button" data-delete-meter="${escapeHtml(meter.meter_id)}">Delete</button>
      </div>
    </article>
  `;
}

function wireBuildingEvents(container, app) {
  container.querySelector('[data-action="add-building"]')?.addEventListener("click", () => openBuildingModal(app));
  container.querySelectorAll("[data-select-building]").forEach((button) => {
    button.addEventListener("click", () => {
      app.selectedBuildingId = button.dataset.selectBuilding;
      app.render("infrastructure");
    });
  });
  container.querySelectorAll("[data-edit-building]").forEach((button) => {
    button.addEventListener("click", () => openBuildingModal(app, button.dataset.editBuilding));
  });
  container.querySelectorAll("[data-delete-building]").forEach((button) => {
    button.addEventListener("click", () => deleteBuilding(app, button.dataset.deleteBuilding));
  });
}

function wireMeterEvents(container, app, selectedBuilding) {
  container.querySelector('[data-action="add-meter"]')?.addEventListener("click", () => {
    if (selectedBuilding) openMeterModal(app, selectedBuilding.building_id);
  });
  container.querySelectorAll("[data-edit-meter]").forEach((button) => {
    button.addEventListener("click", () => openMeterModal(app, selectedBuilding?.building_id, button.dataset.editMeter));
  });
  container.querySelectorAll("[data-delete-meter]").forEach((button) => {
    button.addEventListener("click", () => deleteMeter(app, button.dataset.deleteMeter));
  });
}

function openBuildingModal(app, buildingId = null) {
  const building = app.state.buildings.find((item) => item.building_id === buildingId) || null;
  const title = building ? "Edit Building" : "Add Building";

  openModal({
    title,
    confirmLabel: building ? "Save Building" : "Add Building",
    bodyHtml: `
      <form class="form-grid">
        <div class="form-field full">
          <label for="buildingName">Building Name</label>
          <input id="buildingName" value="${escapeHtml(building?.name || "")}" placeholder="Block A - Main Building">
          <span class="field-error" data-error-for="name"></span>
        </div>
        <div class="form-field">
          <label for="campusId">Campus</label>
          <select id="campusId">
            ${app.state.campuses.map((campus) => `
              <option value="${escapeHtml(campus.campus_id)}" ${building?.campus_id === campus.campus_id ? "selected" : ""}>
                ${escapeHtml(campus.name)}
              </option>
            `).join("")}
          </select>
          <span class="field-error" data-error-for="campus_id"></span>
        </div>
        <div class="form-field">
          <label for="buildingBudget">Budget</label>
          <input id="buildingBudget" type="number" min="0" step="0.01" value="${escapeHtml(building?.budget || "0")}">
          <span class="field-error" data-error-for="budget"></span>
        </div>
      </form>
    `,
    onConfirm: (modal) => {
      const values = formValues(modal, {
        name: "#buildingName",
        campus_id: "#campusId",
        budget: "#buildingBudget"
      });
      const errors = validateBuilding(values, app.state.campuses);

      if (Object.keys(errors).length > 0) {
        showFormErrors(modal, errors);
        return false;
      }

      app.update((state) => {
        if (buildingId) {
          const target = state.buildings.find((item) => item.building_id === buildingId);
          Object.assign(target, {
            name: values.name,
            campus_id: values.campus_id,
            budget: Number(values.budget)
          });
        } else {
          const newBuilding = {
            building_id: createId("building"),
            campus_id: values.campus_id,
            name: values.name,
            budget: Number(values.budget)
          };
          state.buildings.push(newBuilding);
          app.selectedBuildingId = newBuilding.building_id;
        }
      }, buildingId ? "Building updated." : "Building added.");
      return true;
    }
  });
}

function deleteBuilding(app, buildingId) {
  const building = app.state.buildings.find((item) => item.building_id === buildingId);
  if (!building) {
    showToast("Building not found.", "error");
    return;
  }

  const linkedMeters = app.state.meters.filter((meter) => meter.building_id === buildingId).length;
  openModal({
    title: "Delete Building",
    confirmLabel: "Delete",
    danger: true,
    bodyHtml: `
      <p>Delete <strong>${escapeHtml(building.name)}</strong> from the Building mock table?</p>
      <p class="delete-note">${linkedMeters} linked meter${linkedMeters === 1 ? "" : "s"} will also be removed.</p>
    `,
    onConfirm: () => {
      const remaining = app.state.buildings.filter((item) => item.building_id !== buildingId);
      app.selectedBuildingId = remaining[0]?.building_id || null;
      app.update((state) => {
        state.buildings = state.buildings.filter((item) => item.building_id !== buildingId);
        state.meters = state.meters.filter((meter) => meter.building_id !== buildingId);
      }, "Building deleted.");
      return true;
    }
  });
}

function openMeterModal(app, buildingId, meterId = null) {
  const meter = app.state.meters.find((item) => item.meter_id === meterId) || null;
  const title = meter ? "Edit Meter" : "Add Meter";

  openModal({
    title,
    confirmLabel: meter ? "Save Meter" : "Add Meter",
    bodyHtml: `
      <form class="form-grid">
        <div class="form-field">
          <label for="meterCode">Meter Code</label>
          <input id="meterCode" value="${escapeHtml(meter?.meter_code || "")}" placeholder="ET-A-ELEC-001">
          <span class="field-error" data-error-for="meter_code"></span>
        </div>
        <div class="form-field">
          <label for="meterType">Meter Type</label>
          <select id="meterType">
            ${METER_TYPES.map((type) => `
              <option value="${escapeHtml(type)}" ${meter?.meter_type === type ? "selected" : ""}>${escapeHtml(formatLabel(type))}</option>
            `).join("")}
          </select>
          <span class="field-error" data-error-for="meter_type"></span>
        </div>
        <div class="form-field">
          <label for="meterZone">Zone</label>
          <input id="meterZone" value="${escapeHtml(meter?.zone || "")}" placeholder="Main LT Panel">
          <span class="field-error" data-error-for="zone"></span>
        </div>
        <div class="form-field">
          <label for="meterStatus">Status</label>
          <select id="meterStatus">
            ${METER_STATUSES.map((status) => `
              <option value="${escapeHtml(status)}" ${meter?.status === status ? "selected" : ""}>${escapeHtml(formatLabel(status))}</option>
            `).join("")}
          </select>
          <span class="field-error" data-error-for="status"></span>
        </div>
      </form>
    `,
    onConfirm: (modal) => {
      const values = formValues(modal, {
        meter_code: "#meterCode",
        meter_type: "#meterType",
        zone: "#meterZone",
        status: "#meterStatus"
      });
      const errors = validateMeter(values, app.state.meters, meterId);

      if (Object.keys(errors).length > 0) {
        showFormErrors(modal, errors);
        return false;
      }

      app.update((state) => {
        if (meterId) {
          const target = state.meters.find((item) => item.meter_id === meterId);
          Object.assign(target, {
            building_id: buildingId,
            meter_code: values.meter_code.toUpperCase(),
            meter_type: values.meter_type,
            zone: values.zone || null,
            status: values.status
          });
        } else {
          state.meters.push({
            meter_id: createId("meter"),
            building_id: buildingId,
            meter_code: values.meter_code.toUpperCase(),
            meter_type: values.meter_type,
            zone: values.zone || null,
            status: values.status
          });
        }
      }, meterId ? "Meter updated." : "Meter added.");
      return true;
    }
  });
}

function deleteMeter(app, meterId) {
  const meter = app.state.meters.find((item) => item.meter_id === meterId);
  if (!meter) {
    showToast("Meter not found.", "error");
    return;
  }

  openModal({
    title: "Delete Meter",
    confirmLabel: "Delete",
    danger: true,
    bodyHtml: `<p>Delete <strong>${escapeHtml(meter.meter_code)}</strong> from the Meter mock table?</p>`,
    onConfirm: () => {
      app.update((state) => {
        state.meters = state.meters.filter((item) => item.meter_id !== meterId);
      }, "Meter deleted.");
      return true;
    }
  });
}

function ensureSelectedBuilding(app) {
  if (app.selectedBuildingId && app.state.buildings.some((building) => building.building_id === app.selectedBuildingId)) return;
  app.selectedBuildingId = app.state.buildings[0]?.building_id || null;
}

function validateBuilding(values, campuses) {
  const errors = {};
  const budget = Number(values.budget);

  if (!values.name || values.name.length < 3) errors.name = "Enter a building name.";
  if (!campuses.some((campus) => campus.campus_id === values.campus_id)) errors.campus_id = "Select a valid campus.";
  if (!Number.isFinite(budget) || budget < 0) errors.budget = "Enter a valid budget.";

  return errors;
}

function validateMeter(values, meters, editingId) {
  const errors = {};

  if (!values.meter_code || values.meter_code.length < 3) errors.meter_code = "Enter a meter code.";
  else if (meters.some((item) => item.meter_id !== editingId && item.meter_code.toLowerCase() === values.meter_code.toLowerCase())) {
    errors.meter_code = "This meter code already exists.";
  }
  if (!METER_TYPES.includes(values.meter_type)) errors.meter_type = "Select a valid DB meter type.";
  if (values.zone && values.zone.length > 80) errors.zone = "Zone must be 80 characters or fewer.";
  if (!METER_STATUSES.includes(values.status)) errors.status = "Select a valid DB meter status.";

  return errors;
}

function getCampusName(state, campusId) {
  return state.campuses.find((campus) => campus.campus_id === campusId)?.name || "Unknown Campus";
}
