import { createId, METER_STATUSES, METER_TYPES } from "../data/mockData.js";
import { badge, escapeHtml, formValues, formatCurrency, formatLabel, openModal, showFormErrors, showToast } from "../utils/ui.js";

/* ══════════════════════════════════════════════════════
   Infrastructure Manager — Campus → Building → Department → Meter
   ══════════════════════════════════════════════════════ */

export function renderInfrastructureManager(container, app) {
  ensureSelections(app);

  const selCampus = app.state.campuses.find(c => c.campus_id === app.selectedCampusId) || null;
  const selBuilding = app.state.buildings.find(b => b.building_id === app.selectedBuildingId) || null;

  const campusBuildings = selCampus ? app.state.buildings.filter(b => b.campus_id === selCampus.campus_id) : [];
  const buildingDepts = selBuilding ? app.state.departments.filter(d => d.building_id === selBuilding.building_id) : [];
  const buildingMeters = selBuilding ? app.state.meters.filter(m => m.building_id === selBuilding.building_id) : [];

  container.innerHTML = `
    <section class="infra-layout">
      <!-- CAMPUS ROW — horizontal scrollable cards -->
      <div class="panel campus-panel">
        <div class="panel-header">
          <div><h2>Campuses</h2><p>Select a campus to manage its buildings, departments & meters</p></div>
          <button class="btn-dark" type="button" data-action="add-campus">+ Add Campus</button>
        </div>
        <div class="campus-row">
          ${app.state.campuses.map(c => renderCampusCard(c, app)).join("") || `<div class="empty-state">No campuses yet.</div>`}
        </div>
      </div>

      <!-- BOTTOM ROW — Buildings + Meters side by side -->
      <div class="infra-bottom">
        <!-- BUILDING + DEPARTMENT PANEL -->
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2>${selCampus ? escapeHtml(selCampus.name) + " — Buildings" : "Buildings & Departments"}</h2>
              <p>${selCampus ? `${escapeHtml(selCampus.location || "—")} · Budget ${formatCurrency(selCampus.total_budget)}` : "Select a campus above to manage its buildings."}</p>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0">
              <button class="btn-dark" type="button" data-action="add-building" ${selCampus ? "" : "disabled"}>+ Building</button>
              <button class="btn-outline" type="button" data-action="add-dept" ${selBuilding ? "" : "disabled"}>+ Department</button>
            </div>
          </div>
          ${renderBuildingDeptList(campusBuildings, buildingDepts, app)}
        </div>

        <!-- METER PANEL -->
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2>Meters</h2>
              <p>${selBuilding ? `Showing meters for ${escapeHtml(selBuilding.name)}` : "Select a building to view its meters."}</p>
            </div>
            <button class="btn-dark" type="button" data-action="add-meter" ${selBuilding ? "" : "disabled"}>+ Add Meter</button>
          </div>
          ${renderMeterList(buildingMeters, selBuilding)}
        </div>
      </div>
    </section>
  `;

  wireAllEvents(container, app, selCampus, selBuilding);
}

/* ── CAMPUS CARD ──────────────────────────────── */
function renderCampusCard(campus, app) {
  const bCount = app.state.buildings.filter(b => b.campus_id === campus.campus_id).length;
  const isActive = app.selectedCampusId === campus.campus_id;
  return `
    <article class="building-card ${isActive ? "active" : ""}" data-campus-card="${escapeHtml(campus.campus_id)}">
      <button class="building-select" type="button" data-select-campus="${escapeHtml(campus.campus_id)}">
        <h3>${escapeHtml(campus.name)}</h3>
        <div class="building-meta">${escapeHtml(campus.location || "—")} · ${formatCurrency(campus.total_budget)} · ${bCount} building(s)</div>
        <div class="muted-cell">${escapeHtml(campus.campus_id)}</div>
      </button>
      <div class="building-actions">
        <button class="icon-btn" type="button" title="Edit" data-edit-campus="${escapeHtml(campus.campus_id)}">Edit</button>
        <button class="icon-btn btn-danger" type="button" title="Delete" data-delete-campus="${escapeHtml(campus.campus_id)}">Delete</button>
      </div>
    </article>`;
}

