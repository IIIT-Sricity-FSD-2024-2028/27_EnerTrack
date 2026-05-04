/**
 * mockData.js (System Admin Adapter)
 * Redirects system_admin data access to the Universal DB.
 */
import universalDB from '../../shared/universalDB.js';

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

export default EnerTrackDB;
