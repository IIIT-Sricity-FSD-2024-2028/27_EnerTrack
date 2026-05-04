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
      role: "System Administrator"
    }
  },
  campuses: [
    {
      campus_id: "campus-001",
      name: "Main University Campus",
      location: "City Center",
      total_budget: 1500000.00
    }
  ],
  users: [
    {
      user_id: "user-001",
      name: "Aadithya Mouli",
      email: "aadithya@enertrack.edu",
      phone: "+1 555-0100",
      password: "hashed_password_mock",
      role: "System Administrator",
      specialization: null
    },
    {
      user_id: "user-002",
      name: "Teja Rao",
      email: "teja@enertrack.edu",
      phone: "+1 555-0101",
      password: "hashed_password_mock",
      role: "Technician",
      specialization: "HVAC Systems"
    },
    {
      user_id: "user-003",
      name: "Chirag",
      email: "chirag@enertrack.edu",
      phone: "+1 555-0102",
      password: "hashed_password_mock",
      role: "Technician",
      specialization: "Electrical Engineering"
    },
    {
      user_id: "user-004",
      name: "Husaam",
      email: "husaam@enertrack.edu",
      phone: "+1 555-0103",
      password: "hashed_password_mock",
      role: "Financial Analyst",
      specialization: null
    },
    {
      user_id: "user-005",
      name: "Viksa",
      email: "viksa@enertrack.edu",
      phone: "+1 555-0104",
      password: "hashed_password_mock",
      role: "Sustainability Officer",
      specialization: null
    }
  ],
  buildings: [
    {
      building_id: "building-001",
      campus_id: "campus-001",
      name: "Block A - Main Building",
      budget: 500000.00
    },
    {
      building_id: "building-002",
      campus_id: "campus-001",
      name: "Block B - Research Wing",
      budget: 350000.00
    },
    {
      building_id: "building-003",
      campus_id: "campus-001",
      name: "Admin Tower",
      budget: 200000.00
    }
  ],
  meters: [
    {
      meter_id: "meter-001",
      building_id: "building-001",
      meter_code: "ET-A-1001",
      meter_type: "electricity",
      zone: "Main LT Panel",
      status: "active"
    },
    {
      meter_id: "meter-002",
      building_id: "building-001",
      meter_code: "ET-A-1002",
      meter_type: "water",
      zone: "HVAC Feed Meter",
      status: "active"
    },
    {
      meter_id: "meter-003",
      building_id: "building-002",
      meter_code: "ET-B-2101",
      meter_type: "electricity",
      zone: "Lab Equipment Meter",
      status: "calibrating"
    },
    {
      meter_id: "meter-004",
      building_id: "building-003",
      meter_code: "ET-ADM-3101",
      meter_type: "electricity",
      zone: "Admin Floor Stack",
      status: "active"
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
    campuses: Array.isArray(source.campuses) ? source.campuses : defaults.campuses,
    buildings: Array.isArray(source.buildings) ? source.buildings : defaults.buildings,
    meters: Array.isArray(source.meters) ? source.meters : defaults.meters
  };
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