/* ── BUILDING + DEPT LIST ─────────────────────── */
function renderBuildingDeptList(buildings, depts, app) {
  if (buildings.length === 0) return `<div class="empty-state">No buildings in this campus.</div>`;

  return `<div class="building-list">${buildings.map(b => {
    const isActive = app.selectedBuildingId === b.building_id;
    const mCount = app.state.meters.filter(m => m.building_id === b.building_id).length;
    const bDepts = app.state.departments.filter(d => d.building_id === b.building_id);
    const deptsHtml = bDepts.length > 0
      ? `<div class="dept-list">${bDepts.map(d => `
          <div class="dept-item">
            <span>↳ ${escapeHtml(d.name)} <small class="muted-cell">${formatCurrency(d.budget)}</small></span>
            <span class="dept-actions">
              <button class="icon-btn" type="button" data-edit-dept="${escapeHtml(d.department_id)}">Edit</button>
              <button class="icon-btn btn-danger" type="button" data-delete-dept="${escapeHtml(d.department_id)}">Delete</button>
            </span>
          </div>`).join("")}</div>`
      : "";

    return `
    <article class="building-card ${isActive ? "active" : ""}">
      <button class="building-select" type="button" data-select-building="${escapeHtml(b.building_id)}">
        <h3>${escapeHtml(b.name)}</h3>
        <div class="building-meta">${formatCurrency(b.budget)} · ${mCount} meter(s) · ${bDepts.length} dept(s)</div>
        <div class="muted-cell">${escapeHtml(b.building_id)}</div>
      </button>
      <div class="building-actions">
        <button class="icon-btn" type="button" data-edit-building="${escapeHtml(b.building_id)}">Edit</button>
        <button class="icon-btn btn-danger" type="button" data-delete-building="${escapeHtml(b.building_id)}">Delete</button>
      </div>
      ${deptsHtml}
    </article>`;
  }).join("")}</div>`;
}

/* ── METER LIST ───────────────────────────────── */
function renderMeterList(meters, selBuilding) {
  if (!selBuilding) return `<div class="empty-state">Select a building to see its meters.</div>`;
  if (meters.length === 0) return `<div class="empty-state">No meters linked to this building.</div>`;
  return `<div class="meter-list">${meters.map(renderMeterCard).join("")}</div>`;
}

function renderMeterCard(meter) {
  return `
    <article class="meter-card">
      <div class="meter-card-header">
        <div>
          <h3 class="meter-title">${escapeHtml(meter.meter_code)}</h3>
          <div class="meter-meta">${escapeHtml(formatLabel(meter.meter_type))} · ${escapeHtml(meter.zone || "No zone")}</div>
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
    </article>`;
}

/* ══════════════════════════════════════════════════════
   EVENT WIRING
   ══════════════════════════════════════════════════════ */
function wireAllEvents(container, app, selCampus, selBuilding) {
  // Campus
  container.querySelector('[data-action="add-campus"]')?.addEventListener("click", () => openCampusModal(app));
  container.querySelectorAll("[data-select-campus]").forEach(btn => {
    btn.addEventListener("click", () => { app.selectedCampusId = btn.dataset.selectCampus; app.selectedBuildingId = null; app.render("infrastructure"); });
  });
  container.querySelectorAll("[data-edit-campus]").forEach(btn => btn.addEventListener("click", () => openCampusModal(app, btn.dataset.editCampus)));
  container.querySelectorAll("[data-delete-campus]").forEach(btn => btn.addEventListener("click", () => deleteCampus(app, btn.dataset.deleteCampus)));

  // Building
  container.querySelector('[data-action="add-building"]')?.addEventListener("click", () => { if (selCampus) openBuildingModal(app); });
  container.querySelectorAll("[data-select-building]").forEach(btn => {
    btn.addEventListener("click", () => { app.selectedBuildingId = btn.dataset.selectBuilding; app.render("infrastructure"); });
  });
  container.querySelectorAll("[data-edit-building]").forEach(btn => btn.addEventListener("click", () => openBuildingModal(app, btn.dataset.editBuilding)));
  container.querySelectorAll("[data-delete-building]").forEach(btn => btn.addEventListener("click", () => deleteBuilding(app, btn.dataset.deleteBuilding)));

  // Department
  container.querySelector('[data-action="add-dept"]')?.addEventListener("click", () => { if (selBuilding) openDeptModal(app); });
  container.querySelectorAll("[data-edit-dept]").forEach(btn => btn.addEventListener("click", () => openDeptModal(app, btn.dataset.editDept)));
  container.querySelectorAll("[data-delete-dept]").forEach(btn => btn.addEventListener("click", () => deleteDept(app, btn.dataset.deleteDept)));

  // Meter
  container.querySelector('[data-action="add-meter"]')?.addEventListener("click", () => { if (selBuilding) openMeterModal(app, selBuilding.building_id); });
  container.querySelectorAll("[data-edit-meter]").forEach(btn => btn.addEventListener("click", () => openMeterModal(app, selBuilding?.building_id, btn.dataset.editMeter)));
  container.querySelectorAll("[data-delete-meter]").forEach(btn => btn.addEventListener("click", () => deleteMeter(app, btn.dataset.deleteMeter)));
}

