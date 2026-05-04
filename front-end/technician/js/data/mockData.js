/**
 * mockData.js (Technician Adapter)
 * Redirects tech data access to the Universal DB.
 */
import universalDB from '../../../shared/universalDB.js';

class TechDB {
  get alerts() { return universalDB.data.tech.alerts; }
  get faults() { return universalDB.data.tech.faults; }
  get workOrders() { return universalDB.data.tech.workOrders; }
  get summary() { return universalDB.data.tech.summary; }
  get feed() { return universalDB.data.tech.activityFeed; }
  get serviceRequests() { return universalDB.data.workflow.serviceRequests; }
  get technicians() { return universalDB.data.workflow.technicians; }
  
  getRegisteredUsers() {
    return JSON.parse(localStorage.getItem('registeredUsers') || '[]');
  }

  save() {
    universalDB.save();
  }

  reset() {
    universalDB.reset();
  }

  // Alert CRUD
  getAlert(id) { return this.alerts.find(a => a.id === id); }
  updateAlert(id, changes) {
    const idx = this.alerts.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.alerts[idx] = { ...this.alerts[idx], ...changes };
      this.save();
    }
  }
  acknowledgeAlert(id, actionTaken) {
    this.updateAlert(id, { status: "acknowledged", actionTaken });
    
    const alert = this.getAlert(id);
    this.faults.push({
        id: "FLT-" + Math.floor(Math.random() * 9000 + 1000),
        alertId: alert.id,
        status: "active",
        severity: alert.severity === 'critical' ? 'high' : alert.severity,
        asset: alert.zone || "Unknown Asset",
        type: actionTaken.includes('Emergency') ? "Critical Failure" : "Mechanical",
        assignedTo: "Marcus Reed"
    });
    this.save();
  }

  resolveAlert(id) {
    this.updateAlert(id, { status: "resolved" });
    this.summary.activeAlerts = Math.max(0, this.summary.activeAlerts - 1);
    this.summary.resolvedToday++;
    this.save();
  }

  // Fault CRUD
  getFault(id) { return this.faults.find(f => f.id === id); }
  updateFault(id, changes) {
    const idx = this.faults.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.faults[idx] = { ...this.faults[idx], ...changes };
      this.save();
    }
  }

  // Work Order CRUD
  getWorkOrder(id) { return this.workOrders.find(w => w.id === id); }
  addWorkOrder(wo) {
    this.workOrders.unshift(wo);
    this.summary.pendingWorkOrders++;
    this.save();
  }
  updateWorkOrder(id, changes) {
    const idx = this.workOrders.findIndex(w => w.id === id);
    if (idx !== -1) {
      this.workOrders[idx] = { ...this.workOrders[idx], ...changes };
      const wo = this.workOrders[idx];
      if (wo.sourceRequest) {
          const sr = this.serviceRequests.find(s => s.id === wo.sourceRequest);
          if (sr) {
              if (wo.status === 'inprogress') sr.status = 'Approved (Executing)';
              if (wo.status === 'review') sr.status = 'Work Complete (Awaiting Validation)';
              if (wo.status === 'closed') sr.status = 'Closed';
          }
      }
      this.save();
    }
  }
  closeWorkOrder(id) {
    this.updateWorkOrder(id, { status: "closed" });
    this.summary.pendingWorkOrders = Math.max(0, this.summary.pendingWorkOrders - 1);
    this.summary.resolvedToday++;
    this.save();
  }
}

const db = new TechDB();
export default db;
