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

import universalDB from '../../shared/universalDB.js';
import { userActions } from '../../shared/mockData.js';

export function getAdminState() {
  return {
    session: universalDB.data.session,
    users: userActions.getAllUsers(),
    campuses: universalDB.data.campuses,
    buildings: universalDB.data.buildings,
    meters: universalDB.data.meters
  };
}

export function saveAdminState(state) {
  universalDB.data.session = state.session;
  universalDB.data.campuses = state.campuses;
  universalDB.data.buildings = state.buildings;
  universalDB.data.meters = state.meters;
  universalDB.save();
}

export { userActions };

export function resetAdminState() {
  universalDB.reset();
  return getAdminState();
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export const USER_ROLES = [
  "System Administrator",
  "Financial Analyst",
  "Technician",
  "Sustainability Officer",
  "Campus Visitor"
];

export const METER_TYPES = [
  "electricity",
  "gas",
  "water",
  "emissions",
  "food"
];

export const METER_STATUSES = [
  "active",
  "faulty",
  "calibrating",
  "decommissioned"
];

export function mockHashPassword(password) {
  return "hashed_" + btoa(password).substring(0, 10);
}