/* ══════════════════════════════════════════════════════
   CAMPUS CRUD
   ══════════════════════════════════════════════════════ */
function openCampusModal(app, campusId = null) {
  const campus = app.state.campuses.find(c => c.campus_id === campusId) || null;
  openModal({
    title: campus ? "Edit Campus" : "Add Campus",
    confirmLabel: campus ? "Save Campus" : "Add Campus",
    bodyHtml: `
      <form class="form-grid">
        <div class="form-field full">
          <label for="campusName">Name</label>
          <input id="campusName" value="${escapeHtml(campus?.name || "")}" placeholder="Main University Campus">
          <span class="field-error" data-error-for="name"></span>
        </div>
        <div class="form-field">
          <label for="campusLocation">Location</label>
          <input id="campusLocation" value="${escapeHtml(campus?.location || "")}" placeholder="City Center">
          <span class="field-error" data-error-for="location"></span>
        </div>
        <div class="form-field">
          <label for="campusBudget">Total Budget</label>
          <input id="campusBudget" type="number" min="0" step="0.01" value="${escapeHtml(campus?.total_budget || "0")}">
          <span class="field-error" data-error-for="total_budget"></span>
        </div>
      </form>`,
    onConfirm: (modal) => {
      const vals = formValues(modal, { name: "#campusName", location: "#campusLocation", total_budget: "#campusBudget" });
      const errors = {};
      if (!vals.name || vals.name.length < 3) errors.name = "Enter a campus name (min 3 chars).";
      if (vals.total_budget === "" || isNaN(vals.total_budget) || Number(vals.total_budget) < 0) errors.total_budget = "Enter a valid positive number.";
      if (Object.keys(errors).length) { showFormErrors(modal, errors); return false; }

      app.update(state => {
        if (campusId) {
          const t = state.campuses.find(c => c.campus_id === campusId);
          Object.assign(t, { name: vals.name, location: vals.location || null, total_budget: Number(vals.total_budget) });
        } else {
          const nc = { campus_id: createId("campus"), name: vals.name, location: vals.location || null, total_budget: Number(vals.total_budget) };
          state.campuses.push(nc);
          app.selectedCampusId = nc.campus_id;
        }
      }, campusId ? "Campus updated." : "Campus added.");
      return true;
    }
  });
}

function deleteCampus(app, campusId) {
  const campus = app.state.campuses.find(c => c.campus_id === campusId);
  if (!campus) { showToast("Campus not found.", "error"); return; }
  const bIds = app.state.buildings.filter(b => b.campus_id === campusId).map(b => b.building_id);
  const dCount = app.state.departments.filter(d => bIds.includes(d.building_id)).length;
  const mCount = app.state.meters.filter(m => bIds.includes(m.building_id)).length;

  openModal({
    title: "Delete Campus", confirmLabel: "Delete", danger: true,
    bodyHtml: `<p>Delete <strong>${escapeHtml(campus.name)}</strong>?</p>
      <p class="delete-note">${bIds.length} building(s), ${dCount} department(s), ${mCount} meter(s) will also be removed.</p>`,
    onConfirm: () => {
      app.update(state => {
        state.meters = state.meters.filter(m => !bIds.includes(m.building_id));
        state.departments = state.departments.filter(d => !bIds.includes(d.building_id));
        state.buildings = state.buildings.filter(b => b.campus_id !== campusId);
        state.campuses = state.campuses.filter(c => c.campus_id !== campusId);
      }, "Campus deleted.");
      app.selectedCampusId = app.state.campuses[0]?.campus_id || null;
      app.selectedBuildingId = null;
      app.render("infrastructure");
      return true;
    }
  });
}

/* ══════════════════════════════════════════════════════
   BUILDING CRUD
   ══════════════════════════════════════════════════════ */
