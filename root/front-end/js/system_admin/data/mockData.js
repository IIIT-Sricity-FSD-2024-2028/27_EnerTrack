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

const STORAGE_KEY = "enertrack_admin_dashboard_v1";

const defaultState = {
  session: {
    user: {
      name: "Aadithya Mouli",
      role: "systemAdministrator"
    }
  },
  users: [
    {
      id: "user-001",
      name: "Aadithya Mouli",
      email: "aadithya@enertrack.edu",
      role: "systemAdministrator",
      loginStatus: "online"
    },
    {
      id: "user-002",
      name: "Teja Rao",
      email: "teja@enertrack.edu",
      role: "technician",
      loginStatus: "offline"
    },
    {
      id: "user-003",
      name: "Chirag",
      email: "chirag@enertrack.edu",
      role: "technicianAdministrator",
      loginStatus: "online"
    },
    {
      id: "user-004",
      name: "Husaam",
      email: "husaam@enertrack.edu",
      role: "financeAnalyst",
      loginStatus: "invited"
    },
    {
      id: "user-005",
      name: "Viksa",
      email: "viksa@enertrack.edu",
      role: "sustainabilityOfficer",
      loginStatus: "locked"
    }
  ],
  buildings: [
    {
      id: "building-001",
      name: "Block A - Main Building",
      code: "BLK-A",
      location: "North Campus",
      floorCount: 5,
      status: "operational"
    },
    {
      id: "building-002",
      name: "Block B - Research Wing",
      code: "BLK-B",
      location: "Innovation Quad",
      floorCount: 4,
      status: "maintenance"
    },
    {
      id: "building-003",
      name: "Admin Tower",
      code: "ADM-T",
      location: "Central Campus",
      floorCount: 7,
      status: "operational"
    }
  ],
  meters: [
    {
      id: "meter-001",
      buildingId: "building-001",
      name: "Main LT Panel",
      meterType: "electricity",
      serialNumber: "ET-A-1001",
      status: "active",
      lastReadingKwh: 18420
    },
    {
      id: "meter-002",
      buildingId: "building-001",
      name: "HVAC Feed Meter",
      meterType: "smartMeter",
      serialNumber: "ET-A-1002",
      status: "active",
      lastReadingKwh: 9650
    },
    {
      id: "meter-003",
      buildingId: "building-002",
      name: "Lab Equipment Meter",
      meterType: "electricity",
      serialNumber: "ET-B-2101",
      status: "maintenance",
      lastReadingKwh: 12210
    },
    {
      id: "meter-004",
      buildingId: "building-003",
      name: "Admin Floor Stack",
      meterType: "smartMeter",
      serialNumber: "ET-ADM-3101",
      status: "active",
      lastReadingKwh: 7820
    }
  ]
};

export function getAdminState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return clone(defaultState);

    const parsed = JSON.parse(stored);
    return mergeWithDefaults(clone(defaultState), parsed);
  } catch (error) {
    console.warn("EnerTrack admin mock DB load failed. Falling back to defaults.", error);
    return clone(defaultState);
  }
}

export function saveAdminState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("EnerTrack admin mock DB save failed.", error);
  }
}

export function resetAdminState() {
  const state = clone(defaultState);
  saveAdminState(state);
  return state;
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function mergeWithDefaults(defaults, source) {
  return {
    ...defaults,
    ...source,
    session: {
      ...defaults.session,
      ...(source.session || {}),
      user: {
        ...defaults.session.user,
        ...(source.session?.user || {})
      }
    },
    users: Array.isArray(source.users) ? source.users : defaults.users,
    buildings: Array.isArray(source.buildings) ? source.buildings : defaults.buildings,
    meters: Array.isArray(source.meters) ? source.meters : defaults.meters
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
