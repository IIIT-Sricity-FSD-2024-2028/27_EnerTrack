/**
 * mockData.js
 * In-memory state synchronized with sessionStorage for the Technician dashboard.
 */

const STORAGE_KEY = "et_tech_db_v1";

const defaultData = {
  technician: {
    name: "Marcus Reed",
    role: "Lead Technician",
  },
  summary: {
    activeAlerts: 18,
    openFaults: 9,
    pendingWorkOrders: 14,
    resolvedToday: 27,
  },
  alerts: [
    { id: "ALR-8921", severity: "critical", timestamp: "2 min ago",   status: "open",     description: "Compressor C-12 Temperature Spike",       zone: "Zone 4" },
    { id: "ALR-8920", severity: "moderate", timestamp: "14 min ago",  status: "open",     description: "Pump B-07 Abnormal Vibration Pattern",     zone: "Line B" },
    { id: "ALR-8919", severity: "low",      timestamp: "35 min ago",  status: "open",     description: "Valve V-19 Intermittent Sensor Drift",     zone: "Utilities" },
    { id: "ALR-8918", severity: "moderate", timestamp: "1 hour ago",  status: "open",     description: "Boiler A-03 Pressure Instability",         zone: "Boiler Room" },
    { id: "ALR-8917", severity: "critical", timestamp: "1.5 hrs ago", status: "open",     description: "Motor M-02 Overtemperature Condition",     zone: "Zone 2" },
    { id: "ALR-8916", severity: "low",      timestamp: "2 hours ago", status: "open",     description: "Tank F-01 Low Fluid Level Approaching",    zone: "Storage" },
    { id: "ALR-8915", severity: "moderate", timestamp: "2 hours ago", status: "resolved", description: "Pressure drop in Boiler A-03",             actionTaken: "Remote reset applied by Marcus Reed" },
    { id: "ALR-8914", severity: "critical", timestamp: "4 hours ago", status: "resolved", description: "Vibration limit exceeded on Pump B-07",   actionTaken: "Emergency Response Initiated" },
    { id: "ALR-8913", severity: "low",      timestamp: "5 hours ago", status: "resolved", description: "Low fluid level in Tank F-01",            actionTaken: "Inspection Scheduled" },
    { id: "ALR-8912", severity: "moderate", timestamp: "Yesterday",   status: "resolved", description: "Sensor miscalibration on Valve V-19",     actionTaken: "Inspection Scheduled" },
  ],
  faults: [
    { id: "FD-204", alertId: "ALR-8921", type: "Cooling system failure", severity: "high",   asset: "Compressor C-12", status: "active",   assignedTo: "Marcus Reed" },
    { id: "FD-203", alertId: "ALR-8920", type: "Bearing wear",           severity: "moderate", asset: "Pump B-07",      status: "active",   assignedTo: "Marcus Reed" },
    { id: "FD-202", alertId: "ALR-8918", type: "Pressure regulator",     severity: "moderate", asset: "Boiler A-03",    status: "active",   assignedTo: "Marcus Reed" },
    { id: "FD-201", alertId: "ALR-8916", type: "Sensor drift",           severity: "low",    asset: "Valve V-19",      status: "pending",  assignedTo: "Marcus Reed" },
  ],
  workOrders: [
    { id: "WO-3021", title: "Compressor C-12 cooling line repair",         type: "emergency",  priority: "high",      technician: "Marcus Reed", parts: false, status: "new",        linkedFault: "FD-204" },
    { id: "WO-3018", title: "Pump B-07 inspection and vibration check",    type: "scheduled",  priority: "medium",    technician: "Elena Park",  parts: true,  status: "new",        linkedFault: "FD-203" },
    { id: "WO-2997", title: "Boiler A-03 pressure stability corrective",   type: "immediate",  priority: "immediate", technician: "Marcus Reed", parts: true,  status: "inprogress", linkedFault: "FD-202" },
    { id: "WO-2992", title: "Valve V-19 replacement planning",             type: "scheduled",  priority: "scheduled", technician: "Rina Das",    parts: false, status: "inprogress", linkedFault: "FD-201" },
    { id: "WO-2988", title: "Sensor calibration follow-up for Line B",     type: "preventive", priority: "preventive", technician: "Noah Smith", parts: true,  status: "review",     linkedFault: null },
  ],
  activityFeed: [
    {
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      type: "yellow", title: "Anomaly detected on Compressor C-12",
      desc: "Temperature spike exceeded threshold for 3 consecutive cycles in Zone 4.", time: "2 min ago"
    },
    {
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      type: "red", title: "Fault #FD-204 escalated to diagnostics",
      desc: "Vibration pattern on Pump B-07 now matches bearing wear signature.", time: "8 min ago"
    },
    {
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
      type: "green", title: "Work order WO-391 assigned",
      desc: "Inspection task created for cooling valve replacement.", time: "16 min ago"
    },
    {
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      type: "yellow", title: "Pressure anomaly cleared",
      desc: "Sensor readings returned to normal range after reset.", time: "24 min ago"
    },
    {
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
      type: "green", title: "Work order WO-384 completed",
      desc: "Motor coupling alignment confirmed by technician.", time: "37 min ago"
    },
  ],
};

class TechDB {
  constructor() {
    this.data = this._loadData();
  }

  _loadData() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...JSON.parse(JSON.stringify(defaultData)), ...parsed };
      }
    } catch (e) {
      console.error("TechDB: Failed to load", e);
    }
    return JSON.parse(JSON.stringify(defaultData));
  }

  save() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(defaultData));
    this.save();
  }

  // Getters
  get alerts() { return this.data.alerts; }
  get faults() { return this.data.faults; }
  get workOrders() { return this.data.workOrders; }
  get summary() { return this.data.summary; }
  get feed() { return this.data.activityFeed; }

  // Alert CRUD
  getAlert(id) { return this.data.alerts.find(a => a.id === id); }
  updateAlert(id, changes) {
    const idx = this.data.alerts.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.data.alerts[idx] = { ...this.data.alerts[idx], ...changes };
      this.save();
    }
  }
  acknowledgeAlert(id, actionTaken) {
    this.updateAlert(id, { status: "resolved", actionTaken });
    // Decrement summary
    this.data.summary.activeAlerts = Math.max(0, this.data.summary.activeAlerts - 1);
    this.data.summary.resolvedToday++;
    this.save();
  }

  // Fault CRUD
  getFault(id) { return this.data.faults.find(f => f.id === id); }
  updateFault(id, changes) {
    const idx = this.data.faults.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.data.faults[idx] = { ...this.data.faults[idx], ...changes };
      this.save();
    }
  }

  // Work Order CRUD
  getWorkOrder(id) { return this.data.workOrders.find(w => w.id === id); }
  addWorkOrder(wo) {
    this.data.workOrders.unshift(wo);
    this.data.summary.pendingWorkOrders++;
    this.save();
  }
  updateWorkOrder(id, changes) {
    const idx = this.data.workOrders.findIndex(w => w.id === id);
    if (idx !== -1) {
      this.data.workOrders[idx] = { ...this.data.workOrders[idx], ...changes };
      this.save();
    }
  }
  closeWorkOrder(id) {
    this.updateWorkOrder(id, { status: "closed" });
    this.data.summary.pendingWorkOrders = Math.max(0, this.data.summary.pendingWorkOrders - 1);
    this.data.summary.resolvedToday++;
    this.save();
  }
}

const db = new TechDB();
export default db;