function openBuildingModal(app, buildingId = null) {
  const building = app.state.buildings.find(b => b.building_id === buildingId) || null;
  openModal({
    title: building ? "Edit Building" : "Add Building",
    confirmLabel: building ? "Save Building" : "Add Building",
    bodyHtml: `
      <form class="form-grid">
        <div class="form-field full">
          <label for="buildingName">Name</label>
          <input id="buildingName" value="${escapeHtml(building?.name || "")}" placeholder="Block A - Main Building">
          <span class="field-error" data-error-for="name"></span>
        </div>
        <div class="form-field">
          <label for="campusId">Campus</label>
          <select id="campusId">
            ${app.state.campuses.map(c => `<option value="${escapeHtml(c.campus_id)}" ${(building?.campus_id || app.selectedCampusId) === c.campus_id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
          </select>
          <span class="field-error" data-error-for="campus_id"></span>
        </div>
        <div class="form-field">
          <label for="buildingBudget">Budget</label>
          <input id="buildingBudget" type="number" min="0" step="0.01" value="${escapeHtml(building?.budget || "0")}">
          <span class="field-error" data-error-for="budget"></span>
        </div>
      </form>`,
    onConfirm: (modal) => {
      const vals = formValues(modal, { name: "#buildingName", campus_id: "#campusId", budget: "#buildingBudget" });
      const errors = {};
      if (!vals.name || vals.name.length < 3) errors.name = "Enter a building name.";
      if (!app.state.campuses.some(c => c.campus_id === vals.campus_id)) errors.campus_id = "Select a valid campus.";
      if (vals.budget === "" || isNaN(vals.budget) || Number(vals.budget) < 0) errors.budget = "Enter a valid positive number.";
      if (Object.keys(errors).length) { showFormErrors(modal, errors); return false; }

      app.update(state => {
        if (buildingId) {
          const t = state.buildings.find(b => b.building_id === buildingId);
          Object.assign(t, { name: vals.name, campus_id: vals.campus_id, budget: Number(vals.budget) });
        } else {
          const nb = { building_id: createId("building"), campus_id: vals.campus_id, name: vals.name, budget: Number(vals.budget) };
          state.buildings.push(nb);
          app.selectedBuildingId = nb.building_id;
        }
      }, buildingId ? "Building updated." : "Building added.");
      return true;
    }
  });
}

function deleteBuilding(app, buildingId) {
  const building = app.state.buildings.find(b => b.building_id === buildingId);
  if (!building) { showToast("Building not found.", "error"); return; }
  const dCount = app.state.departments.filter(d => d.building_id === buildingId).length;
  const mCount = app.state.meters.filter(m => m.building_id === buildingId).length;

  openModal({
    title: "Delete Building", confirmLabel: "Delete", danger: true,
    bodyHtml: `<p>Delete <strong>${escapeHtml(building.name)}</strong>?</p>
      <p class="delete-note">${dCount} department(s) and ${mCount} meter(s) will also be removed.</p>`,
    onConfirm: () => {
      const remaining = app.state.buildings.filter(b => b.building_id !== buildingId);
      app.selectedBuildingId = remaining.filter(b => b.campus_id === app.selectedCampusId)[0]?.building_id || null;
      app.update(state => {
        state.departments = state.departments.filter(d => d.building_id !== buildingId);
        state.meters = state.meters.filter(m => m.building_id !== buildingId);
        state.buildings = state.buildings.filter(b => b.building_id !== buildingId);
      }, "Building deleted.");
      return true;
    }
  });
}

/* ══════════════════════════════════════════════════════
   DEPARTMENT CRUD
   ══════════════════════════════════════════════════════ */
function openDeptModal(app, deptId = null) {
  const dept = app.state.departments.find(d => d.department_id === deptId) || null;
  const campusBuildings = app.state.buildings.filter(b => b.campus_id === app.selectedCampusId);

  openModal({
    title: dept ? "Edit Department" : "Add Department",
    confirmLabel: dept ? "Save Department" : "Add Department",
    bodyHtml: `
      <form class="form-grid">
        <div class="form-field full">
          <label for="deptName">Name</label>
          <input id="deptName" value="${escapeHtml(dept?.name || "")}" placeholder="Computer Science">
          <span class="field-error" data-error-for="name"></span>
        </div>
        <div class="form-field">
          <label for="deptBuilding">Building</label>
          <select id="deptBuilding">
            ${campusBuildings.map(b => `<option value="${escapeHtml(b.building_id)}" ${(dept?.building_id || app.selectedBuildingId) === b.building_id ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}
          </select>
          <span class="field-error" data-error-for="building_id"></span>
        </div>
        <div class="form-field">
          <label for="deptBudget">Budget</label>
          <input id="deptBudget" type="number" min="0" step="0.01" value="${escapeHtml(dept?.budget || "0")}">
          <span class="field-error" data-error-for="budget"></span>
        </div>
      </form>`,
    onConfirm: (modal) => {
      const vals = formValues(modal, { name: "#deptName", building_id: "#deptBuilding", budget: "#deptBudget" });
      const errors = {};
      if (!vals.name || vals.name.length < 2) errors.name = "Enter a department name.";
      if (!vals.building_id) errors.building_id = "Select a building.";
      if (vals.budget === "" || isNaN(vals.budget) || Number(vals.budget) < 0) errors.budget = "Enter a valid positive number.";
      if (Object.keys(errors).length) { showFormErrors(modal, errors); return false; }

      app.update(state => {
        if (deptId) {
          const t = state.departments.find(d => d.department_id === deptId);
          Object.assign(t, { name: vals.name, building_id: vals.building_id, budget: Number(vals.budget) });
        } else {
          state.departments.push({ department_id: createId("dept"), building_id: vals.building_id, name: vals.name, budget: Number(vals.budget) });
        }
      }, deptId ? "Department updated." : "Department added.");
      return true;
    }
  });
}

function deleteDept(app, deptId) {
  const dept = app.state.departments.find(d => d.department_id === deptId);
  if (!dept) { showToast("Department not found.", "error"); return; }
  openModal({
    title: "Delete Department", confirmLabel: "Delete", danger: true,
    bodyHtml: `<p>Delete department <strong>${escapeHtml(dept.name)}</strong>?</p>`,
    onConfirm: () => {
      app.update(state => { state.departments = state.departments.filter(d => d.department_id !== deptId); }, "Department deleted.");
      return true;
    }
  });
}

/* ══════════════════════════════════════════════════════
   METER CRUD
   ══════════════════════════════════════════════════════ */
function openMeterModal(app, buildingId, meterId = null) {
  const meter = app.state.meters.find(m => m.meter_id === meterId) || null;
  openModal({
    title: meter ? "Edit Meter" : "Add Meter",
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
            ${METER_TYPES.map(t => `<option value="${escapeHtml(t)}" ${meter?.meter_type === t ? "selected" : ""}>${escapeHtml(formatLabel(t))}</option>`).join("")}
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
            ${METER_STATUSES.map(s => `<option value="${escapeHtml(s)}" ${meter?.status === s ? "selected" : ""}>${escapeHtml(formatLabel(s))}</option>`).join("")}
          </select>
          <span class="field-error" data-error-for="status"></span>
        </div>
      </form>`,
    onConfirm: (modal) => {
      const vals = formValues(modal, { meter_code: "#meterCode", meter_type: "#meterType", zone: "#meterZone", status: "#meterStatus" });
      const errors = {};
      if (!vals.meter_code || vals.meter_code.length < 3) errors.meter_code = "Enter a meter code.";
      else if (app.state.meters.some(m => m.meter_id !== meterId && m.meter_code.toLowerCase() === vals.meter_code.toLowerCase())) errors.meter_code = "Code already exists.";
      if (!METER_TYPES.includes(vals.meter_type)) errors.meter_type = "Select a valid type.";
      if (!METER_STATUSES.includes(vals.status)) errors.status = "Select a valid status.";
      if (Object.keys(errors).length) { showFormErrors(modal, errors); return false; }

      app.update(state => {
        if (meterId) {
          const t = state.meters.find(m => m.meter_id === meterId);
          Object.assign(t, { building_id: buildingId, meter_code: vals.meter_code.toUpperCase(), meter_type: vals.meter_type, zone: vals.zone || null, status: vals.status });
        } else {
          state.meters.push({ meter_id: createId("meter"), building_id: buildingId, meter_code: vals.meter_code.toUpperCase(), meter_type: vals.meter_type, zone: vals.zone || null, status: vals.status });
        }
      }, meterId ? "Meter updated." : "Meter added.");
      return true;
    }
  });
}

function deleteMeter(app, meterId) {
  const meter = app.state.meters.find(m => m.meter_id === meterId);
  if (!meter) { showToast("Meter not found.", "error"); return; }
  openModal({
    title: "Delete Meter", confirmLabel: "Delete", danger: true,
    bodyHtml: `<p>Delete <strong>${escapeHtml(meter.meter_code)}</strong>?</p>`,
    onConfirm: () => {
      app.update(state => { state.meters = state.meters.filter(m => m.meter_id !== meterId); }, "Meter deleted.");
      return true;
    }
  });
}

/* ── HELPERS ───────────────────────────────────── */
function ensureSelections(app) {
  if (!app.selectedCampusId || !app.state.campuses.some(c => c.campus_id === app.selectedCampusId)) {
    app.selectedCampusId = app.state.campuses[0]?.campus_id || null;
  }
  if (app.selectedCampusId) {
    const campusBuildings = app.state.buildings.filter(b => b.campus_id === app.selectedCampusId);
    if (!app.selectedBuildingId || !campusBuildings.some(b => b.building_id === app.selectedBuildingId)) {
      app.selectedBuildingId = campusBuildings[0]?.building_id || null;
    }
  } else {
    app.selectedBuildingId = null;
  }
}
