/**
 * mockData.js (System Admin Adapter)
 * Redirects system_admin data access to the Universal DB.
 */
/*import universalDB from '../../shared/universalDB.js';

const EnerTrackDB = {
  get session() { return universalDB.data.session; },
  get alerts() { return universalDB.data.system_admin.alerts; },
  get backupJobs() { return universalDB.data.system_admin.backupJobs; },
  get systemUpdates() { return universalDB.data.system_admin.systemUpdates; },
  get systemHealth() { return universalDB.data.system_admin.systemHealth; },
  get performanceStats() { return universalDB.data.system_admin.performanceStats; },
  get errorScans() { return universalDB.data.system_admin.errorScans; },
  get maintenanceWindow() { return universalDB.data.system_admin.maintenanceWindow; },
  get serviceRequests() { return universalDB.data.workflow.serviceRequests; },
  
  save: function() {
    universalDB.save();
  }
};

export default EnerTrackDB;*/

import universalDB from "../../shared/universalDB.js";
import { userActions } from "../../shared/mockData.js";

export function getAdminState() {
  return {
    session: universalDB.data.session,
    users: userActions.getAllUsers(),
    campuses: universalDB.data.campuses,
    buildings: universalDB.data.buildings,
    departments: universalDB.data.departments,
    meters: universalDB.data.meters,
  };
}

export function saveAdminState(state) {
  universalDB.data.session = state.session;
  universalDB.data.campuses = state.campuses;
  universalDB.data.buildings = state.buildings;
  universalDB.data.departments = state.departments;
  universalDB.data.meters = state.meters;
  universalDB.save();
}

export { userActions };

export function resetAdminState() {
  universalDB.reset();
  return getAdminState();
}

export function createId(prefix) {
  const registry = {
    campus: { arr: universalDB.data.campuses, field: "campus_id" },
    building: { arr: universalDB.data.buildings, field: "building_id" },
    dept: { arr: universalDB.data.departments, field: "department_id" },
    meter: { arr: universalDB.data.meters, field: "meter_id" },
    user: { arr: universalDB.data.users, field: "user_id" },
  };
  const entry = registry[prefix];
  if (!entry) return `${prefix}-001`;
  let maxNum = 0;
  for (const item of entry.arr) {
    const m = (item[entry.field] || "").match(/-(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export const USER_ROLES = [
  "System Administrator",
  "Financial Analyst",
  "Technician",
  "Sustainability Officer",
  "Campus Visitor",
];

export const METER_TYPES = ["electricity", "gas", "water", "emissions", "food"];

export const METER_STATUSES = [
  "active",
  "faulty",
  "calibrating",
  "decommissioned",
];

export function mockHashPassword(password) {
  return "hashed_" + btoa(password).substring(0, 10);
}
